/**
 * Extractor — usa LLM para extrair dados estruturados de texto livre.
 * temperature: 0 para máxima consistência na extração.
 *
 * Após extração: validação (Zod) e normalização são feitas pelo pipeline.
 */

import { callLLM } from './llm';
import { validateData, camposEssenciaisPreenchidos, CATEGORIAS_COM_LOCALIZACAO } from './validator';
import { normalizeData } from './normalizer';
import type { ExtractedData } from './types';

// ─────────────────────────────────────────────
// Prompt de extração — multi-categoria
// ─────────────────────────────────────────────

function buildExtractionPrompt(): string {
  return `Você é um extrator de dados para indicações legislativas da Câmara Municipal de Guarujá/SP.

Extraia SOMENTE o que está EXPLICITAMENTE mencionado no texto do usuário.
Retorne SOMENTE um JSON válido, sem texto adicional, sem markdown.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PASSO 1 — IDENTIFIQUE A CATEGORIA:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

"servico_urbano"    → serviços físicos de manutenção urbana: buraco no asfalto, limpeza de calçada/canal, iluminação pública, mato/vegetação, lixo/entulho, drenagem, asfalto, calçada
"seguranca_publica" → câmeras de monitoramento, policiamento, lombadas, sinalização viária, semáforos
"saude"             → UBS, medicamentos, equipamentos hospitalares, campanhas de saúde, CAPS, SAMU
"educacao"          → escolas, transporte escolar, cursos profissionalizantes, merenda, EMEF, EMEI
"cultura_lazer"     → patrimônio cultural, reconhecimento artístico, eventos culturais, praças de lazer, esporte, música, dança, teatro
"meio_ambiente"     → arborização, parques, áreas verdes, preservação ambiental, animais, resíduos sólidos
"homenagem"         → título honorífico, nome de rua/escola/praça para pessoa, medalha, diploma, moção
"outros"            → qualquer outro pedido legislativo que não se encaixe acima

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PASSO 2 — EXTRAIA OS CAMPOS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Retorne SEMPRE todos os campos abaixo. Para categorias sem localização, use "" nos campos de endereço e [] em tipos_servico.

{
  "categoria": string (enum: servico_urbano | seguranca_publica | saude | educacao | cultura_lazer | meio_ambiente | homenagem | outros),
  "tema": string (resumo em 1 linha clara do que está sendo pedido),
  "descricao_problema": string (reproduza o que o usuário descreveu, sem adicionar informações),
  "providencias_sugeridas": string[] (o que o usuário quer que aconteça, se mencionou),
  "observacoes_contextuais": string (apenas o que o usuário mencionou),
  "perguntas_faltantes": string[],
  "origem_solicitacao": string | null (quem originou o pedido — APENAS se explícito: "moradores", "comerciantes", "pais de alunos", "comunidade local" — use null se não mencionado),
  "tipo_problema": string | null (tipo específico do problema — APENAS se explícito: ex: "buraco", "infiltração", "mato alto", "canal entupido", "tampa quebrada" — use null se não especificado),

  "logradouro": string (nome da rua/avenida/praça — use "" se não necessário para esta categoria),
  "numero": string ("s/n" se não informado, "" se categoria não precisa),
  "bairro": string (nome do bairro — use "" se não necessário para esta categoria),
  "cidade": "Guarujá",
  "uf": "SP",
  "cep": string | null,
  "ponto_referencia": string | null,
  "trecho_localizacao": string | null (complemento de localização além do logradouro — ex: "atrás da Escola 1º de Maio", "final da rua", "próximo ao nº 150" — use null se ausente),

  "tipos_servico": string[] (lista com TODOS os serviços solicitados — enum por item: tapa_buraco | capinacao_rocada | iluminacao_publica | drenagem_galerias | limpeza_canal_desassoreamento | redutor_velocidade | retirada_lixo_entulho | fiscalizacao_transito | vulnerabilidade_social | estudo_tecnico | outro — use [] para categorias não-urbanas),
  "impactos": string[],
  "precisa_maquinario": boolean,
  "sugestao_maquinario": string[],
  "precisa_estudo_tecnico": boolean
}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REGRAS PARA perguntas_faltantes POR CATEGORIA:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

"servico_urbano":
  → logradouro é OBRIGATÓRIO — se ausente, pergunte: "Qual é o nome exato da rua, avenida ou logradouro onde está o problema?"
  → bairro é OBRIGATÓRIO — se ausente, pergunte: "Em qual bairro de Guarujá está localizado?"
  → tipos_servico vazio e tipo não claro → pergunte: "Qual serviço é necessário? (tapa-buraco, capinação, iluminação, limpeza de canal, retirada de lixo, ou outro?)"

"seguranca_publica":
  → bairro é importante — se ausente, pergunte: "Em qual bairro ou região de Guarujá é o pedido?"

"saude" / "educacao":
  → Se mencionou um estabelecimento específico, não precisa de endereço
  → Se vago, pergunte: "O pedido é para alguma unidade específica (UBS, escola, etc.) ou de forma geral?"

"cultura_lazer" / "homenagem" / "meio_ambiente" / "outros":
  → NUNCA peça rua/bairro — endereço não é necessário
  → Apenas pergunte se o tema estiver muito vago, ex: "Pode descrever melhor o que está sendo solicitado?"

LIMITE: máximo 2 perguntas por vez.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PROIBIÇÕES ABSOLUTAS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- NÃO inferir tipos_servico quando não explícito
- NÃO pedir endereço para categorias que não precisam
- NÃO inventar impactos, providências, origens ou detalhes não mencionados
- NÃO usar padrões de indicações anteriores

Retorne APENAS o JSON.`;
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

export function removeEmojis(text: string): string {
  return text.replace(
    /[\u{1F300}-\u{1FFFF}\u{2700}-\u{27BF}\u{FE00}-\u{FEFF}\u{1F900}-\u{1F9FF}]/gu,
    '',
  );
}

export function parseJSON(raw: string): unknown {
  const clean = raw
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();
  return JSON.parse(clean);
}

// ─────────────────────────────────────────────
// Extração principal
// ─────────────────────────────────────────────

/**
 * Extrai dados estruturados de um texto livre usando LLM.
 * Aplica validação (Zod) e normalização antes de retornar.
 *
 * @param textoUsuario  Texto original do relato
 * @param complementos  Respostas às perguntas faltantes (segunda chamada)
 */
export async function extractData(
  textoUsuario: string,
  complementos?: Record<string, string>,
): Promise<ExtractedData> {
  let input = textoUsuario;

  if (complementos && Object.keys(complementos).length > 0) {
    const extras = Object.entries(complementos)
      .map(([pergunta, resposta]) => `${pergunta}: ${resposta}`)
      .join('\n');
    input = `${textoUsuario}\n\nInformações complementares fornecidas pelo usuário:\n${extras}`;
  }

  const systemPrompt = buildExtractionPrompt();
  // temperature: 0 — extração determinística, sem variação
  const raw = await callLLM(systemPrompt, removeEmojis(input), 0);

  let rawJson: unknown;
  try {
    rawJson = parseJSON(raw);
  } catch (parseErr) {
    console.error('[extract] JSON inválido, pedindo correção:', parseErr);
    const correcao = await callLLM(
      'Corrija o seguinte texto para que seja um JSON válido, sem texto adicional:',
      raw,
      0,
    );
    rawJson = parseJSON(correcao);
  }

  // ── Validação (Zod) + Retrocompatibilidade ─────────────────
  const validated = validateData(rawJson);

  // ── Normalização ────────────────────────────────────────────
  const normalized = normalizeData(validated);

  // ── Verificação de campos faltantes por categoria ───────────
  const faltantes: string[] = [...normalized.perguntas_faltantes];
  const needsLocation = CATEGORIAS_COM_LOCALIZACAO.includes(normalized.categoria);

  if (needsLocation) {
    if (!normalized.logradouro && !faltantes.some(p => p.toLowerCase().includes('rua') || p.toLowerCase().includes('logradouro'))) {
      faltantes.push('Qual é o nome exato da rua, avenida ou logradouro onde está o problema?');
    }
    if (!normalized.bairro && !faltantes.some(p => p.toLowerCase().includes('bairro'))) {
      faltantes.push('Em qual bairro de Guarujá está localizado?');
    }
  }

  if (!normalized.descricao_problema && !normalized.tema && !faltantes.some(p => p.toLowerCase().includes('detalh') || p.toLowerCase().includes('solicit'))) {
    faltantes.push('Pode descrever com mais detalhes o que está sendo solicitado?');
  }

  // Limita a 2 perguntas
  normalized.perguntas_faltantes = faltantes.slice(0, 2);
  return normalized;
}

// Re-exporta para uso legado (route.ts usa camposEssenciaisPreenchidos de extract)
export { camposEssenciaisPreenchidos } from './validator';
