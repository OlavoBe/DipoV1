import { NextRequest, NextResponse } from 'next/server';
import { indicacaoPipeline } from '@/lib/pipeline';
import { prisma } from '@/lib/db';
import { isDemoMode } from '@/lib/llm';
import { auth } from '@/auth';
import { checkLimite } from '@/lib/planos';
import { logUsage } from '@/lib/usage-log';
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

    const body: IndicacaoRequest & {
      templateId?: string;
      ajuste?: string;
      // Id da indicação que está sendo ajustada. Quando vem junto com `ajuste`,
      // o resultado é uma VERSÃO dela, não uma indicação nova.
      ajustarId?: string;
    } = await req.json();
    const { texto, complementos, templateId, ajuste, ajustarId } = body;

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

    // Se há instrução de ajuste, incorpora ao texto antes de enviar ao pipeline
    const textoParaPipeline = ajuste?.trim()
      ? `${texto.trim()}\n\nAJUSTE SOLICITADO PELO ASSESSOR: ${ajuste.trim()}`
      : texto.trim();

    // ── Pipeline: Extract → Validate → Normalize → Generate ──
    const result = await indicacaoPipeline(textoParaPipeline, complementos, templateId, vereadorSlug, tenantId);

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
    const { textoFinal, ementa, extracted } = result;
    const extractedJson = JSON.stringify(extracted);

    // Ajuste de uma indicação existente: atualiza o texto dela e guarda a nova
    // versão, com a instrução que o assessor escreveu.
    //
    // Antes isto criava uma indicação nova, e cinco tentativas do mesmo pedido
    // viravam cinco registros — inflando o histórico e consumindo cinco vezes a
    // cota do plano. Como aqui não nasce linha nova em Indicacao, a cota, a
    // numeração e a contagem do histórico ficam certas sem tocar nelas.
    if (ajuste?.trim() && ajustarId) {
      // O tenantId no where é a proteção: sem ele, um id vindo do cliente
      // permitiria ajustar indicação de outro gabinete.
      const existente = await prisma.indicacao.findFirst({
        where: { id: ajustarId, tenantId },
        select: { id: true },
      });

      if (!existente) {
        return NextResponse.json(
          { status: 'error', error: 'Indicação não encontrada para ajustar.' },
          { status: 404 },
        );
      }

      const ultima = await prisma.indicacao.findUnique({
        where: { id: existente.id },
        select: { versoes: { orderBy: { versao: 'desc' }, take: 1, select: { versao: true } } },
      });

      // Indicações anteriores a esta funcionalidade não têm versão nenhuma
      // gravada: o texto atual delas é, por definição, a versão 1.
      const proxima = (ultima?.versoes[0]?.versao ?? 1) + 1;

      await prisma.$transaction([
        prisma.indicacao.update({
          where: { id: existente.id },
          data: {
            textoFinal,
            ementa: ementa || null,
            extractedJson,
            tipoServico: extracted.tipos_servico?.[0] ?? extracted.categoria ?? 'outros',
            bairro:      extracted.bairro     || '',
            logradouro:  extracted.logradouro || '',
            numero:      extracted.numero     || null,
            cep:         extracted.cep        || null,
          },
        }),
        prisma.indicacaoVersao.create({
          data: {
            indicacaoId: existente.id,
            versao: proxima,
            textoFinal,
            ementa: ementa || null,
            extractedJson,
            ajuste: ajuste.trim(),
          },
        }),
      ]);

      logUsage(tenantId, 'ajuste', session.user.id, {
        recordId: existente.id,
        categoria: extracted.categoria,
        versao: proxima,
      });

      return NextResponse.json({
        status: 'success',
        texto_final: textoFinal,
        ementa,
        record_id: existente.id,
        versao: proxima,
        extracted,
      });
    }

    const record = await prisma.indicacao.create({
      data: {
        inputRaw:      texto.trim(),
        extractedJson,
        textoFinal,
        ementa:        ementa || null,
        tipoServico:   extracted.tipos_servico?.[0] ?? extracted.categoria ?? 'outros',
        bairro:        extracted.bairro     || '',
        logradouro:    extracted.logradouro || '',
        numero:        extracted.numero     || null,
        cep:           extracted.cep        || null,
        tenantId,
        // Autoria. O usageLog já registrava quem gerou, mas ele é um log de
        // uso: rotativo por natureza e desacoplado do documento. Quem produziu
        // uma indicação é atributo dela, e precisa sobreviver junto dela.
        userId:        session.user.id,
      },
    });

    // Versão 1: o texto original, sem instrução de ajuste. Guardar desde a
    // criação deixa o histórico completo — sem isso, a primeira versão de cada
    // indicação seria a única que não dá para consultar.
    await prisma.indicacaoVersao.create({
      data: {
        indicacaoId: record.id,
        versao: 1,
        textoFinal,
        ementa: ementa || null,
        extractedJson,
      },
    });

    logUsage(tenantId, 'generate', session.user.id, {
      recordId: record.id,
      categoria: extracted.categoria,
    });

    return NextResponse.json({
      status: 'success',
      texto_final: textoFinal,
      ementa,
      record_id: record.id,
      versao: 1,
      extracted,
    });

  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro interno desconhecido';
    console.error('[API /indicacao] Erro:', err);
    return NextResponse.json({ status: 'error', error: message }, { status: 500 });
  }
}
