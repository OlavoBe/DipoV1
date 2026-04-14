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
