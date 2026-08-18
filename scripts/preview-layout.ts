/**
 * Gera um PDF de teste com o layout fiel do gabinete, sem depender do banco.
 * Uso: npx tsx scripts/preview-layout.ts [saida.pdf]
 */
import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { generatePdfComTemplate } from '../lib/pdf';
import { TEMPLATE_MARCIO, TEXTO_REFERENCIA } from './preset-marcio';

async function main() {
  const saida = process.argv[2] ?? join(__dirname, '..', 'tmp', 'preview-marcio.pdf');
  mkdirSync(dirname(saida), { recursive: true });

  const pdf = await generatePdfComTemplate(TEXTO_REFERENCIA, TEMPLATE_MARCIO);
  writeFileSync(saida, pdf);

  const s = pdf.toString('latin1');
  const paginas = (s.match(/\/Count\s+(\d+)/g) ?? []).map((c) => parseInt(c.match(/\d+/)![0], 10));
  console.log(`PDF: ${saida}`);
  console.log(`  tamanho: ${(pdf.length / 1024).toFixed(0)} KB`);
  console.log(`  páginas: ${paginas.length ? Math.max(...paginas) : 1}`);
  console.log(`  Bonum embarcada: ${/Bonum/.test(s) ? 'sim' : 'NAO'} | Tinos: ${/Tinos/.test(s) ? 'sim' : 'NAO'}`);
}
main().catch((e) => { console.error('FALHOU:', e); process.exit(1); });
