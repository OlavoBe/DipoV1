import { describe, it, expect } from 'vitest';
import {
  buildFontFaceCss,
  listarFontesEmbarcadas,
  STACK_CORPO,
  STACK_CABECALHO,
  FAMILIA_CORPO,
  FAMILIA_CABECALHO,
} from '@/lib/fonts';

/**
 * As fontes embarcadas existem para evitar o fallback silencioso do Chromium
 * no Linux — que troca a fonte sem avisar e muda as quebras de linha do
 * documento. Estes testes travam a presença e o formato delas.
 */

describe('fontes embarcadas', () => {
  it('tem as 8 variantes: 2 famílias x 2 pesos x 2 estilos', () => {
    const fontes = listarFontesEmbarcadas();
    expect(fontes).toHaveLength(8);

    for (const familia of [FAMILIA_CORPO, FAMILIA_CABECALHO]) {
      for (const peso of [400, 700]) {
        for (const estilo of ['normal', 'italic']) {
          expect(
            fontes.some((f) => f.familia === familia && f.peso === peso && f.estilo === estilo),
            `faltou ${familia} ${peso} ${estilo}`,
          ).toBe(true);
        }
      }
    }
  });

  it('todas as fontes são woff2 em data URI', () => {
    const css = buildFontFaceCss();
    const urls = css.match(/url\(([^)]+)\)/g) ?? [];
    expect(urls).toHaveLength(8);
    for (const u of urls) {
      expect(u.startsWith("url(data:font/woff2;base64,")).toBe(true);
    }
  });

  it('não faz requisição de rede — nenhuma URL http no CSS', () => {
    expect(buildFontFaceCss()).not.toMatch(/https?:\/\//);
  });

  it('gera uma declaração @font-face por variante, com font-display block', () => {
    const css = buildFontFaceCss();
    expect(css.match(/@font-face/g)).toHaveLength(8);
    expect(css.match(/font-display:block/g)).toHaveLength(8);
  });

  it('cada data URI tem conteúdo real (não é placeholder vazio)', () => {
    const css = buildFontFaceCss();
    for (const m of css.matchAll(/base64,([^)]+)\)/g)) {
      // menor fonte do conjunto tem ~17KB; base64 fica bem acima de 10k chars
      expect(m[1].length).toBeGreaterThan(10_000);
    }
  });

  it('as pilhas mantêm a fonte original como fallback para dev local', () => {
    expect(STACK_CORPO).toContain(FAMILIA_CORPO);
    expect(STACK_CORPO).toContain('Bookman Old Style');
    expect(STACK_CABECALHO).toContain(FAMILIA_CABECALHO);
    expect(STACK_CABECALHO).toContain('Times New Roman');
  });

  it('buildFontFaceCss é estável entre chamadas (cache)', () => {
    expect(buildFontFaceCss()).toBe(buildFontFaceCss());
  });
});
