import { describe, it, expect, vi, afterEach } from 'vitest';

/**
 * Testa a lógica de configuração do LLM adapter.
 * Não faz chamadas reais de rede — valida apenas a seleção de modelos.
 */

// Utilitário para limpar o módulo e setar env vars
function loadLlmWithEnv(env: Record<string, string | undefined>) {
  Object.assign(process.env, env);
  // Força reimport para pegar os novos valores de env
  return import('@/lib/llm?t=' + Math.random());
}

afterEach(() => {
  // Limpa as variáveis após cada teste
  delete process.env.LLM_PROVIDER;
  delete process.env.LLM_API_KEY;
  delete process.env.LLM_MODEL_EXTRACT;
  delete process.env.LLM_MODEL_GENERATE;
  delete process.env.TEST_MODE;
  delete process.env.LLM_FAKE;
});

describe('isDemoMode', () => {
  it('retorna true quando LLM_API_KEY não está definida', async () => {
    delete process.env.LLM_API_KEY;
    const { isDemoMode } = await import('@/lib/llm');
    expect(isDemoMode()).toBe(true);
  });

  it('retorna false quando LLM_API_KEY está definida', async () => {
    process.env.LLM_API_KEY = 'sk-test-key';
    const { isDemoMode } = await import('@/lib/llm');
    expect(isDemoMode()).toBe(false);
    delete process.env.LLM_API_KEY;
  });
});

describe('callLLM — erro sem API key', () => {
  it('lança erro descritivo quando LLM_API_KEY ausente', async () => {
    delete process.env.LLM_API_KEY;
    const { callLLM } = await import('@/lib/llm');
    await expect(callLLM('system', 'user')).rejects.toThrow('LLM_API_KEY');
  });
});

describe('callLLMGenerate — erro sem API key', () => {
  it('lança erro descritivo quando LLM_API_KEY ausente', async () => {
    delete process.env.LLM_API_KEY;
    const { callLLMGenerate } = await import('@/lib/llm');
    await expect(callLLMGenerate('system', 'user')).rejects.toThrow('LLM_API_KEY');
  });
});

/**
 * O provider falso do E2E existe porque o CI não pode chamar a API do modelo.
 * O risco que ele cria é ligar sem querer em produção e o gabinete receber
 * texto fixo achando que é geração real — por isso são dois cadeados, e por
 * isso eles são testados: meio caminho não pode abrir a porta.
 */
describe('provider falso (E2E)', () => {
  it('fica desligado sem nenhuma das variáveis', async () => {
    const { isFakeLLM } = await import('@/lib/llm');
    expect(isFakeLLM()).toBe(false);
  });

  it('fica desligado só com TEST_MODE', async () => {
    process.env.TEST_MODE = 'true';
    const { isFakeLLM } = await import('@/lib/llm');
    expect(isFakeLLM()).toBe(false);
  });

  it('fica desligado só com LLM_FAKE', async () => {
    process.env.LLM_FAKE = 'true';
    const { isFakeLLM } = await import('@/lib/llm');
    expect(isFakeLLM()).toBe(false);
  });

  it('liga com as duas juntas', async () => {
    process.env.TEST_MODE = 'true';
    process.env.LLM_FAKE = 'true';
    const { isFakeLLM } = await import('@/lib/llm');
    expect(isFakeLLM()).toBe(true);
  });

  it('responde sem API key e sem rede quando ligado', async () => {
    process.env.TEST_MODE = 'true';
    process.env.LLM_FAKE = 'true';
    delete process.env.LLM_API_KEY;
    const { callLLM, callLLMGenerate } = await import('@/lib/llm');

    // Extração: JSON parseável com os campos que o pipeline exige.
    const extraido = JSON.parse(
      await callLLM('Você é um extrator de dados para indicações…', 'buraco na Rua das Flores'),
    );
    expect(extraido.categoria).toBe('servico_urbano');
    expect(extraido.logradouro).toMatch(/Rua das Flores/i);

    // Ementa: começa com o prefixo obrigatório da Casa.
    const ementa = await callLLM('Você redige a EMENTA de indicações…', 'qualquer coisa');
    expect(ementa.startsWith('Solicita do Executivo que determine à Secretaria competente, providências')).toBe(true);

    // Geração: texto marcado, para nunca ser confundido com saída real.
    const texto = await callLLMGenerate('Você redige indicações legislativas…', 'qualquer coisa');
    expect(texto).toContain('[LLM_FAKE]');
  });
});
