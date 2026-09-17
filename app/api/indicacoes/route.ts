import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { auth } from '@/auth';
import type { Prisma } from '@prisma/client';

const PAGE_SIZE = 20;

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function getPeriodoStart(periodo: string): Date | null {
  const now = new Date();
  switch (periodo) {
    case '7d':
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    case '30d':
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    case 'mes':
      return new Date(now.getFullYear(), now.getMonth(), 1);
    default:
      return null;
  }
}

/** Extrai o tema da indicação: usa extractedJson.tema ou a primeira linha do inputRaw */
function extractAssunto(inputRaw: string, extractedJson: string): string {
  try {
    const parsed = JSON.parse(extractedJson);
    if (parsed.tema && typeof parsed.tema === 'string' && parsed.tema.trim()) {
      const tema = parsed.tema.trim();
      return tema.length > 120 ? tema.slice(0, 117) + '…' : tema;
    }
  } catch {
    // JSON inválido — usa fallback
  }
  const firstLine = inputRaw.split('\n')[0].trim();
  return firstLine.length > 120 ? firstLine.slice(0, 117) + '…' : firstLine;
}

// ─────────────────────────────────────────────
// GET /api/indicacoes
// Query params:
//   search  — busca em logradouro, bairro, tipoServico, inputRaw
//   periodo — '7d' | '30d' | 'mes' | 'todos'
//   page    — 1-based
// ─────────────────────────────────────────────

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
    }

    const tenantId = session.user.tenantId;
    if (!tenantId) {
      return NextResponse.json({ error: 'Usuário sem tenant vinculado.' }, { status: 403 });
    }

    const { searchParams } = req.nextUrl;
    const search  = searchParams.get('search')?.trim() ?? '';
    const periodo = searchParams.get('periodo') ?? 'todos';
    const page    = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));

    const periodoStart = getPeriodoStart(periodo);

    const where: Prisma.IndicacaoWhereInput = {
      tenantId,
      ...(periodoStart ? { createdAt: { gte: periodoStart } } : {}),
      ...(search
        ? {
            OR: [
              { logradouro:  { contains: search, mode: 'insensitive' } },
              { bairro:      { contains: search, mode: 'insensitive' } },
              { tipoServico: { contains: search, mode: 'insensitive' } },
              { inputRaw:    { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [total, records] = await Promise.all([
      prisma.indicacao.count({ where }),
      prisma.indicacao.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        select: {
          id: true,
          createdAt: true,
          inputRaw: true,
          extractedJson: true,
          textoFinal: true,
          ementa: true,
          tipoServico: true,
          logradouro: true,
          bairro: true,
          numero: true,
          cep: true,
          feedback: true,
        },
      }),
    ]);

    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

    // O número é como as indicações são referidas na conversa ("a #145"), então
    // precisa ser o mesmo sempre. Antes saía de `total - offset - i`, com o
    // total JÁ FILTRADO: a mesma indicação aparecia como #145 em "Todos" e como
    // #3 em "Últimos 7 dias".
    //
    // Agora é a posição absoluta dentro do gabinete — quantas indicações existem
    // até ela, inclusive —, que não depende de filtro nem de página. Fica estável
    // porque as linhas só são acrescentadas: nada muda a contagem de quem veio
    // antes.
    //
    // São N contagens por página (20), não uma. Com 154 registros é irrelevante;
    // se um dia incomodar, o caminho é guardar o número numa coluna na criação —
    // o que exige migration aplicada à mão, porque o deploy daqui não aplica.
    const numeros = await Promise.all(
      records.map((r) =>
        prisma.indicacao.count({
          where: { tenantId, createdAt: { lte: r.createdAt } },
        }),
      ),
    );

    const items = records.map((r, i) => ({
      id: r.id,
      numero: numeros[i],
      assunto: extractAssunto(r.inputRaw, r.extractedJson),
      enderecoCompleto: r.logradouro
        ? [r.logradouro, r.numero, r.bairro].filter(Boolean).join(', ')
        : null,
      createdAt: r.createdAt.toISOString(),
      textoFinal: r.textoFinal,
      // Nulo nas indicações geradas antes da funcionalidade de ementa.
      ementa: r.ementa ?? null,
      status: 'gerada' as const,
      feedback: r.feedback ?? null,
    }));

    return NextResponse.json({ items, total, page, totalPages });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro interno';
    console.error('[API /indicacoes] Erro:', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
