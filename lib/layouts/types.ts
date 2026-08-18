import type { IndicacaoDoc } from '../doc-types';
import type { TemplateSettings } from '../template';

export type LayoutId = 'brasao_esquerda';

export interface RenderOpts {
  /** Marca d'água e rodapé de demonstração (rota /demo). */
  demo?: boolean;
  /** Escala o corpo para caber em 1 página; 1 = tamanho natural. */
  fatorCompressao?: number;
}

/** Um layout recebe o documento estruturado + os tokens e devolve o HTML completo. */
export type LayoutFn = (doc: IndicacaoDoc, t: TemplateSettings, opts: RenderOpts) => string;
