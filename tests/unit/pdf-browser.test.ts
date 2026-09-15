import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { abrirPaginaResiliente, browserCaiu } from '@/lib/pdf';

/**
 * O browser é reaproveitado entre invocações da mesma instância quente, e o
 * `isConnected()` do Playwright não é confiável para saber se ele ainda serve.
 *
 * Em produção, metade das requisições voltava com "Target page, context or
 * browser has been closed", sempre alternando entre as instâncias: o
 * `newPage()` ficava fora do `try`, o browser morto nunca era descartado e
 * aquela instância respondia 500 até a Vercel reciclá-la.
 *
 * Estes testes travam a política que substituiu isso — quem decide se o browser
 * serve é o `newPage()`, e um cache podre não pode virar erro para o usuário.
 */

const MORTO = new Error('Target page, context or browser has been closed');

/** Browser de mentira: abre página ou falha, conforme programado. */
function browserFake(resultados: Array<'ok' | Error>) {
  let i = 0;
  return {
    newPage: async () => {
      const r = resultados[Math.min(i++, resultados.length - 1)];
      if (r instanceof Error) throw r;
      return { id: `pagina-${i}` };
    },
  };
}

describe('abrirPaginaResiliente', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('devolve a página e não descarta nada quando o browser está vivo', async () => {
    const descartar = vi.fn();
    const obter = vi.fn(async () => browserFake(['ok']));

    const pagina = await abrirPaginaResiliente(obter, descartar);

    expect(pagina).toEqual({ id: 'pagina-1' });
    expect(descartar).not.toHaveBeenCalled();
    expect(obter).toHaveBeenCalledTimes(1);
  });

  it('descarta o browser morto e entrega a página do novo', async () => {
    const descartar = vi.fn();
    // Primeira chamada devolve o browser podre; a segunda, um browser novo.
    const obter = vi
      .fn()
      .mockResolvedValueOnce(browserFake([MORTO]))
      .mockResolvedValueOnce(browserFake(['ok']));

    const pagina = await abrirPaginaResiliente(obter, descartar);

    expect(pagina).toEqual({ id: 'pagina-1' });
    expect(descartar).toHaveBeenCalledTimes(1);
    expect(obter).toHaveBeenCalledTimes(2);
  });

  it('não deixa o browser novo em cache quando ele também falha', async () => {
    const descartar = vi.fn();
    const obter = vi.fn(async () => browserFake([MORTO]));

    await expect(abrirPaginaResiliente(obter, descartar)).rejects.toThrow(
      'Target page, context or browser has been closed',
    );

    // Dois descartes: o do cache podre e o do browser recém-lançado. Sem o
    // segundo, a instância herdaria um browser quebrado e voltaria a responder
    // 500 indefinidamente — que era exatamente o bug.
    expect(descartar).toHaveBeenCalledTimes(2);
    expect(obter).toHaveBeenCalledTimes(2);
  });

  it('tenta no máximo duas vezes, sem laço infinito', async () => {
    const obter = vi.fn(async () => browserFake([MORTO]));

    await expect(abrirPaginaResiliente(obter, vi.fn())).rejects.toThrow();

    expect(obter).toHaveBeenCalledTimes(2);
  });
});

describe('browserCaiu', () => {
  // Decide se vale gastar a segunda tentativa com um browser novo. Erro de
  // conteúdo não pode entrar aqui: repetir só dobraria o tempo até o 500.
  it('reconhece a queda do browser no meio da renderização', () => {
    expect(
      browserCaiu(new Error('page.setContent: Target page, context or browser has been closed\nCall log:')),
    ).toBe(true);
    expect(browserCaiu(new Error('page.pdf: Target crashed'))).toBe(true);
  });

  it('não confunde outros erros com queda do browser', () => {
    expect(browserCaiu(new Error('page.setContent: Timeout 30000ms exceeded'))).toBe(false);
    expect(browserCaiu(new Error('Indicação não encontrada'))).toBe(false);
  });
});
