/**
 * LLM Adapter — suporta Anthropic Claude e OpenAI.
 * Troque o provider via LLM_PROVIDER=anthropic|openai no .env
 */

export interface LLMMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface LLMConfig {
  apiKey: string;
  model: string;
  provider: 'anthropic' | 'openai';
  maxTokens?: number;
  timeoutMs?: number;
}

/** Config para extração — modelo barato e rápido */
function getExtractConfig(): LLMConfig {
  const apiKey = process.env.LLM_API_KEY ?? '';
  const provider = (process.env.LLM_PROVIDER ?? 'anthropic') as 'anthropic' | 'openai';
  const model =
    process.env.LLM_MODEL_EXTRACT ??
    (provider === 'anthropic' ? 'claude-3-5-haiku-20241022' : 'gpt-4o-mini');

  return { apiKey, model, provider, maxTokens: 2048, timeoutMs: 30_000 };
}

/** Config para geração — modelo mais capaz para texto legislativo formal */
function getGenerateConfig(): LLMConfig {
  const apiKey = process.env.LLM_API_KEY ?? '';
  const provider = (process.env.LLM_PROVIDER ?? 'anthropic') as 'anthropic' | 'openai';
  const model =
    process.env.LLM_MODEL_GENERATE ??
    (provider === 'anthropic' ? 'claude-sonnet-4-5-20250514' : 'gpt-4o');

  return { apiKey, model, provider, maxTokens: 2048, timeoutMs: 45_000 };
}

async function callAnthropic(
  systemPrompt: string,
  userMessage: string,
  cfg: LLMConfig,
  temperature?: number,
): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), cfg.timeoutMs ?? 30_000);

  try {
    const body: Record<string, unknown> = {
      model: cfg.model,
      max_tokens: cfg.maxTokens ?? 2048,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    };
    if (temperature !== undefined) body.temperature = temperature;

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'x-api-key': cfg.apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Anthropic API error ${res.status}: ${text}`);
    }

    const data = await res.json();
    return data.content?.[0]?.text ?? '';
  } finally {
    clearTimeout(timer);
  }
}

async function callOpenAI(
  systemPrompt: string,
  userMessage: string,
  cfg: LLMConfig,
  temperature?: number,
): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), cfg.timeoutMs ?? 30_000);

  try {
    const body: Record<string, unknown> = {
      model: cfg.model,
      max_tokens: cfg.maxTokens ?? 2048,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
    };
    if (temperature !== undefined) body.temperature = temperature;

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${cfg.apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`OpenAI API error ${res.status}: ${text}`);
    }

    const data = await res.json();
    return data.choices?.[0]?.message?.content ?? '';
  } finally {
    clearTimeout(timer);
  }
}

/** Executa a chamada com retry (1 retry em erro transitório) usando a config fornecida. */
async function callWithRetry(
  systemPrompt: string,
  userMessage: string,
  cfg: LLMConfig,
  temperature?: number,
): Promise<string> {
  if (!cfg.apiKey) {
    throw new Error(
      'LLM_API_KEY não configurada. Defina a variável de ambiente no arquivo .env',
    );
  }

  const attempt = async () => {
    if (cfg.provider === 'anthropic') {
      return callAnthropic(systemPrompt, userMessage, cfg, temperature);
    }
    return callOpenAI(systemPrompt, userMessage, cfg, temperature);
  };

  try {
    return await attempt();
  } catch (err) {
    // 1 retry para erros transitórios (timeout, 5xx)
    const isTransient =
      err instanceof Error &&
      (err.name === 'AbortError' || err.message.includes('5'));
    if (isTransient) {
      console.error('[LLM] Erro transitório, tentando novamente...', err);
      await new Promise((r) => setTimeout(r, 1500));
      return attempt();
    }
    throw err;
  }
}

/**
 * Chama o LLM para extração — usa modelo barato (Haiku / gpt-4o-mini).
 * @param temperature  0 = determinístico; 1 = criativo. Default: provider default (não enviado).
 */
export async function callLLM(
  systemPrompt: string,
  userMessage: string,
  temperature?: number,
): Promise<string> {
  return callWithRetry(systemPrompt, userMessage, getExtractConfig(), temperature);
}

/**
 * Chama o LLM para geração de texto formal — usa modelo mais capaz (Sonnet / gpt-4o).
 * @param temperature  0 = determinístico; 1 = criativo. Default: provider default (não enviado).
 */
export async function callLLMGenerate(
  systemPrompt: string,
  userMessage: string,
  temperature?: number,
): Promise<string> {
  return callWithRetry(systemPrompt, userMessage, getGenerateConfig(), temperature);
}

export function isDemoMode(): boolean {
  return !process.env.LLM_API_KEY;
}
