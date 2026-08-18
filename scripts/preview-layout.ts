/**
 * Gera um PDF de teste com o layout fiel do gabinete, sem depender do banco.
 * Uso: npx tsx scripts/preview-layout.ts [saida.pdf]
 */
import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { generatePdfComTemplate } from '../lib/pdf';
import { readFileSync } from 'fs';
import { TEMPLATE_MARCIO, TEXTO_REFERENCIA } from './preset-marcio';

async function main() {
  // 1o argumento: arquivo .txt com o texto (opcional; sem ele usa a referencia)
  // 2o argumento: caminho do PDF de saida
  const entrada = process.argv[2];
  const texto = entrada && entrada.endsWith('.txt')
    ? readFileSync(entrada, 'utf8').replace(/^EMENTA:[\s\S]*?\n\n/, '').trim()
    : TEXTO_REFERENCIA;
  const saida = (entrada && !entrada.endsWith('.txt') ? entrada : process.argv[3])
    ?? join(__dirname, '..', 'tmp', 'preview-marcio.pdf');
  mkdirSync(dirname(saida), { recursive: true });

  const pdf = await generatePdfComTemplate(texto, TEMPLATE_MARCIO);
  writeFileSync(saida, pdf);

  const s = pdf.toString('latin1');
  const paginas = (s.match(/\/Count\s+(\d+)/g) ?? []).map((c) => parseInt(c.match(/\d+/)![0], 10));
  console.log(`PDF: ${saida}`);
  console.log(`  tamanho: ${(pdf.length / 1024).toFixed(0)} KB`);
  console.log(`  páginas: ${paginas.length ? Math.max(...paginas) : 1}`);
  console.log(`  Bonum embarcada: ${/Bonum/.test(s) ? 'sim' : 'NAO'} | Tinos: ${/Tinos/.test(s) ? 'sim' : 'NAO'}`);
}
main().catch((e) => { console.error('FALHOU:', e); process.exit(1); });
