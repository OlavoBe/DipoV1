/**
 * Normalization Layer — padroniza os dados após validação.
 * Não modifica o sentido dos dados, apenas formato e capitalização.
 */

import type { ExtractedData } from './types';

// ─────────────────────────────────────────────
// Helpers de normalização
// ─────────────────────────────────────────────

/** Capitaliza cada palavra de uma string (ex: "jardim três marias" → "Jardim Três Marias") */
function capitalizeWords(s: string): string {
  if (!s) return s;
  // Preposições e artigos que ficam em minúsculas
  const excecoes = new Set(['de', 'da', 'do', 'das', 'dos', 'os', 'as', 'e', 'a', 'o', 'em', 'no', 'na', 'nos', 'nas']);
  return s
    .toLowerCase()
    .split(' ')
    .map((w, i) => (i === 0 || !excecoes.has(w)) ? w.charAt(0).toUpperCase() + w.slice(1) : w)
    .join(' ');
}

/** Remove espaços duplicados e faz trim */
function cleanString(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

// ─────────────────────────────────────────────
// Função principal de normalização
// ─────────────────────────────────────────────

/**
 * Normaliza os dados extraídos e validados:
 * - Capitaliza bairro e logradouro
 * - Limpa espaços extras
 * - Normaliza cidade e UF
 * - Faz trim em strings
 */
export function normalizeData(data: ExtractedData): ExtractedData {
  const normalized = { ...data };

  // Localização
  if (normalized.bairro)     normalized.bairro     = capitalizeWords(cleanString(normalized.bairro));
  if (normalized.logradouro) normalized.logradouro = capitalizeWords(cleanString(normalized.logradouro));
  if (normalized.cidade)     normalized.cidade     = capitalizeWords(cleanString(normalized.cidade));
  if (normalized.numero)     normalized.numero     = cleanString(normalized.numero);
  if (normalized.trecho_localizacao) {
    normalized.trecho_localizacao = cleanString(normalized.trecho_localizacao);
  }

  // UF em maiúsculas
  if (normalized.uf) normalized.uf = normalized.uf.toUpperCase().trim();

  // CEP: normaliza qualquer formato para NNNNN-NNN
  if (normalized.cep) {
    const digits = normalized.cep.replace(/\D/g, '');
    normalized.cep = digits.length === 8 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : null;
  }

  // Textos gerais
  if (normalized.tema)             normalized.tema             = cleanString(normalized.tema);
  if (normalized.descricao_problema) normalized.descricao_problema = cleanString(normalized.descricao_problema);
  if (normalized.observacoes_contextuais) {
    normalized.observacoes_contextuais = cleanString(normalized.observacoes_contextuais);
  }
  if (normalized.origem_solicitacao) {
    normalized.origem_solicitacao = cleanString(normalized.origem_solicitacao);
  }

  // Arrays — trim em cada item
  normalized.providencias_sugeridas = normalized.providencias_sugeridas.map(s => cleanString(s)).filter(Boolean);
  normalized.impactos               = normalized.impactos.map(s => cleanString(s)).filter(Boolean);
  normalized.sugestao_maquinario    = normalized.sugestao_maquinario.map(s => cleanString(s)).filter(Boolean);
  normalized.perguntas_faltantes    = normalized.perguntas_faltantes.map(s => cleanString(s)).filter(Boolean);

  return normalized;
}
