/** Exporta o HTML do layout para inspeção visual. Uso: npx tsx scripts/preview-html.ts [saida.html] */
import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { getLayout } from '../lib/layouts';
import { parseTextoToDoc } from '../lib/doc-parser';
import { TEMPLATE_MARCIO, TEXTO_REFERENCIA } from './preset-marcio';

const saida = process.argv[2] ?? join(__dirname, '..', 'tmp', 'preview-marcio.html');
mkdirSync(dirname(saida), { recursive: true });

const doc = parseTextoToDoc(TEXTO_REFERENCIA, TEMPLATE_MARCIO);
writeFileSync(saida, getLayout(TEMPLATE_MARCIO.layoutId)(doc, TEMPLATE_MARCIO, {}));

console.log('HTML:', saida);
console.log(`blocos -> vocativo:${doc.vocativo.length} preambulo:${doc.preambulo.length} ` +
  `corpo:${doc.corpo.length} providencias:${doc.providencias.length} titulo:${doc.tituloAno}`);
