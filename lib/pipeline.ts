/**
 * Pipeline Principal — orquestra o fluxo completo de geração de indicações.
 *
 * Fluxo:
 *   1. extractData      — LLM extrai dados estruturados do texto livre
 *   2. validateData     — Zod garante integridade e aplica defaults
 *   3. normalizeData    — padroniza capitalização e formato
 *   3b. enrichLocation  — geo-enriquecimento via Nominatim/ViaCEP (non-blocking)
 *   4. camposEssenciaisPreenchidos — verifica se falta info
 *   5. generateTexto    — LLM gera o texto formal da indicação
 */

import { extractData } from './extract';
import { validateData, camposEssenciaisPreenchidos, CATEGORIAS_COM_LOCALIZACAO } from './validator';
import { normalizeData } from './normalizer';
import { generateTexto } from './generate';
import { enrichLocation } from './geocoder';
import type { ExtractedData } from './types';

// ─────────────────────────────────────────────
// Tipos de resultado
// ─────────────────────────────────────────────

export type PipelineResult =
  | { status: 'success';    textoFinal: string; extracted: ExtractedData }
  | { status: 'incomplete'; perguntas: string[]; extracted: ExtractedData }
  | { status: 'error';      message: string };

// ─────────────────────────────────────────────
// Pipeline principal
// ─────────────────────────────────────────────

/**
 * Executa o pipeline completo de geração de indicação legislativa.
 *
 * @param texto         Texto livre do usuário (relato do problema)
 * @param complementos  Respostas às perguntas faltantes (segunda chamada)
 * @param templateId    ID do template de formatação (opcional)
 */
export async function indicacaoPipeline(
  texto: string,
  complementos?: Record<string, string>,
  templateId?: string,
): Promise<PipelineResult> {
  try {
    // ── 1. Extração ─────────────────────────────────────────────
    const rawExtracted = await extractData(texto, complementos);

    // ── 2. Validação (Zod) ──────────────────────────────────────
    const validated = validateData(rawExtracted);

    // ── 3. Normalização ─────────────────────────────────────────
    const normalized = normalizeData(validated);

    // ── 3b. Geo-enrichment (non-blocking) ───────────────────────
    // Consulta Nominatim/ViaCEP para preencher bairro/CEP automaticamente.
    // Em caso de falha, retorna 'normalized' sem modificar.
    // Só executa para categorias que exigem localização.
    const enriched = CATEGORIAS_COM_LOCALIZACAO.includes(normalized.categoria)
      ? await enrichLocation(normalized)
      : normalized;

    // ── 4. Verificar completude ─────────────────────────────────
    if (!camposEssenciaisPreenchidos(enriched)) {
      return {
        status: 'incomplete',
        perguntas: enriched.perguntas_faltantes,
        extracted: enriched,
      };
    }

    // ── 5. Geração do texto final ───────────────────────────────
    const textoFinal = await generateTexto(enriched, templateId);

    return { status: 'success', textoFinal, extracted: enriched };

  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro interno no pipeline';
    console.error('[pipeline] Erro:', err);
    return { status: 'error', message };
  }
}
