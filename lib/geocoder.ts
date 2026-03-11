/**
 * Módulo de geo-enriquecimento — integra Nominatim (OpenStreetMap) e ViaCEP
 * para preencher automaticamente bairro/CEP quando um local é mencionado pelo nome.
 *
 * Princípios:
 * - Non-blocking: qualquer falha retorna os dados originais sem modificar
 * - Timeout de 5 segundos por chamada externa (AbortController)
 * - Escopo Guarujá/SP: descarta resultados de outras cidades
 * - Sem novos pacotes npm: usa native fetch
 */

import type { ExtractedData } from './types';
import { CATEGORIAS_COM_LOCALIZACAO } from './validator';

// ─────────────────────────────────────────────
// Constantes
// ─────────────────────────────────────────────

const GEO_TIMEOUT_MS      = 5_000;
const NOMINATIM_BASE      = 'https://nominatim.openstreetmap.org/search';
const VIACEP_BASE         = 'https://viacep.com.br/ws';
const NOMINATIM_USER_AGENT = 'Dipo-Guaruja/1.0 (indicacoes@camaraguaruja.sp.gov.br)';

// ─────────────────────────────────────────────
// Tipos públicos de resultado
// ─────────────────────────────────────────────

export interface GeoResult {
  logradouro:  string | null; // address.road (pode ser null para praças/pontos de interesse)
  bairro:      string | null; // address.suburb || address.neighbourhood
  cep:         string | null; // address.postcode formatado como NNNNN-NNN
  cidade:      string | null;
  displayName: string;        // display_name completo para debug
}

export interface CEPResult {
  logradouro: string | null;
  bairro:     string | null;
  cidade:     string | null;
  uf:         string | null;
  cep:        string | null; // formatado como NNNNN-NNN
}

// ─────────────────────────────────────────────
// Shapes das respostas das APIs (internas)
// ─────────────────────────────────────────────

interface NominatimAddress {
  road?:          string;
  suburb?:        string;
  neighbourhood?: string;
  quarter?:       string;
  postcode?:      string;
  city?:          string;
  town?:          string;
  municipality?:  string;
  county?:        string;
}

interface NominatimResponse {
  display_name: string;
  address?:     NominatimAddress;
}

interface ViaCEPResponse {
  cep?:        string;
  logradouro?: string;
  bairro?:     string;
  localidade?: string;
  uf?:         string;
  erro?:       boolean | string;
}

// ─────────────────────────────────────────────
// Helpers internos
// ─────────────────────────────────────────────

/** Remove acentos e normaliza para lowercase para comparação de cidades */
function normalizeStr(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function isGuaruja(cidade: string): boolean {
  const n = normalizeStr(cidade);
  return n === 'guaruja' || n.includes('guaruja');
}

/** Formata string de dígitos CEP para NNNNN-NNN */
function formatCEP(raw: string): string | null {
  const digits = raw.replace(/\D/g, '');
  return digits.length === 8
    ? `${digits.slice(0, 5)}-${digits.slice(5)}`
    : null;
}

/**
 * Monta a pergunta de confirmação que vai para perguntas_faltantes[0].
 *
 * O endereço completo fica na CHAVE do complemento, então na 2ª passagem
 * a LLM vê o endereço completo + a resposta do usuário ("sim" ou correção).
 */
function buildConfirmationQuestion(
  logradouro: string | null,
  bairro:     string | null,
  cep:        string | null,
): string {
  const partes: string[] = [];
  if (logradouro) partes.push(logradouro);
  if (bairro)     partes.push(`Bairro ${bairro}`);
  if (cep)        partes.push(`CEP ${cep}`);
  partes.push('Guarujá/SP');

  return `Encontrei o seguinte endereço para este local: ${partes.join(', ')}. Confirme com "sim" ou corrija o endereço.`;
}

// ─────────────────────────────────────────────
// Funções públicas de lookup
// ─────────────────────────────────────────────

/**
 * Busca um logradouro/local pelo nome via Nominatim (OpenStreetMap).
 * Retorna null em qualquer falha (timeout, erro HTTP, cidade errada, sem resultado).
 *
 * Rate limit: Nominatim permite máx 1 req/s. Em uso interativo (1 usuário por vez)
 * está naturalmente satisfeito. Para processamento em lote, adicionar sleep entre chamadas.
 */
export async function geocodeNominatim(
  logradouro: string,
  cidade: string = 'Guarujá',
): Promise<GeoResult | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GEO_TIMEOUT_MS);

  try {
    const query  = `${logradouro}, ${cidade}, SP, Brasil`;
    const params = new URLSearchParams({
      q:                 query,
      format:            'json',
      addressdetails:    '1',
      limit:             '1',
      countrycodes:      'br',
      'accept-language': 'pt-BR',
    });

    const res = await fetch(`${NOMINATIM_BASE}?${params.toString()}`, {
      signal:  controller.signal,
      headers: {
        'User-Agent': NOMINATIM_USER_AGENT,
        'Accept':     'application/json',
      },
    });

    if (!res.ok) {
      console.warn(`[geocoder] Nominatim HTTP ${res.status} para "${logradouro}"`);
      return null;
    }

    const data = await res.json() as NominatimResponse[];

    if (!Array.isArray(data) || data.length === 0) {
      console.info(`[geocoder] Nominatim: sem resultados para "${logradouro}"`);
      return null;
    }

    const result = data[0];
    const addr   = result.address ?? {};

    // City guard — aceita apenas Guarujá
    const cidadeRetornada = addr.city ?? addr.town ?? addr.municipality ?? addr.county ?? '';
    if (!isGuaruja(cidadeRetornada)) {
      console.info(`[geocoder] Nominatim: cidade "${cidadeRetornada}" não é Guarujá — descartando`);
      return null;
    }

    return {
      logradouro:  addr.road ?? null,
      bairro:      addr.suburb ?? addr.neighbourhood ?? addr.quarter ?? null,
      cep:         addr.postcode ? formatCEP(addr.postcode) : null,
      cidade:      cidadeRetornada || null,
      displayName: result.display_name,
    };

  } catch (err) {
    const isAbort = err instanceof Error && err.name === 'AbortError';
    console.warn(`[geocoder] Nominatim ${isAbort ? 'timeout' : 'erro'}:`, isAbort ? `${GEO_TIMEOUT_MS}ms` : err);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Consulta o CEP via ViaCEP (base oficial dos Correios).
 * Retorna null em qualquer falha (timeout, CEP inválido, erro:true, cidade errada).
 */
export async function lookupViaCEP(cep: string): Promise<CEPResult | null> {
  const digits = cep.replace(/\D/g, '');
  if (digits.length !== 8) {
    console.warn(`[geocoder] ViaCEP: CEP inválido "${cep}"`);
    return null;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GEO_TIMEOUT_MS);

  try {
    const res = await fetch(`${VIACEP_BASE}/${digits}/json/`, {
      signal:  controller.signal,
      headers: { 'Accept': 'application/json' },
    });

    if (!res.ok) {
      console.warn(`[geocoder] ViaCEP HTTP ${res.status} para CEP "${cep}"`);
      return null;
    }

    const data = await res.json() as ViaCEPResponse;

    // ViaCEP retorna { erro: true } para CEPs inexistentes
    if ('erro' in data && data.erro) {
      console.info(`[geocoder] ViaCEP: CEP "${cep}" não encontrado`);
      return null;
    }

    // City guard
    if (data.localidade && !isGuaruja(data.localidade)) {
      console.info(`[geocoder] ViaCEP: cidade "${data.localidade}" não é Guarujá — descartando`);
      return null;
    }

    const rawCep = (data.cep ?? digits).replace(/\D/g, '');

    return {
      logradouro: data.logradouro || null,
      bairro:     data.bairro     || null,
      cidade:     data.localidade || null,
      uf:         data.uf         || null,
      cep:        formatCEP(rawCep),
    };

  } catch (err) {
    const isAbort = err instanceof Error && err.name === 'AbortError';
    console.warn(`[geocoder] ViaCEP ${isAbort ? 'timeout' : 'erro'}:`, isAbort ? `${GEO_TIMEOUT_MS}ms` : err);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// ─────────────────────────────────────────────
// Helpers privados de enriquecimento
// ─────────────────────────────────────────────

/** Remove perguntas sobre bairro (serão substituídas pela pergunta de confirmação geo) */
function removeBairroQuestions(perguntas: string[]): string[] {
  return perguntas.filter(q => !q.toLowerCase().includes('bairro'));
}

async function enrichViaCEP(data: ExtractedData): Promise<ExtractedData> {
  const result = await lookupViaCEP(data.cep!);
  if (!result) return data;

  const filledBairro = !data.bairro && !!result.bairro;
  const filledLogr   = !data.logradouro && !!result.logradouro;

  // Só enriquece se ao menos um campo novo foi obtido
  if (!filledBairro && !filledLogr) return data;

  const proposedBairro = result.bairro ?? data.bairro ?? null;
  const proposedLogr   = result.logradouro ?? data.logradouro ?? null;
  const proposedCep    = result.cep ?? data.cep;

  const confirmQuestion = buildConfirmationQuestion(proposedLogr, proposedBairro, proposedCep);
  const remaining       = removeBairroQuestions(data.perguntas_faltantes);

  return {
    ...data,
    bairro:     proposedBairro  ?? data.bairro,
    logradouro: proposedLogr    ?? data.logradouro,
    cep:        proposedCep     ?? data.cep,
    geo_enriquecido: true,
    perguntas_faltantes: [confirmQuestion, ...remaining].slice(0, 2),
  };
}

async function enrichViaNominatim(data: ExtractedData): Promise<ExtractedData> {
  const result = await geocodeNominatim(data.logradouro, data.cidade || 'Guarujá');
  if (!result) return data;

  const filledBairro = !data.bairro && !!result.bairro;
  const filledCep    = !data.cep    && !!result.cep;

  if (!filledBairro && !filledCep) return data;

  const proposedBairro = result.bairro ?? data.bairro ?? null;
  const proposedCep    = result.cep    ?? data.cep;

  // Preserva o logradouro original do usuário — Nominatim pode retornar
  // address.road nulo para pontos de interesse (praças, parques etc.)
  const proposedLogr = data.logradouro;

  const confirmQuestion = buildConfirmationQuestion(proposedLogr, proposedBairro, proposedCep);
  const remaining       = removeBairroQuestions(data.perguntas_faltantes);

  return {
    ...data,
    bairro: proposedBairro ?? data.bairro,
    cep:    proposedCep    ?? data.cep,
    geo_enriquecido: true,
    perguntas_faltantes: [confirmQuestion, ...remaining].slice(0, 2),
  };
}

// ─────────────────────────────────────────────
// Função principal — chamada pelo pipeline
// ─────────────────────────────────────────────

/**
 * Enriquece os campos de localização de um ExtractedData consultando APIs externas.
 *
 * Prioridade:
 *   1. CEP presente → ViaCEP (dados oficiais Correios)
 *   2. Logradouro presente, bairro/cep ausentes → Nominatim
 *   3. Nenhum dado útil encontrado → retorna dados originais sem modificar
 *
 * Nunca lança exceção — pipeline continua normalmente em qualquer falha.
 */
export async function enrichLocation(data: ExtractedData): Promise<ExtractedData> {
  // Só enriquece categorias que exigem localização
  if (!CATEGORIAS_COM_LOCALIZACAO.includes(data.categoria)) return data;

  const bairroMissing = !data.bairro;
  const cepMissing    = !data.cep;

  // Ambos já preenchidos — nada a fazer
  if (!bairroMissing && !cepMissing) return data;

  try {
    // Prioridade 1: CEP fornecido → ViaCEP
    if (data.cep) {
      return await enrichViaCEP(data);
    }

    // Prioridade 2: Logradouro presente → Nominatim
    if (data.logradouro) {
      return await enrichViaNominatim(data);
    }

    // Nenhum dado para buscar — retorna original
    return data;

  } catch (err) {
    // Segurança extra: enriquecimento NUNCA pode quebrar o pipeline
    console.error('[geocoder] Erro inesperado em enrichLocation:', err);
    return data;
  }
}
