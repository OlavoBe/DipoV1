import { describe, it, expect } from 'vitest';

/**
 * Testa as funções puras exportáveis de lib/generate.ts.
 * buildProvidenciasFromTipos e selectBestExemplo são internas —
 * testamos o comportamento via generateTexto com mocks do LLM.
 *
 * As funções públicas testadas aqui são as auxiliares extraíveis
 * que podem ser movidas para um módulo separado (lib/generate-utils.ts)
 * quando crescer o projeto. Por ora testamos o mapeamento PROVIDENCIAS_MAP
 * de forma indireta.
 */

// Mocks de dependências externas (LLM + template + filesystem)
import { vi } from 'vitest';

vi.mock('@/lib/llm', () => ({
  callLLMGenerate: vi.fn().mockResolvedValue(
    'Sr. Presidente,\nSras. Vereadoras e\nSrs. Vereadores.\n\nINDICAÇÃO Nº ____ /2026\n\nIndicamos...\n\nSala Alberto Santos Dumont, 14 de abril de 2026.',
  ),
}));

vi.mock('@/lib/template', () => ({
  getTemplate: vi.fn().mockResolvedValue({
    vereador: { nome: 'EDMAR LIMA DOS SANTOS', cargo: 'Vereador', nomePrefeito: 'Farid Said Madi', salaLocal: 'Sala Alberto Santos Dumont' },
    institution: { name: 'Câmara Municipal de Guarujá' },
  }),
}));

// fs.existsSync retorna false → sem few-shot (ambiente de teste sem data/)
vi.mock('fs', () => ({
  default: {
    existsSync: vi.fn().mockReturnValue(false),
    readdirSync: vi.fn().mockReturnValue([]),
    readFileSync: vi.fn().mockReturnValue('{}'),
  },
  existsSync: vi.fn().mockReturnValue(false),
  readdirSync: vi.fn().mockReturnValue([]),
  readFileSync: vi.fn().mockReturnValue('{}'),
}));

import { generateTexto } from '@/lib/generate';
import { makeExtracted } from '../helpers/fixtures';

describe('generateTexto', () => {
  it('retorna string não-vazia para dados válidos', async () => {
    const result = await generateTexto(makeExtracted());
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(10);
  });

  it('remove blocos de código markdown do resultado', async () => {
    const { callLLMGenerate } = await import('@/lib/llm');
    (callLLMGenerate as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      '```\nINDICAÇÃO Nº ____ /2026\n```',
    );
    const result = await generateTexto(makeExtracted());
    expect(result).not.toContain('```');
  });

  it('aceita vereadorSlug sem lançar exceção', async () => {
    await expect(generateTexto(makeExtracted(), undefined, 'juninho_eroso')).resolves.toBeTruthy();
  });

  it('aceita vereadorSlug = "outro" sem lançar exceção', async () => {
    await expect(generateTexto(makeExtracted(), undefined, 'outro')).resolves.toBeTruthy();
  });

  it('aceita vereadorSlug = undefined (fallback genérico)', async () => {
    await expect(generateTexto(makeExtracted(), undefined, undefined)).resolves.toBeTruthy();
  });

  it('trunca textos acima de 3200 caracteres', async () => {
    const { callLLMGenerate } = await import('@/lib/llm');
    const textoLongo = 'A'.repeat(4000) + '\n' + 'B'.repeat(100);
    (callLLMGenerate as ReturnType<typeof vi.fn>).mockResolvedValueOnce(textoLongo);
    const result = await generateTexto(makeExtracted());
    expect(result.length).toBeLessThanOrEqual(3200);
  });

  it('funciona para categoria cultura_lazer (sem localização)', async () => {
    const data = makeExtracted({
      categoria: 'cultura_lazer',
      logradouro: '',
      bairro: '',
      tema: 'Patrimônio imaterial',
    });
    await expect(generateTexto(data)).resolves.toBeTruthy();
  });
});
