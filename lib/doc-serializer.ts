/**
 * Caminho inverso do parser: `IndicacaoDoc` de volta para texto plano.
 *
 * Usado pelo botão "copiar texto" e, futuramente, pela geração de DOCX. Também
 * é o que permite testar o parser por round-trip: parse → serialize deve
 * devolver o texto original.
 */
import { type IndicacaoDoc, formatarDataExtenso } from './doc-types';

/** Um texto está "em caixa alta" quando não tem nenhuma minúscula acentuada ou não. */
function ehCaixaAlta(texto: string): boolean {
  const letras = texto.replace(/[^A-Za-zÀ-ÿ]/g, '');
  return letras.length > 0 && letras === letras.toUpperCase();
}

/**
 * Monta a linha de local e data, respeitando a caixa usada pelo gabinete.
 *
 * Gabinetes que escrevem o documento inteiro em caixa alta também escrevem
 * "SALA ALBERTO SANTOS DUMONT, 13 DE ABRIL DE 2026." — reconstruir em caixa
 * baixa quebraria a fidelidade.
 */
export function formatarLocalData(local: string, data: Date | null): string {
  if (!local && !data) return '';
  const dataTexto = data ? formatarDataExtenso(data) : '';
  const linha = dataTexto ? `${local}, ${dataTexto}.` : `${local}.`;
  return ehCaixaAlta(local) ? linha.toUpperCase() : linha;
}

export function docToTexto(doc: IndicacaoDoc): string {
  const blocos: string[] = [];

  if (doc.vocativo.length) blocos.push(doc.vocativo.join('\n'));
  blocos.push(...doc.preambulo);

  if (doc.tituloAno) {
    const numero = doc.tituloNumero ?? '____';
    blocos.push(`INDICAÇÃO Nº ${numero} /${doc.tituloAno}`);
  }

  blocos.push(...doc.corpo);
  if (doc.providencias.length) blocos.push(doc.providencias.join('\n'));
  blocos.push(...doc.fecho);

  const localData = formatarLocalData(doc.local, doc.data);
  if (localData) blocos.push(localData);

  return blocos.join('\n\n');
}
