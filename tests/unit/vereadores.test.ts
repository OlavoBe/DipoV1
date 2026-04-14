import { describe, it, expect } from 'vitest';
import { VEREADORES_BETA, getVereadorPerfil, isVereadorBeta } from '@/lib/vereadores';
import { VEREADOR_OPTIONS, getVereadorOption } from '@/lib/vereadores-options';

// ─────────────────────────────────────────────
// VEREADORES_BETA — integridade dos dados
// ─────────────────────────────────────────────

describe('VEREADORES_BETA', () => {
  it('contém exatamente 4 vereadores beta', () => {
    expect(VEREADORES_BETA).toHaveLength(4);
  });

  it('todos têm slug único', () => {
    const slugs = VEREADORES_BETA.map(v => v.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('todos têm nomeCompleto em maiúsculas', () => {
    for (const v of VEREADORES_BETA) {
      expect(v.nomeCompleto).toBe(v.nomeCompleto.toUpperCase());
    }
  });

  it('cada vereador tem saudacao do tipo correto', () => {
    for (const v of VEREADORES_BETA) {
      expect(['tipo_a', 'tipo_b']).toContain(v.saudacao);
    }
  });

  it('cada vereador tem estiloCorpo do tipo correto', () => {
    for (const v of VEREADORES_BETA) {
      expect(['variacao_1', 'variacao_2', 'variacao_3']).toContain(v.estiloCorpo);
    }
  });

  it('cada vereador tem estiloJustificativa coerente com temJustificativa', () => {
    for (const v of VEREADORES_BETA) {
      if (!v.temJustificativa) {
        expect(['ausente']).toContain(v.estiloJustificativa);
      } else {
        expect(['narrativa_demanda', 'argumentacao_tecnica', 'narrativa_campo']).toContain(v.estiloJustificativa);
      }
    }
  });

  it('Ariani usa caixaAlta=true e cepSemprePresente=true', () => {
    const ariani = VEREADORES_BETA.find(v => v.slug === 'ariani_paz');
    expect(ariani?.usaCaixaAlta).toBe(true);
    expect(ariani?.cepSemprePresente).toBe(true);
  });

  it('Márcio tem prefixoDemanda definido', () => {
    const marcio = VEREADORES_BETA.find(v => v.slug === 'marcio_pet');
    expect(marcio?.prefixoDemanda).toBeTruthy();
    expect(marcio?.prefixoDemanda).toContain('moradores');
  });

  it('Juninho não tem justificativa', () => {
    const juninho = VEREADORES_BETA.find(v => v.slug === 'juninho_eroso');
    expect(juninho?.temJustificativa).toBe(false);
    expect(juninho?.estiloCorpo).toBe('variacao_1');
  });

  it('Valdemir tem justificativa técnica e saudação tipo_a', () => {
    const val = VEREADORES_BETA.find(v => v.slug === 'valdemir');
    expect(val?.temJustificativa).toBe(true);
    expect(val?.estiloJustificativa).toBe('argumentacao_tecnica');
    expect(val?.saudacao).toBe('tipo_a');
  });
});

// ─────────────────────────────────────────────
// getVereadorPerfil
// ─────────────────────────────────────────────

describe('getVereadorPerfil', () => {
  it('retorna perfil correto para slug válido', () => {
    const perfil = getVereadorPerfil('juninho_eroso');
    expect(perfil).not.toBeNull();
    expect(perfil?.slug).toBe('juninho_eroso');
    expect(perfil?.nomeCompleto).toBe('EDMAR LIMA DOS SANTOS');
  });

  it('retorna null para slug inexistente', () => {
    expect(getVereadorPerfil('vereador_fantasma')).toBeNull();
  });

  it('retorna null para string vazia', () => {
    expect(getVereadorPerfil('')).toBeNull();
  });

  it('retorna null para "outro"', () => {
    expect(getVereadorPerfil('outro')).toBeNull();
  });

  it('é case-sensitive (slugs são lowercase_snake)', () => {
    expect(getVereadorPerfil('JUNINHO_EROSO')).toBeNull();
  });
});

// ─────────────────────────────────────────────
// isVereadorBeta
// ─────────────────────────────────────────────

describe('isVereadorBeta', () => {
  it('retorna true para todos os slugs beta', () => {
    for (const v of VEREADORES_BETA) {
      expect(isVereadorBeta(v.slug)).toBe(true);
    }
  });

  it('retorna false para "outro"', () => {
    expect(isVereadorBeta('outro')).toBe(false);
  });

  it('retorna false para slug inexistente', () => {
    expect(isVereadorBeta('nao_existe')).toBe(false);
  });
});

// ─────────────────────────────────────────────
// VEREADOR_OPTIONS — consistência com VEREADORES_BETA
// ─────────────────────────────────────────────

describe('VEREADOR_OPTIONS', () => {
  it('contém os mesmos slugs que VEREADORES_BETA', () => {
    const slugsBeta    = VEREADORES_BETA.map(v => v.slug).sort();
    const slugsOptions = VEREADOR_OPTIONS.map(v => v.slug).sort();
    expect(slugsOptions).toEqual(slugsBeta);
  });

  it('nomeCompleto de cada option bate com o perfil correspondente', () => {
    for (const opt of VEREADOR_OPTIONS) {
      const perfil = getVereadorPerfil(opt.slug);
      expect(opt.nomeCompleto).toBe(perfil?.nomeCompleto);
    }
  });

  it('partido de Valdemir está correto', () => {
    const opt = VEREADOR_OPTIONS.find(v => v.slug === 'valdemir');
    expect(opt?.partido).toBe('Podemos');
  });
});

// ─────────────────────────────────────────────
// getVereadorOption
// ─────────────────────────────────────────────

describe('getVereadorOption', () => {
  it('retorna option correta para slug válido', () => {
    const opt = getVereadorOption('ariani_paz');
    expect(opt?.label).toBe('Vereadora Ariani');
    expect(opt?.nomeCompleto).toBe('ARIANI DA SILVA PAZ');
  });

  it('retorna null para "outro"', () => {
    expect(getVereadorOption('outro')).toBeNull();
  });

  it('retorna null para slug inexistente', () => {
    expect(getVereadorOption('fantasma')).toBeNull();
  });
});
