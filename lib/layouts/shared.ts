import { buildFontFaceCss, STACK_CORPO, STACK_CABECALHO } from '../fonts';

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Traduz a fonte configurada no template para a pilha com a substituta
 * embarcada. Os templates guardam nomes de fontes do Windows, que não existem
 * no Linux do ambiente serverless.
 */
export function resolverStack(fontFamily: string): string {
  const f = (fontFamily || '').toLowerCase();
  if (f.includes('bookman')) return STACK_CORPO;
  if (f.includes('times')) return STACK_CABECALHO;
  return fontFamily || STACK_CORPO;
}

export function imgTag(src: string | null, larguraMm: number, alturaMm: number, extra = ''): string {
  if (!src) return '';
  return `<img src="${src}" style="width:${larguraMm}mm;height:${alturaMm}mm;object-fit:contain;${extra}">`;
}

export { buildFontFaceCss };
