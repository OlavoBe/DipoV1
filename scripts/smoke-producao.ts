/**
 * Smoke test pós-deploy: confirma que o deploy gera PDF de verdade.
 *
 * Uso:
 *   SMOKE_URL=https://usedipo.com.br PDF_HEALTH_TOKEN=... npx tsx scripts/smoke-producao.ts
 *
 * Roda contra a URL do deploy, não contra a máquina. É a única verificação que
 * passa pelo ramo serverless de `lib/pdf.ts` — os 184 testes locais exercitam
 * só o ramo do Playwright, e foi por essa fresta que um PDF quebrado chegou à
 * produção com o CI verde.
 *
 * Reprova em três situações distintas, e a diferença entre elas importa:
 *   • a rota não gerou PDF          → a geração está quebrada
 *   • gerou pelo 'pack-remoto'      → funciona, mas baixando 66MB por cold start
 *   • demorou demais                → perto do teto de 60s da função
 */

const URL_BASE = process.env.SMOKE_URL?.replace(/\/$/, '');
const TOKEN = process.env.PDF_HEALTH_TOKEN;

/** Acima disto a função está perto do teto de 60s e um cold start pior estoura. */
const LIMITE_MS = 25_000;

interface Resposta {
  ok?: boolean;
  bytes?: number;
  ms?: number;
  origemChromium?: string | null;
  erro?: string;
}

/**
 * Falha esperada do smoke test, com mensagem já pronta para o log.
 *
 * O script usava `process.exit()` direto. Encerrar com sockets do fetch ainda
 * abertos derrubava o processo no Windows (`UV_HANDLE_CLOSING`) e o `npm run
 * smoke` saía com 127 mesmo quando o PDF tinha sido gerado. Um check que
 * reprova deploy saudável vira ruído e acaba ignorado, então o encerramento
 * agora é por `process.exitCode`, deixando o Node fechar o que abriu.
 */
class FalhaSmoke extends Error {}

function exigir(nome: string, valor: string | undefined): string {
  if (!valor) throw new FalhaSmoke(`${nome} não definido.`);
  return valor;
}

async function main(): Promise<void> {
  const base = exigir('SMOKE_URL', URL_BASE);
  const token = exigir('PDF_HEALTH_TOKEN', TOKEN);

  const alvo = `${base}/api/health/pdf`;
  console.log(`→ ${alvo}`);

  const inicio = Date.now();
  let res: Response;

  try {
    res = await fetch(alvo, {
      headers: { authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(70_000),
    });
  } catch (err) {
    throw new FalhaSmoke(`requisição falhou: ${err instanceof Error ? err.message : err}`);
  }

  const decorrido = Date.now() - inicio;

  if (res.status === 404) {
    console.error('  A rota fica inerte sem ele. Defina a variável na Vercel.');
    throw new FalhaSmoke('404 — PDF_HEALTH_TOKEN não está definido no ambiente do deploy.');
  }

  if (res.status === 401) {
    throw new FalhaSmoke('401 — o token daqui não bate com o do deploy.');
  }

  // Ler como texto antes de parsear: um "não é JSON" sem mostrar o que veio
  // não diz nada. Na primeira execução real a resposta era a tela de SSO da
  // Vercel com HTTP 200, e a mensagem sozinha não permitia perceber isso.
  const texto = await res.text();
  let corpo: Resposta;

  try {
    corpo = JSON.parse(texto) as Resposta;
  } catch {
    console.error(`✗ resposta não-JSON (HTTP ${res.status}).`);
    console.error(`  content-type: ${res.headers.get('content-type') ?? '—'}`);

    if (res.redirected) {
      console.error(`  a requisição foi redirecionada para: ${res.url}`);
    }

    if (/vercel|_vercel_sso|Authentication Required/i.test(texto)) {
      console.error('');
      console.error('  Isto é a tela de proteção de deploy da Vercel, não a rota.');
      console.error('  SMOKE_URL precisa apontar para o domínio público de produção,');
      console.error('  não para a URL imutável do deploy (dipo-v1-<hash>.vercel.app).');
    }

    console.error(`  início do corpo: ${texto.slice(0, 200).replace(/s+/g, ' ')}`);
    throw new FalhaSmoke('resposta inesperada do servidor.');
  }

  if (!res.ok || !corpo.ok) {
    if (corpo.erro) console.error(`  ${corpo.erro}`);
    if (corpo.origemChromium) console.error(`  origem do Chromium: ${corpo.origemChromium}`);
    throw new FalhaSmoke(`geração de PDF falhou (HTTP ${res.status}).`);
  }

  console.log(`✓ PDF gerado — ${corpo.bytes} bytes em ${corpo.ms}ms (${decorrido}ms na ponta)`);
  console.log(`  origem do Chromium: ${corpo.origemChromium}`);

  let falhou = false;

  if (corpo.origemChromium === 'pack-remoto') {
    console.error('');
    console.error('✗ o Chromium veio do pack remoto, não do bundle.');
    console.error('  A rota responde, mas cada cold start baixa 66MB do GitHub.');
    console.error('  Rode `npm run verify:bundle` depois do build: a declaração de');
    console.error('  rastreamento no next.config.js provavelmente parou de casar.');
    falhou = true;
  }

  if ((corpo.ms ?? 0) > LIMITE_MS) {
    console.error('');
    console.error(`✗ ${corpo.ms}ms para gerar, acima do limite de ${LIMITE_MS}ms.`);
    console.error('  A função tem teto de 60s — um cold start pior estoura.');
    falhou = true;
  }

  if (falhou) throw new FalhaSmoke('deploy reprovado nas verificações acima.');
}

main().catch((err: unknown) => {
  console.error(`✗ ${err instanceof FalhaSmoke ? err.message : err}`);
  // exitCode em vez de exit(): deixa o Node encerrar os sockets do fetch.
  process.exitCode = 1;
});
