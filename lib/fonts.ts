/**
 * Fontes embarcadas para a geração de PDF.
 *
 * O Chromium do ambiente serverless roda em Linux e não tem Bookman Old Style
 * nem Times New Roman. Sem as fontes embarcadas ele cai, em silêncio, numa
 * serifada genérica — o documento sai com métricas e quebras de linha
 * diferentes do modelo do gabinete, e nada aparece no log.
 *
 * Por isso as fontes são injetadas como data URI dentro do próprio HTML.
 * Nada de <link> para arquivo externo: requisição de rede dentro da função
 * serverless é justamente o que reintroduz o fallback silencioso.
 *
 * Substitutas livres das fontes originais:
 *   "Dipo Bookman"  TeX Gyre Bonum (GUST Font License) — no lugar de Bookman Old Style
 *   "Dipo Times"    Tinos (Apache 2.0)                 — no lugar de Times New Roman
 *
 * As originais são da Monotype/Microsoft, licenciadas para uso local junto com
 * o Windows/Office. Embarcá-las num SaaS que gera documentos para terceiros
 * seria uso não licenciado — ver docs/fontes.md.
 */
import { FONTES_EMBARCADAS } from './fonts.generated';

export const FAMILIA_CORPO = 'Dipo Bookman';
export const FAMILIA_CABECALHO = 'Dipo Times';

/** Pilha de fontes com fallbacks, para usar em `font-family`. */
export const STACK_CORPO = `'${FAMILIA_CORPO}', 'Bookman Old Style', Georgia, serif`;
export const STACK_CABECALHO = `'${FAMILIA_CABECALHO}', 'Times New Roman', Times, serif`;

let cache: string | null = null;

/**
 * Regras @font-face com as fontes embutidas em base64.
 *
 * `font-display: block` evita que o Chromium renderize um quadro com a fonte de
 * fallback antes da fonte real ficar pronta — combinado com o
 * `document.fonts.ready` do gerador, garante que a paginação use as métricas
 * corretas.
 */
export function buildFontFaceCss(): string {
  if (cache !== null) return cache;

  cache = FONTES_EMBARCADAS.map(
    (f) =>
      `@font-face{font-family:'${f.familia}';font-style:${f.estilo};font-weight:${f.peso};` +
      `font-display:block;src:url(${f.dataUri}) format('woff2');}`,
  ).join('\n');

  return cache;
}

/** Metadados das fontes embarcadas (sem os data URIs) — usado em testes e diagnóstico. */
export function listarFontesEmbarcadas(): { familia: string; peso: number; estilo: string }[] {
  return FONTES_EMBARCADAS.map(({ familia, peso, estilo }) => ({ familia, peso, estilo }));
}
