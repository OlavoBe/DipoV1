/**
 * Confere que o binário do Chromium viaja dentro do bundle das rotas que geram PDF.
 *
 * Uso: npx tsx scripts/verifica-bundle-pdf.ts   (depois de `next build`)
 *
 * Por que isto existe
 * ───────────────────
 * O `@sparticuz/chromium` guarda o navegador em `bin/*.br`, arquivos que nenhum
 * `import` alcança — quem os coloca no bundle é o `outputFileTracingIncludes` do
 * `next.config.js`. Quando a declaração não pega, nada falha: `lib/pdf.ts` cai
 * na reserva e baixa 66MB do GitHub a cada cold start. A rota responde 200, os
 * testes passam, o CI fica verde e o custo aparece só na latência.
 *
 * Foi exatamente o que aconteceu. A chave era `'/api/pdf/[id]'`, mas essas
 * chaves são GLOBS: `[id]` é uma classe de caracteres, que casa com `/api/pdf/i`
 * e `/api/pdf/d` — nunca com a rota dinâmica real. Só `/api/demo`, sem colchetes,
 * recebia os binários. Meses de produção baixando o pack remoto, e a verificação
 * manual passava porque tinha sido feita justamente pela rota que estava certa.
 *
 * A checagem lê o manifesto de rastreamento que o Next emite por rota
 * (`*.nft.json`) — a lista real do que sobe para a função, não o que o config
 * pediu.
 */
import fs from 'node:fs';
import path from 'node:path';

/** Arquivos que o @sparticuz/chromium precisa encontrar em disco para subir. */
const BINARIOS = ['chromium.br', 'al2023.tar.br', 'fonts.tar.br', 'swiftshader.tar.br'];

const RAIZ_APP = 'app';
const RAIZ_BUILD = path.join('.next', 'server', 'app');

/**
 * Rotas que chamam o gerador de PDF, lidas do código-fonte.
 *
 * Deliberadamente não deduzimos a lista do próprio rastreamento: `/api/docx`
 * importa `buildFilename` de `lib/pdf` e por isso encosta no `@sparticuz/chromium`
 * sem nunca lançar um navegador. Cobrar os 66MB dela seria desperdício.
 */
function rotasQueGeramPdf(): string[] {
  const rotas: string[] = [];
  const arquivos = fs.readdirSync(RAIZ_APP, { recursive: true, encoding: 'utf8' });

  for (const rel of arquivos) {
    if (path.basename(rel) !== 'route.ts') continue;
    const conteudo = fs.readFileSync(path.join(RAIZ_APP, rel), 'utf8');
    if (!/\bgeneratePdf\w*\s*\(/.test(conteudo)) continue;
    rotas.push(path.dirname(rel).split(path.sep).join('/'));
  }

  return rotas.sort();
}

function binariosFaltando(rota: string): string[] | 'sem-manifesto' {
  const manifesto = path.join(RAIZ_BUILD, ...rota.split('/'), 'route.js.nft.json');
  if (!fs.existsSync(manifesto)) return 'sem-manifesto';

  const { files } = JSON.parse(fs.readFileSync(manifesto, 'utf8')) as { files: string[] };
  const traçados = new Set(
    files
      .filter((f) => f.includes('@sparticuz/chromium/bin/'))
      .map((f) => path.basename(f)),
  );

  return BINARIOS.filter((b) => !traçados.has(b));
}

function main(): void {
  const rotas = rotasQueGeramPdf();

  if (rotas.length === 0) {
    console.error('✗ nenhuma rota chamando generatePdf* foi encontrada em app/.');
    console.error('  Ou o gerador foi renomeado, ou esta checagem parou de valer.');
    process.exit(1);
  }

  const quebradas: string[] = [];

  for (const rota of rotas) {
    const faltando = binariosFaltando(rota);

    if (faltando === 'sem-manifesto') {
      console.error(`✗ /${rota} — manifesto ausente. Rode \`next build\` antes.`);
      quebradas.push(rota);
      continue;
    }

    if (faltando.length > 0) {
      console.error(`✗ /${rota} — sem ${faltando.join(', ')} no bundle`);
      quebradas.push(rota);
      continue;
    }

    console.log(`✓ /${rota} — Chromium embarcado (${BINARIOS.length} arquivos)`);
  }

  if (quebradas.length > 0) {
    console.error('');
    console.error('O Chromium não vai junto com estas rotas, então a produção vai');
    console.error('baixar 66MB do GitHub a cada cold start.');
    console.error('');
    console.error('Corrija o `outputFileTracingIncludes` no next.config.js. Lembre que');
    console.error('as chaves são globs: use `/api/pdf/**`, nunca `/api/pdf/[id]` —');
    console.error('colchetes ali são classe de caracteres e não casam com a rota.');
    process.exit(1);
  }

  console.log(`\n${rotas.length} rota(s) verificada(s).`);
}

main();
