/**
 * Converte o texto plano que a LLM produz hoje na estrutura `IndicacaoDoc`.
 *
 * É uma ponte de transição: no médio prazo a etapa de geração deve pedir o JSON
 * direto à LLM e este parser vira fallback. Enquanto isso, ele é o que permite
 * dar semântica ao documento sem mexer no pipeline.
 *
 * O parser **classifica, não transforma**: preserva o texto de cada bloco
 * exatamente como veio, inclusive a caixa. Gabinetes que escrevem em CAIXA ALTA
 * continuam em caixa alta, e o round-trip pelo serializer devolve o original.
 */
import type { TemplateSettings } from './template';
import { type IndicacaoDoc, MESES_PT } from './doc-types';

// ─────────────────────────────────────────────
// Reconhecedores de bloco
// ─────────────────────────────────────────────

/** "INDICAÇÃO Nº ____ /2026" — número pode estar em branco. */
const RE_TITULO = /^INDICA[ÇC][ÃA]O\s+N[ºo°.]?\s*(.*?)\s*[/\\]\s*(\d{4})\s*$/i;

/** "1. Execução de..." ou "2) Avaliação..." */
const RE_PROVIDENCIA = /^(\d{1,2})\s*[.)]\s+(.*)$/;

/** "Sala Alberto Santos Dumont, 13 de abril de 2026." */
const RE_LOCAL_DATA = /^(.*?),\s*(\d{1,2})\s+de\s+([a-zçãêíóúâôõé]+)\s+de\s+(\d{4})\s*\.?\s*$/i;

/** Linhas de vocativo: "Sr. Presidente,", "SENHORAS VEREADORAS,", etc. */
const RE_VOCATIVO = /^\s*(exm[oa]s?\.?|sr[ase]?s?\.?|senhor(es|as|a)?|vereador(es|as|a)?)\b/i;

function ehTitulo(linha: string): boolean {
  return RE_TITULO.test(linha.trim());
}

function ehLocalData(linha: string): boolean {
  return RE_LOCAL_DATA.test(linha.trim());
}

/**
 * Um bloco é vocativo quando todas as suas linhas parecem tratamento e nenhuma
 * é longa demais para ser saudação.
 */
function ehVocativo(bloco: string): boolean {
  const linhas = bloco.split('\n').map((l) => l.trim()).filter(Boolean);
  if (linhas.length === 0 || linhas.length > 4) return false;
  return linhas.every((l) => l.length <= 60 && RE_VOCATIVO.test(l));
}

/** Remove acentos para comparar nomes de mês sem depender da grafia. */
function semAcento(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function parseData(dia: string, mesTexto: string, ano: string): Date | null {
  const alvo = semAcento(mesTexto);
  const idx = MESES_PT.findIndex((m) => semAcento(m) === alvo);
  if (idx < 0) return null;
  const d = new Date(Number(ano), idx, Number(dia));
  return Number.isNaN(d.getTime()) ? null : d;
}

// ─────────────────────────────────────────────
// Parser principal
// ─────────────────────────────────────────────

export function parseTextoToDoc(textoFinal: string, template: TemplateSettings): IndicacaoDoc {
  const blocos = textoFinal
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter(Boolean);

  const doc: IndicacaoDoc = {
    vocativo: [],
    preambulo: [],
    tituloNumero: null,
    tituloAno: new Date().getFullYear(),
    corpo: [],
    providencias: [],
    fecho: [],
    local: template.vereador.salaLocal ?? '',
    data: null,
    assinaturaNome: template.vereador.nome ?? '',
    assinaturaCargo: template.vereador.cargo ?? 'Vereador',
  };

  let viuTitulo = false;
  let viuProvidencia = false;

  for (const bloco of blocos) {
    const linhas = bloco.split('\n').map((l) => l.trim()).filter(Boolean);

    // ── Vocativo: só no começo, antes de qualquer outro conteúdo ──
    if (!viuTitulo && doc.vocativo.length === 0 && doc.preambulo.length === 0 && ehVocativo(bloco)) {
      doc.vocativo = linhas;
      continue;
    }

    // ── Título ──
    const linhaTitulo = linhas.find(ehTitulo);
    if (!viuTitulo && linhaTitulo) {
      const m = linhaTitulo.trim().match(RE_TITULO)!;
      const numero = m[1].replace(/[_\s]/g, '');
      doc.tituloNumero = numero.length > 0 ? m[1].trim() : null;
      doc.tituloAno = Number(m[2]);
      viuTitulo = true;

      // o bloco pode trazer mais linhas junto do título
      const resto = linhas.filter((l) => l !== linhaTitulo);
      if (resto.length) doc.corpo.push(resto.join('\n'));
      continue;
    }

    // ── Local e data ──
    if (linhas.length === 1 && ehLocalData(linhas[0])) {
      const m = linhas[0].match(RE_LOCAL_DATA)!;
      doc.local = m[1].trim();
      doc.data = parseData(m[2], m[3], m[4]);
      continue;
    }

    // ── Providências: um bloco pode conter vários itens numerados ──
    const itens = linhas.filter((l) => RE_PROVIDENCIA.test(l));
    if (itens.length > 0 && itens.length === linhas.length) {
      doc.providencias.push(...itens);
      viuProvidencia = true;
      continue;
    }

    // ── Parágrafo comum: destino depende de onde estamos ──
    const texto = linhas.join('\n');
    if (!viuTitulo) doc.preambulo.push(texto);
    else if (viuProvidencia) doc.fecho.push(texto);
    else doc.corpo.push(texto);
  }

  return doc;
}
