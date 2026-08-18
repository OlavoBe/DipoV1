/**
 * Gera uma indicação de ponta a ponta e produz o PDF pronto para impressão.
 *
 * Roda o pipeline real (extração → validação → normalização → geo → geração +
 * ementa) e aplica o layout do gabinete. É o caminho completo do produto, sem
 * passar pela interface.
 *
 * Uso:
 *   npx tsx scripts/gerar-indicacao.ts "relato do pedido em texto livre"
 *   npx tsx scripts/gerar-indicacao.ts "..." saida.pdf
 *
 * Consome a API do LLM configurada no .env.
 */
import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { indicacaoPipeline } from '../lib/pipeline';
import { generatePdfComTemplate } from '../lib/pdf';
import { getLayout } from '../lib/layouts';
import { parseTextoToDoc } from '../lib/doc-parser';
import { TEMPLATE_MARCIO } from './preset-marcio';

const RELATO_PADRAO =
  'Moradores da Rua das Ostras, altura do número 480, no bairro Jardim dos Pássaros, ' +
  'relataram que a iluminação pública está apagada há mais de três semanas. ' +
  'São dois postes sem funcionar no trecho, que fica escuro à noite e já registrou ' +
  'furtos. Os moradores pedem a verificação e a manutenção da iluminação.';

async function main() {
  const relato = process.argv[2] || RELATO_PADRAO;
  const saida = process.argv[3] ?? join(__dirname, '..', 'tmp', 'indicacao-gerada.pdf');
  mkdirSync(dirname(saida), { recursive: true });

  console.log('Relato:');
  console.log(`  "${relato.slice(0, 110)}${relato.length > 110 ? '…' : ''}"\n`);

  console.log('Rodando o pipeline...');
  const t0 = Date.now();
  const resultado = await indicacaoPipeline(relato, undefined, undefined, 'marcio_pet');

  if (resultado.status === 'error') {
    console.error('FALHOU:', resultado.message);
    process.exit(1);
  }
  if (resultado.status === 'incomplete') {
    console.error('O pipeline pediu mais informações:');
    resultado.perguntas.forEach((q) => console.error('  -', q));
    console.error('\nComplete o relato e rode de novo.');
    process.exit(1);
  }

  const tPipeline = Date.now() - t0;
  console.log(`  concluído em ${(tPipeline / 1000).toFixed(1)}s\n`);

  console.log('Ementa (campo "Assunto" do protocolo):');
  console.log(`  ${resultado.ementa || '(não gerada)'}\n`);

  console.log('Texto:');
  console.log(resultado.textoFinal.split('\n').map((l) => '  ' + l).join('\n'));
  console.log('');

  const t1 = Date.now();
  const pdf = await generatePdfComTemplate(resultado.textoFinal, TEMPLATE_MARCIO);
  writeFileSync(saida, pdf);

  // Guarda o HTML e o texto ao lado do PDF: permite conferir o resultado e
  // re-renderizar sem gastar outra chamada de LLM.
  const base = saida.replace(/\.pdf$/, '');
  writeFileSync(
    base + '.html',
    getLayout(TEMPLATE_MARCIO.layoutId)(
      parseTextoToDoc(resultado.textoFinal, TEMPLATE_MARCIO),
      TEMPLATE_MARCIO,
      {},
    ),
  );
  writeFileSync(
    base + '.txt',
    ['EMENTA:', resultado.ementa || '(não gerada)', '', resultado.textoFinal, ''].join('\n'),
  );

  const s = pdf.toString('latin1');
  const paginas = (s.match(/\/Count\s+(\d+)/g) ?? []).map((c) => parseInt(c.match(/\d+/)![0], 10));

  console.log('PDF pronto para impressão:');
  console.log(`  arquivo : ${saida}`);
  console.log(`  tamanho : ${(pdf.length / 1024).toFixed(0)} KB`);
  console.log(`  páginas : ${paginas.length ? Math.max(...paginas) : 1}`);
  console.log(`  fontes  : ${/Bonum/.test(s) ? 'Bonum' : '-'}${/Tinos/.test(s) ? ' + Tinos' : ''}`);
  console.log(`  geração : ${((Date.now() - t1) / 1000).toFixed(1)}s`);
}

main().catch((e) => {
  console.error('FALHOU:', e);
  process.exit(1);
});
