import type { LayoutFn, LayoutId } from './types';
import { brasaoEsquerda } from './brasao-esquerda';

export const LAYOUTS: Record<LayoutId, LayoutFn> = {
  brasao_esquerda: brasaoEsquerda,
};

/** Layout pelo id do template; cai no padrão quando o id é desconhecido. */
export function getLayout(id?: string): LayoutFn {
  if (id && id in LAYOUTS) return LAYOUTS[id as LayoutId];
  return LAYOUTS.brasao_esquerda;
}

export type { LayoutFn, LayoutId, RenderOpts } from './types';
