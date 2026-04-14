import { describe, it, expect } from 'vitest';
import { normalizeData } from '@/lib/normalizer';
import { makeExtracted } from '../helpers/fixtures';

describe('normalizeData', () => {
  // ── Capitalização ──────────────────────────

  it('capitaliza bairro corretamente', () => {
    const result = normalizeData(makeExtracted({ bairro: 'jardim três marias' }));
    expect(result.bairro).toBe('Jardim Três Marias');
  });

  it('capitaliza logradouro corretamente', () => {
    const result = normalizeData(makeExtracted({ logradouro: 'rua das flores' }));
    expect(result.logradouro).toBe('Rua das Flores');
  });

  it('mantém preposições em minúscula', () => {
    const result = normalizeData(makeExtracted({ bairro: 'vila de todos os santos' }));
    expect(result.bairro).toBe('Vila de Todos os Santos');
  });

  it('capitaliza cidade', () => {
    const result = normalizeData(makeExtracted({ cidade: 'guarujá' }));
    expect(result.cidade).toBe('Guarujá');
  });

  it('coloca UF em maiúsculas', () => {
    const result = normalizeData(makeExtracted({ uf: 'sp' }));
    expect(result.uf).toBe('SP');
  });

  it('não altera bairro que já está capitalizado', () => {
    const result = normalizeData(makeExtracted({ bairro: 'Centro' }));
    expect(result.bairro).toBe('Centro');
  });

  // ── CEP ───────────────────────────────────

  it('normaliza CEP com 8 dígitos para formato NNNNN-NNN', () => {
    const result = normalizeData(makeExtracted({ cep: '11410080' }));
    expect(result.cep).toBe('11410-080');
  });

  it('normaliza CEP já formatado (remove traço e reaplica)', () => {
    const result = normalizeData(makeExtracted({ cep: '11410-080' }));
    expect(result.cep).toBe('11410-080');
  });

  it('define CEP como null quando incompleto (menos de 8 dígitos)', () => {
    const result = normalizeData(makeExtracted({ cep: '1141' }));
    expect(result.cep).toBeNull();
  });

  it('preserva CEP null', () => {
    const result = normalizeData(makeExtracted({ cep: null }));
    expect(result.cep).toBeNull();
  });

  // ── Espaços ───────────────────────────────

  it('remove espaços duplicados de strings', () => {
    const result = normalizeData(makeExtracted({ descricao_problema: 'buraco  grande   na rua' }));
    expect(result.descricao_problema).toBe('buraco grande na rua');
  });

  it('faz trim nas strings', () => {
    const result = normalizeData(makeExtracted({ tema: '  tapa buraco  ' }));
    expect(result.tema).toBe('tapa buraco');
  });

  it('remove itens vazios dos arrays', () => {
    const result = normalizeData(makeExtracted({ providencias_sugeridas: ['tapa-buraco', '', '  ', 'roçada'] }));
    expect(result.providencias_sugeridas).toEqual(['tapa-buraco', 'roçada']);
  });

  it('faz trim nos itens dos arrays', () => {
    const result = normalizeData(makeExtracted({ impactos: ['  risco de acidente  ', 'alagamento'] }));
    expect(result.impactos).toEqual(['risco de acidente', 'alagamento']);
  });

  // ── Imutabilidade ─────────────────────────

  it('não modifica o objeto original', () => {
    const original = makeExtracted({ bairro: 'jardim helena' });
    const bairroOriginal = original.bairro;
    normalizeData(original);
    expect(original.bairro).toBe(bairroOriginal);
  });

  // ── Campos null/vazios ────────────────────

  it('não toca em campos já vazios', () => {
    const result = normalizeData(makeExtracted({ trecho_localizacao: null }));
    expect(result.trecho_localizacao).toBeNull();
  });

  it('normaliza origem_solicitacao quando preenchida', () => {
    const result = normalizeData(makeExtracted({ origem_solicitacao: '  moradores  ' }));
    expect(result.origem_solicitacao).toBe('moradores');
  });
});
