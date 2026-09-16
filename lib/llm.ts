/**
 * LLM Adapter — suporta Anthropic Claude e OpenAI.
 * Troque o provider via LLM_PROVIDER=anthropic|openai no .env
 */

/**
 * Modelos Anthropic que ainda aceitam temperature/top_p/top_k. A partir da
 * geracao Claude 5 esses parametros foram removidos e a API responde 400.
 */
const ACEITA_TEMPERATURE = /^claude-(3|haiku-4-5|opus-4-5|sonnet-4-5|opus-4-6|sonnet-4-6)/;

/**
 * Modelos com raciocinio interno ligado por padrao, que aceitam
 * output_config.effort. Haiku 4.5 e os modelos 4.5 antigos recusam o campo.
 */
const RACIOCINA = /^claude-(opus-5|sonnet-5|opus-4-[678]|fable)/;

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
    (provider === 'anthropic' ? 'claude-haiku-4-5' : 'gpt-4o-mini');

  return { apiKey, model, provider, maxTokens: 2048, timeoutMs: 30_000 };
}

/** Config para geração — modelo mais capaz para texto legislativo formal */
function getGenerateConfig(): LLMConfig {
  const apiKey = process.env.LLM_API_KEY ?? '';
  const provider = (process.env.LLM_PROVIDER ?? 'anthropic') as 'anthropic' | 'openai';
  const model =
    process.env.LLM_MODEL_GENERATE ??
    (provider === 'anthropic' ? 'claude-opus-5' : 'gpt-4o');

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
    // A geracao Claude 5 removeu os parametros de amostragem: mandar
    // temperature nesses modelos devolve HTTP 400. So enviamos para quem aceita.
    if (temperature !== undefined && ACEITA_TEMPERATURE.test(cfg.model)) {
      body.temperature = temperature;
    }

    // Nos modelos que raciocinam, o esforco controla quanto o modelo pensa
    // antes de responder. Aqui o gargalo e a latencia do serverless e o texto
    // segue a formula do gabinete, entao 'low' e o padrao. Ajuste por LLM_EFFORT.
    if (RACIOCINA.test(cfg.model)) {
      body.output_config = { effort: process.env.LLM_EFFORT ?? 'low' };
      // O raciocinio sai do mesmo orcamento de saida: com 2048 a indicacao
      // corria risco de terminar cortada no meio.
      body.max_tokens = Math.max(cfg.maxTokens ?? 2048, 8192);
    }

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
    // Nao pegue content[0]: nos modelos que raciocinam o primeiro bloco e o de
    // thinking e vem com texto vazio. O texto da resposta e o bloco 'text'.
    const blocos: Array<{ type?: string; text?: string }> = data.content ?? [];
    return blocos.find((b) => b.type === 'text')?.text ?? '';
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
