import { describe, it, expect } from 'vitest';
import { validateData, camposEssenciaisPreenchidos, CATEGORIAS_VALIDAS, TIPOS_SERVICO_VALIDOS } from '@/lib/validator';
import { makeExtracted } from '../helpers/fixtures';

// ─────────────────────────────────────────────
// validateData
// ─────────────────────────────────────────────

describe('validateData', () => {
  it('retorna defaults quando recebe objeto vazio', () => {
    const result = validateData({});
    expect(result.categoria).toBe('outros');
    expect(result.logradouro).toBe('');
    expect(result.numero).toBe('s/n');
    expect(result.cidade).toBe('Guarujá');
    expect(result.uf).toBe('SP');
    expect(result.tipos_servico).toEqual([]);
    expect(result.impactos).toEqual([]);
    expect(result.perguntas_faltantes).toEqual([]);
  });

  it('preserva campos válidos', () => {
    const input = {
      categoria: 'servico_urbano',
      logradouro: 'Rua das Palmeiras',
      bairro: 'Jardim Helena',
      descricao_problema: 'Buraco no asfalto',
      tipos_servico: ['tapa_buraco'],
    };
    const result = validateData(input);
    expect(result.categoria).toBe('servico_urbano');
    expect(result.logradouro).toBe('Rua das Palmeiras');
    expect(result.tipos_servico).toEqual(['tapa_buraco']);
  });

  it('força categoria para "outros" quando valor é inválido', () => {
    const result = validateData({ categoria: 'inexistente' });
    expect(result.categoria).toBe('outros');
  });

  it('filtra tipos_servico com valores fora do enum', () => {
    const result = validateData({ tipos_servico: ['tapa_buraco', 'valor_invalido', 'iluminacao_publica'] });
    expect(result.tipos_servico).toEqual(['tapa_buraco', 'iluminacao_publica']);
  });

  it('migra campo legado tipo_servico para tipos_servico[]', () => {
    const result = validateData({ tipo_servico: 'tapa_buraco' });
    expect(result.tipos_servico).toContain('tapa_buraco');
  });

  it('não sobrescreve tipos_servico com legado quando já preenchido', () => {
    const result = validateData({ tipos_servico: ['iluminacao_publica'], tipo_servico: 'tapa_buraco' });
    expect(result.tipos_servico).toEqual(['iluminacao_publica']);
  });

  it('retorna arrays vazios (não undefined) para campos de array', () => {
    const result = validateData({ categoria: 'saude' });
    expect(Array.isArray(result.providencias_sugeridas)).toBe(true);
    expect(Array.isArray(result.impactos)).toBe(true);
    expect(Array.isArray(result.sugestao_maquinario)).toBe(true);
  });

  it('aceita null para campos opcionais', () => {
    const result = validateData({ cep: null, ponto_referencia: null });
    expect(result.cep).toBeNull();
    expect(result.ponto_referencia).toBeNull();
  });

  it('não lança exceção com input null ou undefined', () => {
    expect(() => validateData(null)).not.toThrow();
    expect(() => validateData(undefined)).not.toThrow();
  });

  it('todas as categorias válidas são aceitas sem modificação', () => {
    for (const cat of CATEGORIAS_VALIDAS) {
      const result = validateData({ categoria: cat });
      expect(result.categoria).toBe(cat);
    }
  });

  it('todos os tipos_servico válidos passam pelo filtro', () => {
    const result = validateData({ tipos_servico: [...TIPOS_SERVICO_VALIDOS] });
    expect(result.tipos_servico).toEqual([...TIPOS_SERVICO_VALIDOS]);
  });
});

// ─────────────────────────────────────────────
// camposEssenciaisPreenchidos
// ─────────────────────────────────────────────

describe('camposEssenciaisPreenchidos', () => {
  it('retorna true para servico_urbano com logradouro + bairro + descricao', () => {
    const data = makeExtracted();
    expect(camposEssenciaisPreenchidos(data)).toBe(true);
  });

  it('retorna false se perguntas_faltantes não vazias', () => {
    const data = makeExtracted({ perguntas_faltantes: ['Qual o bairro?'] });
    expect(camposEssenciaisPreenchidos(data)).toBe(false);
  });

  it('retorna false para servico_urbano sem logradouro', () => {
    const data = makeExtracted({ logradouro: '' });
    expect(camposEssenciaisPreenchidos(data)).toBe(false);
  });

  it('retorna false para servico_urbano sem bairro', () => {
    const data = makeExtracted({ bairro: '' });
    expect(camposEssenciaisPreenchidos(data)).toBe(false);
  });

  it('retorna false para servico_urbano sem descricao_problema', () => {
    const data = makeExtracted({ descricao_problema: '' });
    expect(camposEssenciaisPreenchidos(data)).toBe(false);
  });

  it('retorna true para categoria geral com tema preenchido', () => {
    const data = makeExtracted({
      categoria: 'saude',
      logradouro: '',
      bairro: '',
      tema: 'Melhoria na UBS',
      descricao_problema: '',
    });
    expect(camposEssenciaisPreenchidos(data)).toBe(true);
  });

  it('retorna true para categoria geral com descricao_problema preenchida', () => {
    const data = makeExtracted({
      categoria: 'educacao',
      logradouro: '',
      bairro: '',
      tema: '',
      descricao_problema: 'Solicitar reforma da escola',
    });
    expect(camposEssenciaisPreenchidos(data)).toBe(true);
  });

  it('retorna false para categoria geral sem tema e sem descricao', () => {
    const data = makeExtracted({
      categoria: 'homenagem',
      logradouro: '',
      bairro: '',
      tema: '',
      descricao_problema: '',
    });
    expect(camposEssenciaisPreenchidos(data)).toBe(false);
  });
});
