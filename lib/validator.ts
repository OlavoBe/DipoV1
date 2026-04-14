/**
 * Validation Layer — usa Zod para garantir integridade dos dados extraídos.
 * Aplica defaults, garante tipos corretos e rejeita campos inválidos.
 */

import { z } from 'zod';
import type { ExtractedData, IndicacaoCategoria } from './types';

// ─────────────────────────────────────────────
// Constantes de validação
// ─────────────────────────────────────────────

export const CATEGORIAS_VALIDAS: IndicacaoCategoria[] = [
  'servico_urbano', 'seguranca_publica', 'saude', 'educacao',
  'cultura_lazer', 'meio_ambiente', 'homenagem', 'outros',
];

export const TIPOS_SERVICO_VALIDOS = [
  'tapa_buraco', 'capinacao_rocada', 'iluminacao_publica', 'drenagem_galerias',
  'limpeza_canal_desassoreamento', 'redutor_velocidade', 'retirada_lixo_entulho',
  'fiscalizacao_transito', 'vulnerabilidade_social', 'estudo_tecnico', 'outro',
] as const;

/** Categorias que exigem logradouro + bairro */
export const CATEGORIAS_COM_LOCALIZACAO: IndicacaoCategoria[] = [
  'servico_urbano', 'seguranca_publica',
];

// ─────────────────────────────────────────────
// Schema Zod
// ─────────────────────────────────────────────

const ExtractedDataSchema = z.object({
  // ── Campos comuns ──────────────────────────
  categoria: z.enum([
    'servico_urbano', 'seguranca_publica', 'saude', 'educacao',
    'cultura_lazer', 'meio_ambiente', 'homenagem', 'outros',
  ]).default('outros'),

  tema:                    z.string().default(''),
  descricao_problema:      z.string().default(''),
  providencias_sugeridas:  z.array(z.string()).default([]),
  observacoes_contextuais: z.string().default(''),
  perguntas_faltantes:     z.array(z.string()).default([]),
  origem_solicitacao:      z.string().nullable().default(null),
  tipo_problema:           z.string().nullable().default(null),

  // ── Localização ────────────────────────────
  logradouro:        z.string().default(''),
  numero:            z.string().default('s/n'),
  bairro:            z.string().default(''),
  cidade:            z.string().default('Guarujá'),
  uf:                z.string().default('SP'),
  cep:               z.string().nullable().default(null),
  ponto_referencia:  z.string().nullable().default(null),
  trecho_localizacao: z.string().nullable().default(null),

  // ── Serviço urbano ─────────────────────────
  tipos_servico:          z.array(z.string()).default([]),
  impactos:               z.array(z.string()).default([]),
  precisa_maquinario:     z.boolean().default(false),
  sugestao_maquinario:    z.array(z.string()).default([]),
  precisa_estudo_tecnico: z.boolean().default(false),
}).passthrough(); // permite campos extras sem rejeitar

// ─────────────────────────────────────────────
// Função principal de validação
// ─────────────────────────────────────────────

/**
 * Valida e aplica defaults ao objeto extraído pelo LLM.
 * Usa Zod — garante tipos, arrays definidos e valores padrão.
 * Não lança exceção: retorna o dado com defaults aplicados.
 */
export function validateData(raw: unknown): ExtractedData {
  if (raw === null || raw === undefined) raw = {};
  const result = ExtractedDataSchema.safeParse(raw);

  if (result.success) {
    const data = result.data as ExtractedData;

    // Retrocompatibilidade: migra tipo_servico legado → tipos_servico[]
    if (!data.tipos_servico || data.tipos_servico.length === 0) {
      const legado = (raw as Record<string, unknown>)?.['tipo_servico'];
      data.tipos_servico = legado ? [String(legado)] : [];
    }

    // Filtra tipos_servico para apenas valores do enum
    data.tipos_servico = data.tipos_servico.filter(
      t => TIPOS_SERVICO_VALIDOS.includes(t as typeof TIPOS_SERVICO_VALIDOS[number]),
    );

    // Força categoria válida
    if (!CATEGORIAS_VALIDAS.includes(data.categoria)) {
      data.categoria = 'outros';
    }

    return data;
  }

  // Se Zod falhou, tenta recuperar com defaults manuais
  console.warn('[validator] Zod parse falhou, aplicando defaults manuais:', result.error.issues);
  const fallback = raw as Record<string, unknown>;
  const categoriaRaw = String(fallback.categoria ?? '');

  return {
    categoria: CATEGORIAS_VALIDAS.includes(categoriaRaw as IndicacaoCategoria)
      ? (categoriaRaw as IndicacaoCategoria)
      : 'outros',
    tema:                    String(fallback.tema || ''),
    descricao_problema:      String(fallback.descricao_problema || ''),
    providencias_sugeridas:  Array.isArray(fallback.providencias_sugeridas) ? fallback.providencias_sugeridas as string[] : [],
    observacoes_contextuais: String(fallback.observacoes_contextuais || ''),
    perguntas_faltantes:     Array.isArray(fallback.perguntas_faltantes) ? fallback.perguntas_faltantes as string[] : [],
    origem_solicitacao:      fallback.origem_solicitacao as string | null ?? null,
    tipo_problema:           fallback.tipo_problema as string | null ?? null,
    logradouro:              String(fallback.logradouro || ''),
    numero:                  String(fallback.numero || 's/n'),
    bairro:                  String(fallback.bairro || ''),
    cidade:                  String(fallback.cidade || 'Guarujá'),
    uf:                      String(fallback.uf || 'SP'),
    cep:                     fallback.cep as string | null ?? null,
    ponto_referencia:        fallback.ponto_referencia as string | null ?? null,
    trecho_localizacao:      fallback.trecho_localizacao as string | null ?? null,
    tipos_servico:           Array.isArray(fallback.tipos_servico) ? fallback.tipos_servico as string[] : [],
    impactos:                Array.isArray(fallback.impactos) ? fallback.impactos as string[] : [],
    precisa_maquinario:      Boolean(fallback.precisa_maquinario),
    sugestao_maquinario:     Array.isArray(fallback.sugestao_maquinario) ? fallback.sugestao_maquinario as string[] : [],
    precisa_estudo_tecnico:  Boolean(fallback.precisa_estudo_tecnico),
  };
}

/**
 * Verifica se todos os campos essenciais estão preenchidos para a categoria dada.
 */
export function camposEssenciaisPreenchidos(data: ExtractedData): boolean {
  if (data.perguntas_faltantes.length > 0) return false;

  if (CATEGORIAS_COM_LOCALIZACAO.includes(data.categoria)) {
    return !!data.logradouro && !!data.bairro && !!data.descricao_problema;
  }

  return !!(data.tema || data.descricao_problema);
}
