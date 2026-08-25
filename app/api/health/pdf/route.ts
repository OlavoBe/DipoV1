import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { generatePdfComTemplate, getOrigemChromium } from '@/lib/pdf';
import { DEFAULT_SETTINGS } from '@/lib/template';

/**
 * Prova que o ramo serverless de `lib/pdf.ts` renderiza um PDF de verdade.
 *
 * Nenhum teste local passa por aqui. `lib/pdf.ts` tem dois ramos — serverless
 * (`@sparticuz/chromium`) e local (`playwright`) — e tudo que roda na máquina
 * exercita só o segundo. Já houve PDF quebrado em produção sobrevivendo a 184
 * testes e a um CI verde.
 *
 * Não gasta LLM: monta o PDF a partir de um texto fixo e do template neutro,
 * sem tocar no banco.
 *
 * ── O que esta rota NÃO prova ────────────────────────────────────────────────
 * Cada rota vira uma função com o seu próprio bundle, então o verde aqui diz
 * que *esta* função tem o Chromium — não que `/api/pdf/[id]` tem. Quem cobre
 * isso é `scripts/verifica-bundle-pdf.ts`, que lê os manifestos no build. As
 * duas checagens se complementam; nenhuma substitui a outra.
 *
 * ── Ativação ────────────────────────────────────────────────────────────────
 * Sem `PDF_HEALTH_TOKEN` a rota responde 404, como o /test-login faz com o
 * TEST_MODE. Lançar Chromium é caro: aberta sem token, seria um jeito barato de
 * queimar a conta de terceiros.
 */

export const maxDuration = 60;

const TEXTO = [
  'Sr. Presidente,',
  '',
  'INDICAÇÃO Nº ____ /2026',
  '',
  'Indico à Mesa, na forma regimental, que seja oficiado ao Exmo. Sr. Prefeito ' +
    'Municipal, solicitando ao setor competente a verificação de rotina.',
  '',
  'Sala Alberto Santos Dumont.',
].join('\n');

/** Comparação de tokens sem vazar o tamanho do prefixo pelo tempo de resposta. */
function tokenConfere(enviado: string, esperado: string): boolean {
  const a = Buffer.from(enviado);
  const b = Buffer.from(esperado);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const esperado = process.env.PDF_HEALTH_TOKEN;
  if (!esperado) {
    return new NextResponse(null, { status: 404 });
  }

  const enviado =
    req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ??
    req.nextUrl.searchParams.get('token') ??
    '';

  if (!tokenConfere(enviado, esperado)) {
    return NextResponse.json({ ok: false, erro: 'Token inválido.' }, { status: 401 });
  }

  const inicio = Date.now();

  try {
    const pdf = await generatePdfComTemplate(TEXTO, DEFAULT_SETTINGS);
    const ms = Date.now() - inicio;

    // Um Buffer não-vazio não prova nada: só a assinatura diz que é um PDF.
    const assinatura = pdf.subarray(0, 5).toString('latin1');
    const valido = assinatura === '%PDF-' && pdf.length > 1024;

    const corpo = {
      ok: valido,
      bytes: pdf.length,
      ms,
      // 'embarcado' é o esperado. 'pack-remoto' significa que o bundle subiu sem
      // o Chromium e o cold start está baixando 66MB do GitHub — responde, mas
      // é o estado que o smoke test precisa reprovar.
      origemChromium: getOrigemChromium(),
      assinatura,
    };

    return NextResponse.json(corpo, { status: valido ? 200 : 500 });
  } catch (err) {
    console.error('[API /health/pdf] Falha ao gerar PDF:', err);
    return NextResponse.json(
      {
        ok: false,
        ms: Date.now() - inicio,
        origemChromium: getOrigemChromium(),
        erro: err instanceof Error ? err.message : 'Erro interno',
      },
      { status: 500 },
    );
  }
}
