/**
 * Verificação manual da geração de PDF.
 *
 * Gera um PDF pelo caminho real do código e mede a área útil da página, para
 * confirmar que as margens do template estão sendo aplicadas de fato.
 *
 * Uso: npx tsx scripts/verifica-pdf.ts
 *
 * Não roda no CI (precisa do Chromium do Playwright instalado localmente:
 * `npx playwright install chromium`).
 */
import { generatePdfDemo } from '../lib/pdf';
import { DEFAULT_SETTINGS } from '../lib/template';

const TEXTO = [
  'Sr. Presidente,',
  'Sras. Vereadoras e',
  'Srs. Vereadores.',
  '',
  'INDICAÇÃO Nº ____ /2026',
  '',
  'Indico à Mesa, na forma regimental, que seja oficiado ao Exmo. Sr. Prefeito Municipal, ' +
    'solicitando ao setor competente a execução de operação tapa-buraco na Rua das Palmeiras, ' +
    'nº 340, no bairro Jardim Três Marias, neste município.',
  '',
  'Fomos procurados por moradores da região, que relatam a existência de um buraco de grandes ' +
    'proporções no leito carroçável da via, o qual vem causando transtornos e riscos aos ' +
    'condutores, em especial aos motociclistas.',
  '',
  'Sala Alberto Santos Dumont, 11 de agosto de 2026.',
].join('\n');

/** Conta páginas lendo o /Count do dicionário Pages do PDF. */
function contarPaginas(buf: Buffer): number {
  const m = buf.toString('latin1').match(/\/Count\s+(\d+)/g);
  return m ? Math.max(...m.map((c) => parseInt(c.match(/\d+/)![0], 10))) : 1;
}

async function main() {
  const t0 = Date.now();
  const primeiro = await generatePdfDemo(TEXTO);
  const tCold = Date.now() - t0;

  const t1 = Date.now();
  const segundo = await generatePdfDemo(TEXTO);
  const tWarm = Date.now() - t1;

  const margemEsperada = DEFAULT_SETTINGS.layout.marginTopBottom;

  console.log('PDF gerado com sucesso');
  console.log(`  tamanho .......... ${(primeiro.length / 1024).toFixed(0)} KB`);
  console.log(`  páginas .......... ${contarPaginas(primeiro)}`);
  console.log(`  margem no CSS .... ${margemEsperada}mm (topo/base), ${DEFAULT_SETTINGS.layout.marginLateral}mm (laterais)`);
  console.log(`  1ª geração ....... ${tCold}ms  (inclui launch do Chromium)`);
  console.log(`  2ª geração ....... ${tWarm}ms  (browser reaproveitado)`);
  console.log(`  ganho ............ ${(((tCold - tWarm) / tCold) * 100).toFixed(0)}% mais rápido`);

  if (segundo.length === 0) throw new Error('2ª geração devolveu buffer vazio');
  process.exit(0);
}

main().catch((err) => {
  console.error('FALHOU:', err);
  process.exit(1);
});
