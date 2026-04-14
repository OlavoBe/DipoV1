import { NextRequest, NextResponse } from 'next/server';
import { indicacaoPipeline } from '@/lib/pipeline';
import { prisma } from '@/lib/db';
import { isDemoMode } from '@/lib/llm';
import { auth } from '@/auth';
import { checkLimite } from '@/lib/planos';
import type { IndicacaoRequest, IndicacaoResponse } from '@/lib/types';

export const maxDuration = 60; // 60s timeout para LLM

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ status: 'error', error: 'Não autenticado.' }, { status: 401 });
    }

    const tenantId = session.user.tenantId;
    if (!tenantId) {
      return NextResponse.json({ status: 'error', error: 'Usuário sem tenant vinculado.' }, { status: 403 });
    }

    const body: IndicacaoRequest & { templateId?: string } = await req.json();
    const { texto, complementos, templateId } = body;

    // Lê o vereadorSlug do tenant para personalizar o prompt
    const tenantData = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { plano: true, vereadorSlug: true },
    });
    const vereadorSlug = tenantData?.vereadorSlug ?? undefined;

    if (!texto || typeof texto !== 'string' || texto.trim().length < 10) {
      return NextResponse.json(
        { status: 'error', error: 'Texto muito curto. Descreva o problema com mais detalhes.' },
        { status: 400 },
      );
    }

    // Verificar limite do plano
    const limite = await checkLimite(tenantId);
    if (!limite.permitido) {
      return NextResponse.json(
        {
          error: 'limite_atingido',
          motivo: limite.motivo ?? 'Limite do plano atingido.',
          restantes: 0,
          upgrade_url: '/upgrade',
        },
        { status: 402 },
      );
    }

    // Modo demo (sem API key)
    if (isDemoMode()) {
      return NextResponse.json(
        {
          status: 'error',
          error: 'LLM_API_KEY não configurada. Configure a variável de ambiente no arquivo .env e reinicie o servidor.',
        },
        { status: 503 },
      );
    }

    // ── Pipeline: Extract → Validate → Normalize → Generate ──
    const result = await indicacaoPipeline(texto.trim(), complementos, templateId, vereadorSlug);

    if (result.status === 'error') {
      return NextResponse.json({ status: 'error', error: result.message }, { status: 500 });
    }

    if (result.status === 'incomplete') {
      return NextResponse.json({
        status: 'incomplete',
        perguntas_faltantes: result.perguntas,
        extracted: result.extracted,
      });
    }

    // ── Persistência ──────────────────────────────────────────
    const { textoFinal, extracted } = result;

    const record = await prisma.indicacao.create({
      data: {
        inputRaw:      texto.trim(),
        extractedJson: JSON.stringify(extracted),
        textoFinal,
        tipoServico:   extracted.tipos_servico?.[0] ?? extracted.categoria ?? 'outros',
        bairro:        extracted.bairro     || '',
        logradouro:    extracted.logradouro || '',
        numero:        extracted.numero     || null,
        cep:           extracted.cep        || null,
        tenantId,
      },
    });

    return NextResponse.json({
      status: 'success',
      texto_final: textoFinal,
      record_id: record.id,
      extracted,
    });

  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro interno desconhecido';
    console.error('[API /indicacao] Erro:', err);
    return NextResponse.json({ status: 'error', error: message }, { status: 500 });
  }
}
