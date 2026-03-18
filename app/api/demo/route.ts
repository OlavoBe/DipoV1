import { NextRequest, NextResponse } from 'next/server';
import { indicacaoPipeline } from '@/lib/pipeline';
import { prisma } from '@/lib/db';
import { isDemoMode } from '@/lib/llm';
import { generatePdfDemo } from '@/lib/pdf';
import type { IndicacaoRequest } from '@/lib/types';

export const maxDuration = 60;

const LIMITE_DIARIO = 1;

function getDataHoje(): string {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

function getClientIp(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    req.headers.get('x-real-ip') ||
    '0.0.0.0'
  );
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    if (isDemoMode()) {
      return NextResponse.json(
        { status: 'error', error: 'LLM não configurado no servidor.' },
        { status: 503 },
      );
    }

    const ip = getClientIp(req);
    const data = getDataHoje();

    // Verificar limite antes de gastar LLM
    const usoAtual = await prisma.demoUso.findUnique({
      where: { ip_data: { ip, data } },
    });

    if (usoAtual && usoAtual.contagem >= LIMITE_DIARIO) {
      return NextResponse.json(
        {
          status: 'error',
          error: `Você já utilizou sua geração gratuita de hoje. Crie uma conta grátis para continuar usando o Dipo sem limites.`,
        },
        { status: 429 },
      );
    }

    const body: IndicacaoRequest & { complementos?: Record<string, string> } = await req.json();
    const { texto, complementos } = body;

    if (!texto || typeof texto !== 'string' || texto.trim().length < 10) {
      return NextResponse.json(
        { status: 'error', error: 'Texto muito curto. Descreva o problema com mais detalhes.' },
        { status: 400 },
      );
    }

    // ── Pipeline ──────────────────────────────────────────────
    const result = await indicacaoPipeline(texto.trim(), complementos);

    if (result.status === 'error') {
      return NextResponse.json({ status: 'error', error: result.message }, { status: 500 });
    }

    if (result.status === 'incomplete') {
      // Não consome o limite — usuário ainda precisa responder perguntas
      return NextResponse.json({
        status: 'incomplete',
        perguntas_faltantes: result.perguntas,
        extracted: result.extracted,
      });
    }

    // Só consome o limite quando a geração foi bem-sucedida
    await prisma.demoUso.upsert({
      where: { ip_data: { ip, data } },
      update: { contagem: { increment: 1 } },
      create: { ip, data, contagem: 1 },
    });

    const { textoFinal, extracted } = result;

    // Gerar PDF com rodapé e marca d'água de demo
    const pdfBuffer = await generatePdfDemo(textoFinal);

    return NextResponse.json({
      status: 'success',
      texto_final: textoFinal,
      pdf_base64: pdfBuffer.toString('base64'),
      extracted,
    });

  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro interno desconhecido';
    console.error('[API /demo] Erro:', err);
    return NextResponse.json({ status: 'error', error: message }, { status: 500 });
  }
}
