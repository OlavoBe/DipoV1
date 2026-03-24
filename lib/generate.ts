/**
 * Generator — constrói e executa o prompt de geração da indicação legislativa.
 * Usa few-shot learning com exemplos históricos para melhor aderência ao padrão do gabinete.
 * temperature: 0.2 — texto formal com baixa variação mas linguagem natural.
 */

import fs from 'fs';
import path from 'path';
import { callLLM } from './llm';
import { getTemplate } from './template';
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
  categoria: string;
  tipos_servico: string[];
  descricao: string;
  texto_gerado: string;
}

/**
 * Carrega exemplos históricos relevantes da pasta data/indicacoes_exemplo/.
 * Seleciona 1–2 exemplos compatíveis com a categoria e tipos_servico da indicação atual.
 */
function loadFewShotExamples(
  categoria: IndicacaoCategoria,
  tiposServico: string[],
): IndicacaoExemplo[] {
  const dir = path.join(process.cwd(), 'data', 'indicacoes_exemplo');
  if (!fs.existsSync(dir)) return [];

  const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
  const exemplos: IndicacaoExemplo[] = [];

  for (const file of files) {
    try {
      const content = fs.readFileSync(path.join(dir, file), 'utf-8');
      const exemplo = JSON.parse(content) as IndicacaoExemplo;
      exemplos.push(exemplo);
    } catch {
      // ignora arquivos malformados
    }
  }

  // Prioridade: mesma categoria + interseção de tipos_servico
  const comIntersecao = exemplos.filter(e =>
    e.categoria === categoria &&
    e.tipos_servico.some(t => tiposServico.includes(t)),
  );
  if (comIntersecao.length > 0) return comIntersecao.slice(0, 1);

  // Segunda prioridade: mesma categoria
  const mesmaCategoria = exemplos.filter(e => e.categoria === categoria);
  if (mesmaCategoria.length > 0) return mesmaCategoria.slice(0, 1);

  // Fallback: qualquer servico_urbano (mais comum)
  const urbanos = exemplos.filter(e => e.categoria === 'servico_urbano');
  return urbanos.slice(0, 1);
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
// System Prompt — dinâmico por categoria
// ─────────────────────────────────────────────

async function buildSystemPrompt(
  templateId?: string,
  categoria?: IndicacaoCategoria,
  tiposServico: string[] = [],
): Promise<string> {
  const t = await getTemplate(templateId);
  const vereador    = t.vereador.nome || 'MÁRCIO NABOR TARDELLI';
  const cargo       = t.vereador.cargo || 'Vereador';
  const prefeito    = t.vereador.nomePrefeito || 'Farid Said Madi';
  const sala        = t.vereador.salaLocal || 'Sala Alberto Santos Dumont';
  const instituicao = t.institution.name || 'Câmara Municipal de Guarujá';
  const anoAtual    = new Date().getFullYear();
  const meses       = ['janeiro','fevereiro','março','abril','maio','junho',
                       'julho','agosto','setembro','outubro','novembro','dezembro'];
  const hoje        = new Date();
  const dataExtenso = `${hoje.getDate()} de ${meses[hoje.getMonth()]} de ${anoAtual}`;

  // Instrução de justificativa adaptada por categoria
  const isServico = !categoria || categoria === 'servico_urbano' || categoria === 'seguranca_publica';
  const justificativaInstruction = isServico
    ? '[Parágrafo objetivo com: origem da solicitação se informada (ex: "Fomos procurados por moradores..."), endereço completo com trecho de localização, bairro, Município Guarujá/SP, descrição do problema e impacto na segurança/saúde pública/mobilidade]'
    : '[Parágrafo de justificativa: contexto do tema, importância para o Município de Guarujá/SP, benefícios esperados para a comunidade]';

  // Regras técnicas por categoria
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

  // Few-shot: exemplos históricos relevantes
  const exemplos = loadFewShotExamples(categoria ?? 'servico_urbano', tiposServico);
  const fewShotBlock = buildFewShotBlock(exemplos);

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

export async function generateTexto(data: ExtractedData, templateId?: string): Promise<string> {
  const systemPrompt = await buildSystemPrompt(templateId, data.categoria, data.tipos_servico ?? []);
  const userMsg      = buildUserPrompt(data);
  // temperature: 0.2 — texto formal com baixa variação, mas linguagem natural
  const raw          = await callLLM(systemPrompt, userMsg, 0.2);

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
