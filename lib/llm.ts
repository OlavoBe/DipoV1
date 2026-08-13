/**
 * LLM Adapter.
 *
 * **O Dipo roda em OpenAI** — é o provider padrão e o único em uso. O caminho
 * da Anthropic continua no código como alternativa, mas não é exercitado: ao
 * mexer aqui, o que precisa continuar funcionando é o `openai`.
 *
 * Troque via `LLM_PROVIDER=openai|anthropic` no .env.
 *
 * Existe ainda um terceiro caminho, `callFake`, usado só quando
 * `TEST_MODE=true` **e** `LLM_FAKE=true` — ver a seção "Provider falso".
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

/**
 * Provider padrão.
 *
 * Era `anthropic`, o que não correspondia à realidade: o `.env` sempre setou
 * `openai`. A divergência escondia um problema — o default de extração da
 * Anthropic apontava para `claude-3-5-haiku-20241022`, aposentado em
 * 19/02/2026, que responde 404. Como o `.env` de produção define o provider,
 * nada quebrou; mas qualquer ambiente novo sem `.env` completo cairia nesse id
 * morto. O default agora é o provider real.
 */
const PROVIDER_PADRAO = 'openai' as const;

function getProvider(): 'anthropic' | 'openai' {
  return (process.env.LLM_PROVIDER ?? PROVIDER_PADRAO) as 'anthropic' | 'openai';
}

/** Config para extração — modelo barato e rápido */
function getExtractConfig(): LLMConfig {
  const apiKey = process.env.LLM_API_KEY ?? '';
  const provider = getProvider();
  const model =
    process.env.LLM_MODEL_EXTRACT ??
    (provider === 'anthropic' ? 'claude-haiku-4-5' : 'gpt-4o-mini');

  return { apiKey, model, provider, maxTokens: 2048, timeoutMs: 30_000 };
}

/** Config para geração — modelo mais capaz para texto legislativo formal */
function getGenerateConfig(): LLMConfig {
  const apiKey = process.env.LLM_API_KEY ?? '';
  const provider = getProvider();
  const model =
    process.env.LLM_MODEL_GENERATE ??
    (provider === 'anthropic' ? 'claude-sonnet-4-5-20250929' : 'gpt-4o');

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

// ─────────────────────────────────────────────
// Provider falso — só para E2E
// ─────────────────────────────────────────────

/**
 * Os testes E2E precisam do fluxo inteiro de pé: servidor, banco, sessão, rota,
 * pipeline e render. A única peça que não dá para levar ao CI é a chamada ao
 * LLM — custa dinheiro, exige segredo no repositório, é lenta e, por ser não
 * determinística, transformaria o E2E em teste intermitente.
 *
 * Este provider devolve respostas fixas e válidas para os três pontos em que o
 * pipeline chama o modelo (extração, geração e ementa), o que deixa o E2E
 * exercitar tudo o que é nosso e nada do que é da OpenAI/Anthropic.
 *
 * Segue o mesmo padrão do `/test-login`: **inerte em produção**, e por dois
 * cadeados independentes — exige `TEST_MODE=true` E `LLM_FAKE=true`. Nenhum
 * dos dois existe no ambiente da Vercel, e um sozinho não liga nada.
 */
export function isFakeLLM(): boolean {
  return process.env.TEST_MODE === 'true' && process.env.LLM_FAKE === 'true';
}

const EMENTA_FAKE_PREFIXO =
  'Solicita do Executivo que determine à Secretaria competente, providências';

function callFake(systemPrompt: string, userMessage: string): string {
  // Ementa: prompt declara o papel logo na primeira linha.
  if (/EMENTA/i.test(systemPrompt)) {
    return `${EMENTA_FAKE_PREFIXO} visando a execução de operação tapa-buraco na Rua das Flores, nº 120, Jardim Três Marias.`;
  }

  // Extração: o único prompt que pede JSON de volta.
  if (/extrator de dados/i.test(systemPrompt)) {
    // Aproveita o que o usuário digitou para o teste conseguir afirmar que o
    // texto dele chegou até o fim do pipeline.
    const logradouro = userMessage.match(/\b(?:rua|avenida|av\.?|praça)\s+[A-ZÀ-Ú][^\n,.;]{2,40}/i)?.[0]?.trim()
      ?? 'Rua das Flores';
    const bairro = userMessage.match(/bairro\s+([^\n,.;]{2,40})/i)?.[1]?.trim()
      ?? 'Jardim Três Marias';

    return JSON.stringify({
      categoria: 'servico_urbano',
      tema: `Serviço urbano na ${logradouro}`,
      descricao_problema: userMessage.slice(0, 300),
      providencias_sugeridas: ['Execução de operação tapa-buraco'],
      observacoes_contextuais: '',
      perguntas_faltantes: [],
      origem_solicitacao: 'moradores',
      tipo_problema: 'buraco no asfalto',
      logradouro,
      numero: '120',
      bairro,
      cidade: 'Guarujá',
      uf: 'SP',
      cep: null,
      ponto_referencia: null,
      trecho_localizacao: null,
      tipos_servico: ['tapa_buraco'],
      impactos: ['risco de acidentes'],
      precisa_maquinario: true,
      sugestao_maquinario: ['caminhão de massa asfáltica'],
      precisa_estudo_tecnico: false,
    });
  }

  // Geração do corpo do documento.
  return [
    'Senhor Presidente,',
    '',
    'Indico à Mesa, nos termos regimentais, seja oficiado ao Senhor Prefeito Municipal',
    'para que determine à Secretaria competente as providências necessárias visando a',
    'execução de operação tapa-buraco na Rua das Flores, nº 120, Jardim Três Marias,',
    'neste município.',
    '',
    'JUSTIFICATIVA',
    '',
    'Fomos procurados por moradores da região que relataram a existência de buraco no',
    'leito carroçável, o que oferece risco de acidentes a motociclistas e pedestres.',
    '',
    '[LLM_FAKE] Texto determinístico gerado para os testes E2E.',
  ].join('\n');
}

/** Executa a chamada com retry (1 retry em erro transitório) usando a config fornecida. */
async function callWithRetry(
  systemPrompt: string,
  userMessage: string,
  cfg: LLMConfig,
  temperature?: number,
): Promise<string> {
  if (isFakeLLM()) {
    console.warn('[LLM] TEST_MODE + LLM_FAKE ativos — respondendo sem chamar o modelo.');
    return callFake(systemPrompt, userMessage);
  }

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
