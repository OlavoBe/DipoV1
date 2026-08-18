/**
 * Layout fiel ao documento do Gabinete Márcio do Pet Shop.
 *
 * Todas as medidas vêm do .docx e do .pdf reais do gabinete, medidos — não
 * estimados. A referência está em docs/especificacao-gabinete-marcio.md e os
 * arquivos originais em tests/fixtures/referencia/.
 *
 * Dois pontos reproduzem o original de propósito, mesmo parecendo inconsistência:
 *  - o preâmbulo é justificado, mas o parágrafo "Indico à Mesa..." fica alinhado
 *    à esquerda. É assim no documento do gabinete.
 *  - o brasão fica à esquerda da margem do texto (offset do anchor no Word,
 *    depois ajustado a pedido do gabinete).
 */
import type { LayoutFn } from './types';
import { escapeHtml, resolverStack, imgTag, buildFontFaceCss } from './shared';
import { formatarLocalData } from '../doc-serializer';

// ── Medidas do documento de referência (mm) ───────────────────
const PAG = {
  margemLateral: 31.7,
  margemInferior: 25.4,
  topoCabecalho: 13.0,
  topoCorpo: 56.9,
};

const BRASAO = { largura: 25.7, altura: 28.0, deslocEsq: -12.0, deslocTopo: 3.8 };
const PARTIDO = { largura: 42.0, altura: 15.0 };

/**
 * O brasão fica à esquerda da margem do texto (`deslocEsq`). O Chromium recorta
 * tudo que ultrapassa a área definida por `@page margin`, o que cortava o brasão
 * ao meio. Então a página abre `SANGRIA` a mais de cada lado e o conteúdo devolve
 * esses mesmos milímetros em padding: o texto continua em 31,7mm e o brasão cabe
 * inteiro dentro da área imprimível.
 *
 * Ao mudar `deslocEsq`, a margem da página acompanha sozinha — mas confira com
 * `node tools/preview-a4.mjs`, que reporta a distância do brasão até a borda.
 */
const SANGRIA = Math.abs(BRASAO.deslocEsq);
const MARGEM_PAGINA = PAG.margemLateral - SANGRIA;

// ── Tamanhos (pt), extraídos dos operadores Tf do PDF real ────
const PT = {
  instituicao: 26,
  estado: 12,
  vereadorCabecalho: 20,
  gabinete: 12,
  email: 12,
  vocativo: 13,
  corpo: 12,
  titulo: 16,
  localData: 14,
  assinatura: 14,
};

const RECUO_MM = 12.7; // 0,5" — o padrão do Word
const NL = '\n';

export const brasaoEsquerda: LayoutFn = (doc, t, opts) => {
  const f = opts.fatorCompressao ?? 1;
  const pt = (v: number) => (v * f).toFixed(2) + 'pt';

  const fCorpo = resolverStack(t.typography.fontFamily);
  const fCabecalho = resolverStack(t.typography.fontFamilyCabecalho ?? t.typography.fontFamily);
  const cor = t.colors.text || '#000';

  const p = (texto: string, classe: string) =>
    '<p class="' + classe + '">' + escapeHtml(texto) + '</p>';

  const vocativo = doc.vocativo.length
    ? '<div class="bloco-vocativo">' + doc.vocativo.map((l) => p(l, 'vocativo')).join(NL) + '</div>'
    : '';
  const preambulo = doc.preambulo.map((x) => p(x, 'para')).join(NL);
  const corpo = doc.corpo.map((x) => p(x, 'para-esq')).join(NL);
  const providencias = doc.providencias.map((x) => p(x, 'prov')).join(NL);
  const fecho = doc.fecho.map((x) => p(x, 'para')).join(NL);

  const numero = doc.tituloNumero ?? '_____';
  const titulo =
    '<p class="titulo">INDICAÇÃO Nº ' + escapeHtml(numero) + ' /' + doc.tituloAno + '</p>';

  const localData = formatarLocalData(doc.local, doc.data);
  const blocoLocalData = localData
    ? '<p class="local-data">' + escapeHtml(localData) + '</p>'
    : '';

  const assinatura = doc.assinaturaNome
    ? '<div class="assinatura">' +
      '<div class="linha"></div>' +
      '<p class="nome">' + escapeHtml(doc.assinaturaNome) + '</p>' +
      '<p class="cargo">' + escapeHtml(doc.assinaturaCargo) + '</p>' +
      '</div>'
    : '';

  const partido = t.logos.partido
    ? '<div class="partido">' + imgTag(t.logos.partido, PARTIDO.largura, PARTIDO.altura) + '</div>'
    : '';

  const marcaDemo = opts.demo
    ? '<div class="demo-marca">DEMONSTRAÇÃO</div>' +
      '<div class="demo-rodape">Gerado com Dipo · dipo.com.br</div>'
    : '';

  const css = `
${buildFontFaceCss()}

@page {
  size: A4;
  margin: ${PAG.topoCabecalho}mm ${MARGEM_PAGINA}mm ${PAG.margemInferior}mm ${MARGEM_PAGINA}mm;
}

* { box-sizing: border-box; margin: 0; padding: 0; }
html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }

body {
  font-family: ${fCorpo};
  font-size: ${pt(PT.corpo)};
  color: ${cor};
  line-height: ${t.typography.lineHeight || 1.15};
  /* devolve a sangria aberta na @page, para o texto ficar em ${PAG.margemLateral}mm */
  padding: 0 ${SANGRIA}mm;
}

/* ── Cabeçalho ─────────────────────────────── */
.cabecalho {
  position: relative;
  text-align: center;
  font-family: ${fCabecalho};
  min-height: ${PAG.topoCorpo - PAG.topoCabecalho}mm;
}
.brasao { position: absolute; left: ${BRASAO.deslocEsq}mm; top: ${BRASAO.deslocTopo}mm; }
.instituicao { font-size: ${pt(PT.instituicao)}; font-weight: bold; font-style: italic; }
.estado      { font-size: ${pt(PT.estado)}; font-style: italic; }
.ver-nome    { font-size: ${pt(PT.vereadorCabecalho)}; font-weight: bold; font-style: italic; }
.gabinete    { font-size: ${pt(PT.gabinete)}; font-weight: bold; font-style: italic; }
.email       { font-size: ${pt(PT.email)}; font-style: italic; }

/* ── Corpo ─────────────────────────────────── */
.bloco-vocativo { margin-bottom: ${pt(12)}; }
.vocativo {
  font-size: ${pt(PT.vocativo)};
  font-weight: bold;
  text-align: left;
  text-indent: 0;
}

.para, .para-esq {
  font-size: ${pt(PT.corpo)};
  text-indent: ${RECUO_MM}mm;
  margin-bottom: ${pt(t.typography.paragraphSpacing || 6)};
  orphans: 3;
  widows: 3;
}
/* justificado no preâmbulo, à esquerda no "Indico à Mesa..." — como no original */
.para     { text-align: justify; }
.para-esq { text-align: left; }

.titulo {
  font-size: ${pt(PT.titulo)};
  font-weight: bold;
  text-align: center;
  text-indent: 0;
  margin: ${pt(14)} 0 ${pt(6)} 0;
  break-inside: avoid;
}

.prov {
  font-size: ${pt(PT.corpo)};
  text-align: left;
  text-indent: 0;
  padding-left: ${RECUO_MM}mm;
  margin-bottom: ${pt(2)};
}

.local-data {
  font-size: ${pt(PT.localData)};
  text-align: center;
  text-indent: 0;
  margin-top: ${pt(18)};
  break-inside: avoid;
}

/* ── Assinatura ────────────────────────────── */
.assinatura { text-align: center; margin-top: ${pt(22)}; break-inside: avoid; }
.assinatura .linha {
  width: 78mm;
  border-top: 1px solid ${cor};
  margin: 0 auto ${pt(4)} auto;
}
.assinatura .nome  { font-size: ${pt(PT.assinatura)}; font-weight: bold; text-indent: 0; }
.assinatura .cargo { font-size: ${pt(PT.assinatura)}; font-weight: bold; text-indent: 0; }

.partido { text-align: center; margin-top: ${pt(8)}; break-inside: avoid; }

/* ── Demo ──────────────────────────────────── */
.demo-marca {
  position: fixed; top: 50%; left: 50%;
  transform: translate(-50%,-50%) rotate(-45deg);
  font-family: sans-serif; font-size: 64pt; font-weight: bold;
  color: rgba(0,0,0,.06); letter-spacing: 6pt; white-space: nowrap;
  pointer-events: none; z-index: 999;
}
.demo-rodape {
  position: fixed; bottom: 6mm; left: 0; right: 0;
  text-align: center; font-family: sans-serif; font-size: 8pt; color: #999;
}

${t.customCss ?? ''}
`;

  const cabecalho =
    '<div class="cabecalho">' +
    '<div class="brasao">' + imgTag(t.logos.left, BRASAO.largura, BRASAO.altura) + '</div>' +
    '<p class="instituicao">' + escapeHtml(t.institution.name) + '</p>' +
    '<p class="estado">' + escapeHtml(t.institution.title) + '</p>' +
    '<p class="ver-nome">' + escapeHtml(t.institution.subtitle) + '</p>' +
    '<p class="gabinete">' + escapeHtml(t.institution.gabinete) + '</p>' +
    '<p class="email">' + escapeHtml(t.institution.email) + '</p>' +
    '</div>';

  return [
    '<!DOCTYPE html>',
    '<html lang="pt-BR">',
    '<head><meta charset="UTF-8"><title>Indicação Legislativa</title>',
    '<style>' + css + '</style>',
    '</head>',
    '<body>',
    marcaDemo,
    cabecalho,
    vocativo,
    preambulo,
    titulo,
    corpo,
    providencias,
    fecho,
    blocoLocalData,
    assinatura,
    partido,
    '</body></html>',
  ].join(NL);
};
