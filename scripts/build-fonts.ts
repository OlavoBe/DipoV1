/**
 * Gera lib/fonts.generated.ts com as fontes embarcadas em base64.
 *
 * Por que embutir em código em vez de ler do disco em runtime: o modo de falha
 * que estamos evitando é o fallback silencioso de fonte. Se o arquivo não for
 * incluído no bundle serverless, o Chromium não avisa — ele só troca a fonte e
 * o documento sai com métricas diferentes. Em código, isso não acontece.
 *
 * Uso: npm run build:fonts
 *
 * As fontes de origem ficam em assets/fonts/ (versionadas):
 *   bonum-*.woff2  TeX Gyre Bonum  — GUST Font License (livre, inclusive comercial)
 *   tinos-*.woff2  Tinos           — Apache 2.0
 */
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

const RAIZ = join(__dirname, '..');
const DIR = join(RAIZ, 'assets', 'fonts');
const SAIDA = join(RAIZ, 'lib', 'fonts.generated.ts');

interface Variante {
  arquivo: string;
  familia: 'Dipo Bookman' | 'Dipo Times';
  peso: 400 | 700;
  estilo: 'normal' | 'italic';
}

const VARIANTES: Variante[] = [
  { arquivo: 'bonum-400-normal.woff2', familia: 'Dipo Bookman', peso: 400, estilo: 'normal' },
  { arquivo: 'bonum-700-normal.woff2', familia: 'Dipo Bookman', peso: 700, estilo: 'normal' },
  { arquivo: 'bonum-400-italic.woff2', familia: 'Dipo Bookman', peso: 400, estilo: 'italic' },
  { arquivo: 'bonum-700-italic.woff2', familia: 'Dipo Bookman', peso: 700, estilo: 'italic' },
  { arquivo: 'tinos-400-normal.woff2', familia: 'Dipo Times',   peso: 400, estilo: 'normal' },
  { arquivo: 'tinos-700-normal.woff2', familia: 'Dipo Times',   peso: 700, estilo: 'normal' },
  { arquivo: 'tinos-400-italic.woff2', familia: 'Dipo Times',   peso: 400, estilo: 'italic' },
  { arquivo: 'tinos-700-italic.woff2', familia: 'Dipo Times',   peso: 700, estilo: 'italic' },
];

function main() {
  const partes: string[] = [];
  let total = 0;

  for (const v of VARIANTES) {
    const caminho = join(DIR, v.arquivo);
    if (!existsSync(caminho)) {
      throw new Error(`Fonte ausente: ${caminho}. Veja docs/fontes.md para regerar.`);
    }
    const b64 = readFileSync(caminho).toString('base64');
    total += b64.length;
    partes.push(
      `  {\n` +
      `    familia: ${JSON.stringify(v.familia)},\n` +
      `    peso: ${v.peso},\n` +
      `    estilo: ${JSON.stringify(v.estilo)},\n` +
      `    dataUri: 'data:font/woff2;base64,${b64}',\n` +
      `  },`,
    );
  }

  const conteudo =
    `// ARQUIVO GERADO por scripts/build-fonts.ts — não editar à mão.\n` +
    `// Regerar com: npm run build:fonts\n\n` +
    `export interface FonteEmbarcada {\n` +
    `  familia: string;\n` +
    `  peso: number;\n` +
    `  estilo: 'normal' | 'italic';\n` +
    `  dataUri: string;\n` +
    `}\n\n` +
    `export const FONTES_EMBARCADAS: FonteEmbarcada[] = [\n${partes.join('\n')}\n];\n`;

  writeFileSync(SAIDA, conteudo, 'utf8');
  console.log(`lib/fonts.generated.ts gerado — ${VARIANTES.length} variantes, ${(total / 1024).toFixed(0)}KB de base64`);
}

main();
