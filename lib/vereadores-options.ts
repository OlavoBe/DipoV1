/**
 * Opções de vereador beta para o dropdown do onboarding.
 * Arquivo seguro para 'use client' — sem imports server-side.
 */

export interface VereadorOption {
  slug: string;
  label: string;
  nomeCompleto: string;
  partido: string;
}

export const VEREADOR_OPTIONS: VereadorOption[] = [
  { slug: 'juninho_eroso', label: 'Vereador Juninho Eroso', nomeCompleto: 'EDMAR LIMA DOS SANTOS',    partido: '' },
  { slug: 'ariani_paz',    label: 'Vereadora Ariani',       nomeCompleto: 'ARIANI DA SILVA PAZ',      partido: '' },
  { slug: 'marcio_pet',    label: 'Vereador Márcio do Pet', nomeCompleto: 'MÁRCIO NABOR TARDELLI',    partido: '' },
  { slug: 'valdemir',      label: 'Vereador Valdemir',      nomeCompleto: 'VALDEMIR BATISTA SANTANA', partido: 'Podemos' },
];

export function getVereadorOption(slug: string): VereadorOption | null {
  return VEREADOR_OPTIONS.find(v => v.slug === slug) ?? null;
}
