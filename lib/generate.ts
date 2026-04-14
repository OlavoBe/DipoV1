/**
 * Generator — constrói e executa o prompt de geração da indicação legislativa.
 * Usa few-shot learning com exemplos históricos para melhor aderência ao padrão do gabinete.
 * temperature: 0.2 — texto formal com baixa variação mas linguagem natural.
 */

import fs from 'fs';
import path from 'path';
import { callLLMGenerate } from './llm';
import { getTemplate } from './template';
import { getVereadorPerfil } from './vereadores';
import type { ExtractedData, IndicacaoCategoria } from './types';

// ─────────────────────────────────────────────
// Labels amigáveis de categoria
// ─────────────────────────────────────────────

const CATEGORIA_LABEL: Record<IndicacaoCategoria, string> = {
  servico_urbano:    'Serviços Urbanos',
  seguranca_publica: 'Segurança Pública',
  saude:             'Saúde',
  educacao:          'Educação',
  cultura_lazer:     'Cultura e Lazer',
  meio_ambiente:     'Meio Ambiente',
  homenagem:         'Homenagem / Reconhecimento',
  outros:            'Outros',
};

// ─────────────────────────────────────────────
// Providências semi-determinísticas
// Reduz alucinação na lista de providências
// ─────────────────────────────────────────────

const PROVIDENCIAS_MAP: Record<string, string | null> = {
  tapa_buraco:                   'Execução de operação tapa-buraco',
  capinacao_rocada:              'Capinação e roçada',
  iluminacao_publica:            'Verificação e manutenção da iluminação pública',
  drenagem_galerias:             'Manutenção e desobstrução das galerias de drenagem',
  limpeza_canal_desassoreamento: 'Limpeza e desassoreamento do canal, com utilização de maquinário apropriado',
  redutor_velocidade:            'Instalação de redutor de velocidade, mediante estudo técnico de engenharia de tráfego',
  retirada_lixo_entulho:         'Retirada de resíduos e entulho, com reforço na fiscalização da área',
  fiscalizacao_transito:         'Reforço na fiscalização de trânsito',
  vulnerabilidade_social:        'Atenção às pessoas em situação de vulnerabilidade social na localidade',
  estudo_tecnico:                'Realização de estudo técnico pelo setor competente',
  outro:                         null, // "outro" não gera providência automática — a IA decide
};

/** Converte tipos_servico em providências prontas para inserção no prompt */
function buildProvidenciasFromTipos(tipos: string[]): string[] {
  return tipos
    .map(t => PROVIDENCIAS_MAP[t] ?? null)
    .filter((p): p is string => p !== null);
}

// ─────────────────────────────────────────────
// Few-shot learning — exemplos históricos
// ─────────────────────────────────────────────

interface IndicacaoExemplo {
  vereador_slug?: string;
  categoria: string;
  tipos_servico: string[];
  descricao: string;
  texto_gerado: string;
}

/**
 * Lê todos os JSONs de um diretório e retorna como exemplos.
 */
function loadExemplosFromDir(dir: string): IndicacaoExemplo[] {
  if (!fs.existsSync(dir)) return [];
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
  const exemplos: IndicacaoExemplo[] = [];
  for (const file of files) {
    try {
      const content = fs.readFileSync(path.join(dir, file), 'utf-8');
      exemplos.push(JSON.parse(content) as IndicacaoExemplo);
    } catch {
      // ignora arquivos malformados
    }
  }
  return exemplos;
}

/**
 * Seleciona o melhor exemplo de uma lista para a categoria/tipos_servico informados.
 */
function selectBestExemplo(
  exemplos: IndicacaoExemplo[],
  categoria: IndicacaoCategoria,
  tiposServico: string[],
): IndicacaoExemplo[] {
  // Prioridade 1: mesma categoria + interseção de tipos_servico
  const comIntersecao = exemplos.filter(e =>
    e.categoria === categoria &&
    e.tipos_servico.some(t => tiposServico.includes(t)),
  );
  if (comIntersecao.length > 0) return comIntersecao.slice(0, 1);

  // Prioridade 2: mesma categoria
  const mesmaCategoria = exemplos.filter(e => e.categoria === categoria);
  if (mesmaCategoria.length > 0) return mesmaCategoria.slice(0, 1);

  // Fallback: qualquer servico_urbano (mais comum)
  const urbanos = exemplos.filter(e => e.categoria === 'servico_urbano');
  return urbanos.slice(0, 1);
}

/**
 * Carrega exemplos históricos relevantes.
 * - Se vereadorSlug for fornecido e a subpasta existir, usa exemplos do vereador.
 * - Se não houver exemplos específicos, cai para generico/.
 * - Se vereadorSlug for undefined ou 'outro', usa direto generico/.
 */
function loadFewShotExamples(
  categoria: IndicacaoCategoria,
  tiposServico: string[],
  vereadorSlug?: string,
): IndicacaoExemplo[] {
  const baseDir = path.join(process.cwd(), 'data', 'indicacoes_exemplo');
  const genericoDir = path.join(baseDir, 'generico');

  // Tenta carregar exemplos do vereador específico
  if (vereadorSlug && vereadorSlug !== 'outro') {
    const vereadorDir = path.join(baseDir, vereadorSlug);
    const exemplos = loadExemplosFromDir(vereadorDir);
    if (exemplos.length > 0) {
      return selectBestExemplo(exemplos, categoria, tiposServico);
    }
  }

  // Fallback: generico/
  const exemplos = loadExemplosFromDir(genericoDir);
  return selectBestExemplo(exemplos, categoria, tiposServico);
}

/** Formata exemplos históricos para injeção no system prompt */
function buildFewShotBlock(exemplos: IndicacaoExemplo[]): string {
  if (exemplos.length === 0) return '';
  const blocos = exemplos.map(e =>
    `EXEMPLO DE INDICAÇÃO NO PADRÃO CORRETO DO GABINETE:\n---\n${e.texto_gerado}\n---`,
  );
  return '\n\n' + blocos.join('\n\n') + '\n\nSiga exatamente o mesmo padrão de linguagem, estrutura e formalidade dos exemplos acima.';
}

// ─────────────────────────────────────────────
// System Prompt — dinâmico por vereador e categoria
// ─────────────────────────────────────────────

async function buildSystemPrompt(
  templateId?: string,
  categoria?: IndicacaoCategoria,
  tiposServico: string[] = [],
  vereadorSlug?: string,
): Promise<string> {
  const t = await getTemplate(templateId);
  const prefeito    = t.vereador.nomePrefeito || 'Farid Said Madi';
  const sala        = t.vereador.salaLocal || 'Sala Alberto Santos Dumont';
  const instituicao = t.institution.name || 'Câmara Municipal de Guarujá';
  const anoAtual    = new Date().getFullYear();
  const meses       = ['janeiro','fevereiro','março','abril','maio','junho',
                       'julho','agosto','setembro','outubro','novembro','dezembro'];
  const hoje        = new Date();
  const dataExtenso = `${hoje.getDate()} de ${meses[hoje.getMonth()]} de ${anoAtual}`;

  const isServico = !categoria || categoria === 'servico_urbano' || categoria === 'seguranca_publica';

  // Regras técnicas por categoria (comuns a todos os vereadores)
  const regrasCategorias = isServico
    ? `- Mencione a origem do pedido se informada (ex: "Fomos procurados por moradores...")
- Se envolver canal ou drenagem: incluir "desassoreamento e limpeza com maquinário apropriado"
- Se envolver iluminação: "verificação e manutenção da iluminação pública"
- Se envolver mato/vegetação: "capinação e roçada"
- Se envolver lixo: "retirada de resíduos e reforço na fiscalização"
- Se envolver vulnerabilidade social: "pessoas em situação de vulnerabilidade"`
    : `- Linguagem respeitosa e propositiva, baseada no interesse coletivo
- Fundamente a importância do tema para Guarujá
- As providências solicitadas devem ser objetivas e realizáveis pelo setor competente`;

  // Few-shot: exemplos históricos relevantes (filtrados por vereador se disponível)
  const exemplos = loadFewShotExamples(categoria ?? 'servico_urbano', tiposServico, vereadorSlug);
  const fewShotBlock = buildFewShotBlock(exemplos);

  // ── Prompt personalizado por perfil de vereador ────────────────
  const perfil = vereadorSlug && vereadorSlug !== 'outro'
    ? getVereadorPerfil(vereadorSlug)
    : null;

  if (perfil) {
    const prefeitoEfetivo = perfil.nomePrefeito || prefeito;
    const salaEfetiva     = perfil.salaLocal || sala;

    // A) Saudação
    const saudacao = perfil.saudacao === 'tipo_a'
      ? 'SENHOR PRESIDENTE,\nSENHORAS VEREADORAS,\nSENHORES VEREADORES;'
      : 'Sr. Presidente,\nSras. Vereadoras e\nSrs. Vereadores.';

    // B) Instrução de justificativa
    let justificativaInstrucao: string;
    if (!perfil.temJustificativa || perfil.estiloJustificativa === 'ausente') {
      justificativaInstrucao = 'NÃO inclua bloco de justificativa. Vá direto da saudação para "INDICAÇÃO Nº".';
    } else if (perfil.estiloJustificativa === 'narrativa_demanda') {
      const prefixo = perfil.prefixoDemanda ?? 'Fomos procurados por moradores';
      justificativaInstrucao = `Inclua parágrafo de justificativa ANTES de "INDICAÇÃO Nº" começando com "${prefixo} da localidade que relataram..." descrevendo o problema, o endereço completo e o impacto na comunidade.`;
    } else if (perfil.estiloJustificativa === 'argumentacao_tecnica') {
      justificativaInstrucao = 'Inclua 1-2 parágrafos de justificativa técnica formal e detalhada ANTES de "INDICAÇÃO Nº", explicando a necessidade da medida, o embasamento legal ou técnico pertinente e seus impactos na qualidade de vida e segurança da população.';
    } else {
      justificativaInstrucao = 'NÃO inclua bloco de justificativa. Vá direto da saudação para "INDICAÇÃO Nº".';
    }

    // C) Estilo do corpo
    let estiloCorpoInstrucao: string;
    if (perfil.estiloCorpo === 'variacao_1') {
      estiloCorpoInstrucao = `Use EXATAMENTE esta fórmula para o corpo:\n"Indicamos a mesa que, seja oficiado ao Excelentíssimo Sr. Prefeito de Guarujá, ${prefeitoEfetivo} e a Secretaria competente, em caráter de urgência, providências no sentido de realizar o serviço de [SERVIÇO] na [ENDEREÇO], no bairro [BAIRRO], para melhor qualidade de vida e segurança da população."`;
    } else if (perfil.estiloCorpo === 'variacao_3') {
      estiloCorpoInstrucao = `Use EXATAMENTE esta fórmula para o corpo:\n"Indico à Mesa, ouvido o douto plenário, para que seja oficiado o Sr. Prefeito Municipal de Guarujá, Sr. ${prefeitoEfetivo.toUpperCase()}, para que determine ao setor competente [PROVIDÊNCIA EM CAIXA ALTA]."`;
    } else {
      // variacao_2 (padrão)
      estiloCorpoInstrucao = `Use EXATAMENTE esta fórmula para o corpo:\n"Indico à Mesa, nos termos regimentais, que seja oficiado ao Excelentíssimo Senhor Prefeito Municipal de Guarujá, ${prefeitoEfetivo}, para que determine ao setor competente:\n\n[Lista numerada das providências solicitadas — use EXATAMENTE as providências fornecidas nos dados]"`;
    }

    // D) Caixa alta
    const caixaAltaRegra = perfil.usaCaixaAlta
      ? '\n- O CORPO DA INDICAÇÃO DEVE SER ESCRITO INTEIRAMENTE EM CAIXA ALTA (letras maiúsculas), incluindo saudação e corpo'
      : '';

    // E) CEP
    const cepRegra = perfil.cepSemprePresente
      ? '\n- O CEP DEVE SEMPRE ser incluído no endereço, mesmo que precise ser estimado'
      : '';

    return `Você é um redator especializado em indicações legislativas para a ${instituicao}.

REGRAS ABSOLUTAS:
- Nunca use emojis
- Nunca use opinião pessoal
- Nunca ataque pessoas
- Nunca use termos ofensivos
- Linguagem formal legislativa
- Texto enxuto — máximo 500 palavras
- Use termos técnicos adequados
- Sempre mencionar o prefeito: ${prefeitoEfetivo}
- Nunca incluir explicações, comentários, markdown ou qualquer texto fora da indicação${caixaAltaRegra}${cepRegra}
${regrasCategorias}${fewShotBlock}

ESTRUTURA OBRIGATÓRIA (siga exatamente, nesta ordem):

${saudacao}

[JUSTIFICATIVA: ${justificativaInstrucao}]

INDICAÇÃO Nº ____ /${anoAtual}

${estiloCorpoInstrucao}

${salaEfetiva}, ${dataExtenso}.

Retorne APENAS o texto final da indicação, sem incluir nome ou assinatura do vereador. Nenhum texto adicional.`;
  }

  // ── Prompt genérico — fallback (comportamento original) ────────
  const justificativaInstruction = isServico
    ? '[Parágrafo objetivo com: origem da solicitação se informada (ex: "Fomos procurados por moradores..."), endereço completo com trecho de localização, bairro, Município Guarujá/SP, descrição do problema e impacto na segurança/saúde pública/mobilidade]'
    : '[Parágrafo de justificativa: contexto do tema, importância para o Município de Guarujá/SP, benefícios esperados para a comunidade]';

  return `Você é um redator especializado em indicações legislativas para a ${instituicao}.

REGRAS ABSOLUTAS:
- Nunca use emojis
- Nunca use opinião pessoal
- Nunca ataque pessoas
- Nunca use termos ofensivos
- Linguagem formal legislativa
- Texto enxuto — máximo 500 palavras
- Use termos técnicos adequados
- Sempre mencionar o prefeito: ${prefeito}
- Nunca incluir explicações, comentários, markdown ou qualquer texto fora da indicação
${regrasCategorias}${fewShotBlock}

ESTRUTURA OBRIGATÓRIA (siga exatamente, sem alterar nenhuma linha fixa):

SENHOR PRESIDENTE,
SENHORAS VEREADORAS,
SENHORES VEREADORES;

${justificativaInstruction}

INDICAÇÃO Nº ____ /${anoAtual}

Indico à Mesa, nos termos regimentais, que seja oficiado ao Excelentíssimo Senhor Prefeito Municipal de Guarujá, ${prefeito}, para que determine ao setor competente:

[Lista numerada das providências solicitadas — use EXATAMENTE as providências fornecidas nos dados, sem acrescentar outras]

${sala}, ${dataExtenso}.

Retorne APENAS o texto final da indicação, sem incluir nome ou assinatura do vereador. Nenhum texto adicional.`;
}

// ─────────────────────────────────────────────
// User Prompt — por categoria
// ─────────────────────────────────────────────

function buildUserPrompt(data: ExtractedData): string {
  if (data.categoria === 'servico_urbano' || data.categoria === 'seguranca_publica') {
    return buildUserPromptServico(data);
  }
  return buildUserPromptGeral(data);
}

function buildUserPromptServico(data: ExtractedData): string {
  // Endereço incluindo trecho_localizacao entre número e bairro
  const enderecoPartes = [
    data.logradouro,
    data.numero && data.numero !== 's/n' ? `nº ${data.numero}` : data.numero,
    data.trecho_localizacao,
    data.bairro,
    data.cep ? `CEP ${data.cep}` : null,
    `${data.cidade}/${data.uf}`,
  ];
  const enderecoCompleto = enderecoPartes.filter(Boolean).join(', ');

  // Providências semi-determinísticas
  const providenciasDeterministicas = buildProvidenciasFromTipos(data.tipos_servico ?? []);
  const providenciasMerged = providenciasDeterministicas.length > 0
    ? providenciasDeterministicas
    : data.providencias_sugeridas;

  const linhas = [
    data.tipos_servico?.length > 0
      ? `Serviços solicitados: ${data.tipos_servico.join(', ').replace(/_/g, ' ')}`
      : null,
    data.origem_solicitacao ? `Solicitado por: ${data.origem_solicitacao}` : null,
    data.tipo_problema ? `Tipo do problema: ${data.tipo_problema}` : null,
    `Endereço completo: ${enderecoCompleto}`,
    data.ponto_referencia ? `Ponto de referência: ${data.ponto_referencia}` : null,
    `Descrição do problema: ${data.descricao_problema}`,
    data.impactos.length > 0 ? `Impactos: ${data.impactos.join(', ')}` : null,
    data.precisa_maquinario && data.sugestao_maquinario.length > 0
      ? `Maquinário necessário: ${data.sugestao_maquinario.join(', ')}`
      : data.precisa_maquinario
        ? 'Necessita maquinário pesado'
        : null,
    data.precisa_estudo_tecnico ? 'Necessita estudo técnico' : null,
    data.observacoes_contextuais ? `Observações: ${data.observacoes_contextuais}` : null,
    // Providências formatadas para inserção direta — reduz alucinação
    providenciasMerged.length > 0
      ? `Providências a incluir (use EXATAMENTE estas):\n${providenciasMerged.map((p, i) => `${i + 1}. ${p}`).join('\n')}`
      : null,
  ]
    .filter(Boolean)
    .join('\n');

  return `Gere uma indicação legislativa com os seguintes dados:\n\n${linhas}`;
}

function buildUserPromptGeral(data: ExtractedData): string {
  const categoriaLabel = CATEGORIA_LABEL[data.categoria] ?? data.categoria;

  const linhas = [
    `Área / Categoria: ${categoriaLabel}`,
    `Tema da indicação: ${data.tema}`,
    data.origem_solicitacao ? `Solicitado por: ${data.origem_solicitacao}` : null,
    `Descrição / justificativa: ${data.descricao_problema}`,
    data.providencias_sugeridas.length > 0
      ? `Providências desejadas: ${data.providencias_sugeridas.join('; ')}`
      : null,
    data.observacoes_contextuais ? `Observações adicionais: ${data.observacoes_contextuais}` : null,
  ]
    .filter(Boolean)
    .join('\n');

  return `Gere uma indicação legislativa com os seguintes dados:\n\n${linhas}`;
}

// ─────────────────────────────────────────────
// Sanitização
// ─────────────────────────────────────────────

function removeEmojis(text: string): string {
  return text.replace(
    /[\u{1F300}-\u{1FFFF}\u{2700}-\u{27BF}\u{FE00}-\u{FEFF}\u{1F900}-\u{1F9FF}]/gu,
    '',
  );
}

// ─────────────────────────────────────────────
// Geração principal
// ─────────────────────────────────────────────

export async function generateTexto(data: ExtractedData, templateId?: string, vereadorSlug?: string): Promise<string> {
  const systemPrompt = await buildSystemPrompt(templateId, data.categoria, data.tipos_servico ?? [], vereadorSlug);
  const userMsg      = buildUserPrompt(data);
  // temperature: 0.2 — texto formal com baixa variação, mas linguagem natural
  const raw          = await callLLMGenerate(systemPrompt, userMsg, 0.2);

  let texto = removeEmojis(raw).trim();
  texto = texto.replace(/```[a-z]*\n?/g, '').replace(/```/g, '');

  if (texto.length > 3200) {
    console.warn('[generate] Texto muito longo, truncando...');
    // Trunca no último \n para não cortar no meio de uma palavra
    const truncado = texto.slice(0, 3200);
    texto = truncado.substring(0, truncado.lastIndexOf('\n')) || truncado;
  }

  return texto;
}
