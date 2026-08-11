import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * A ementa é o campo "Assunto" do protocolo e segue uma fórmula fixa da Câmara
 * (ver docs/siscam-camara-guaruja.md). Estes testes travam o formato e, acima de
 * tudo, a garantia de que uma falha aqui nunca derruba a geração da indicação.
 */

const mocks = vi.hoisted(() => ({ callLLM: vi.fn() }));
vi.mock('@/lib/llm', () => ({ callLLM: mocks.callLLM, isDemoMode: () => false }));

import { gerarEmenta, limparEmenta, PREFIXO_EMENTA } from '@/lib/ementa';
import { makeExtracted } from '../helpers/fixtures';

const EMENTA_OK =
  'Solicita do Executivo que determine à Secretaria competente, providências visando a execução de operação tapa-buraco na Rua das Flores, nº 120, Jardim Três Marias.';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.callLLM.mockResolvedValue(EMENTA_OK);
});

describe('limparEmenta', () => {
  it('remove aspas ao redor', () => {
    expect(limparEmenta(`"${EMENTA_OK}"`)).toBe(EMENTA_OK);
    expect(limparEmenta(`“${EMENTA_OK}”`)).toBe(EMENTA_OK);
  });

  it('remove rótulo "Ementa:" / "Assunto:"', () => {
    expect(limparEmenta(`Ementa: ${EMENTA_OK}`)).toBe(EMENTA_OK);
    expect(limparEmenta(`Assunto: ${EMENTA_OK}`)).toBe(EMENTA_OK);
  });

  it('remove cercas de markdown', () => {
    expect(limparEmenta("```\n" + EMENTA_OK + "\n```")).toBe(EMENTA_OK);
  });

  it('colapsa quebras de linha — a ementa é uma frase só', () => {
    const comQuebras = EMENTA_OK.replace(', providências', ',\n  providências');
    expect(limparEmenta(comQuebras)).toBe(EMENTA_OK);
  });

  it('remove o despacho que a Casa acrescenta depois', () => {
    const comDespacho = `${EMENTA_OK} À SECRETARIA PARA AS DEVIDAS PROVIDÊNCIAS.`;
    expect(limparEmenta(comDespacho)).toBe(EMENTA_OK);
  });

  it('garante ponto final', () => {
    expect(limparEmenta('Solicita algo sem ponto')).toMatch(/\.$/);
  });
});

describe('gerarEmenta', () => {
  it('devolve a ementa no padrão da Câmara', async () => {
    const ementa = await gerarEmenta(makeExtracted());
    expect(ementa).toBe(EMENTA_OK);
    expect(ementa.startsWith(PREFIXO_EMENTA)).toBe(true);
  });

  it('usa temperature 0 — é preenchimento de fórmula, não redação criativa', async () => {
    await gerarEmenta(makeExtracted());
    expect(mocks.callLLM).toHaveBeenCalledWith(expect.any(String), expect.any(String), 0);
  });

  it('manda o padrão e os exemplos reais no system prompt', async () => {
    await gerarEmenta(makeExtracted());
    const [system] = mocks.callLLM.mock.calls[0];
    expect(system).toContain(PREFIXO_EMENTA);
    expect(system).toContain('EXEMPLOS REAIS');
    expect(system).toMatch(/À SECRETARIA PARA AS DEVIDAS PROVIDÊNCIAS/); // instrução de NÃO incluir
  });

  it('inclui a localização no prompt quando existe', async () => {
    await gerarEmenta(makeExtracted({
      logradouro: 'Rua das Flores', numero: '120', bairro: 'Jardim Três Marias',
    }));
    const [, user] = mocks.callLLM.mock.calls[0];
    expect(user).toContain('Rua das Flores');
    expect(user).toContain('nº 120');
    expect(user).toContain('Jardim Três Marias');
  });

  it('omite o número quando é "s/n"', async () => {
    await gerarEmenta(makeExtracted({ logradouro: 'Rua X', numero: 's/n', bairro: 'Centro' }));
    const [, user] = mocks.callLLM.mock.calls[0];
    expect(user).not.toContain('s/n');
  });

  // ── O ponto crítico: a ementa é complemento, não pode derrubar a geração ──

  it('devolve string vazia quando o LLM falha, sem lançar', async () => {
    mocks.callLLM.mockRejectedValue(new Error('timeout na API'));
    await expect(gerarEmenta(makeExtracted())).resolves.toBe('');
  });

  it('descarta resposta curta demais para ser uma ementa', async () => {
    mocks.callLLM.mockResolvedValue('Tapa-buraco.');
    expect(await gerarEmenta(makeExtracted())).toBe('');
  });

  it('descarta resposta vazia', async () => {
    mocks.callLLM.mockResolvedValue('   ');
    expect(await gerarEmenta(makeExtracted())).toBe('');
  });
});
