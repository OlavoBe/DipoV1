/**
 * Gera um PDF pelo caminho de producao (le o template do banco pelo tenantId).
 * Confirma que o template aplicado esta realmente sendo usado.
 *
 * Uso: npx tsx scripts/teste-tenant.ts <tenantId> [saida.pdf]
 */
import { writeFileSync, mkdirSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { generatePdf } from '../lib/pdf';
import { getTemplate } from '../lib/template';

async function main() {
  const tenantId = process.argv[2];
  if (!tenantId) { console.error('informe o tenantId'); process.exit(1); }
  const saida = process.argv[3] ?? join(__dirname, '..', 'tmp', 'teste-tenant.pdf');
  mkdirSync(dirname(saida), { recursive: true });

  const t = await getTemplate(undefined, tenantId);
  console.log('template lido do banco:');
  console.log(`  layoutId : ${t.layoutId ?? '(nenhum — usaria o HTML legado)'}`);
  console.log(`  gabinete : ${t.institution.gabinete}`);
  console.log(`  fonte    : ${t.typography.fontFamily}`);
  console.log(`  margens  : ${t.layout.marginLateral}mm laterais`);

  const texto = readFileSync(join(__dirname, '..', 'tmp', 'indicacao-gerada.txt'), 'utf8')
    .replace(/^EMENTA:[\s\S]*?\n\n/, '').trim();

  const pdf = await generatePdf(texto, undefined, tenantId);
  writeFileSync(saida, pdf);

  const s = pdf.toString('latin1');
  const paginas = (s.match(/\/Count\s+(\d+)/g) ?? []).map((c) => parseInt(c.match(/\d+/)![0], 10));
  console.log('\nPDF gerado pelo caminho de producao:');
  console.log(`  arquivo : ${saida}`);
  console.log(`  paginas : ${paginas.length ? Math.max(...paginas) : 1}`);
  console.log(`  imagens : ${(s.match(/\/Subtype\s*\/Image/g) ?? []).length}`);
  console.log(`  fontes  : ${/Bonum/.test(s) ? 'Bonum ' : ''}${/Tinos/.test(s) ? '+ Tinos' : ''}`);
}
main().catch((e) => { console.error('FALHOU:', e); process.exit(1); });
