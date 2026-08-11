import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { parseTextoToDoc } from '@/lib/doc-parser';
import { docToTexto } from '@/lib/doc-serializer';
import { DEFAULT_SETTINGS, type TemplateSettings } from '@/lib/template';

/**
 * O parser dá semântica ao texto plano que a LLM produz. Estes testes usam as
 * indicações reais de data/indicacoes_exemplo/ como fixture — os 4 gabinetes do
 * beta têm estruturas bem diferentes entre si, e é exatamente essa variação que
 * o parser precisa aguentar.
 */

const TEMPLATE: TemplateSettings = {
  ...DEFAULT_SETTINGS,
  vereador: {
    ...DEFAULT_SETTINGS.vereador,
    nome: 'MÁRCIO NABOR TARDELLI',
    cargo: 'Vereador',
    salaLocal: 'Sala Alberto Santos Dumont',
  },
};

function exemplo(slug: string, arquivo: string): string {
  const p = join(process.cwd(), 'data', 'indicacoes_exemplo', slug, `${arquivo}.json`);
  return JSON.parse(readFileSync(p, 'utf8')).texto_gerado as string;
}

describe('parseTextoToDoc — os 4 estilos de gabinete', () => {
  it('marcio_pet: vocativo, preâmbulo, título, corpo, providências e data', () => {
    const doc = parseTextoToDoc(exemplo('marcio_pet', 'tapa_buraco'), TEMPLATE);

    expect(doc.vocativo).toEqual(['Sr. Presidente,', 'Sras. Vereadoras e', 'Srs. Vereadores.']);
    expect(doc.preambulo).toHaveLength(1);
    expect(doc.preambulo[0]).toContain('Foramos procurados por moradores');
    expect(doc.tituloNumero).toBeNull();          // "____" = deixar para o protocolo
    expect(doc.tituloAno).toBe(2026);
    expect(doc.corpo[0]).toContain('Indico à Mesa');
    expect(doc.providencias).toHaveLength(1);
    expect(doc.providencias[0]).toMatch(/^1\./);
    expect(doc.local).toBe('Sala Alberto Santos Dumont');
    expect(doc.data?.getFullYear()).toBe(2026);
    expect(doc.data?.getMonth()).toBe(3);          // abril
    expect(doc.data?.getDate()).toBe(13);
  });

  it('valdemir: preâmbulo longo com 2 parágrafos e 2 providências', () => {
    const doc = parseTextoToDoc(exemplo('valdemir', 'tapa_buraco'), TEMPLATE);

    expect(doc.vocativo).toEqual(['SENHOR PRESIDENTE,', 'SENHORAS VEREADORAS,', 'SENHORES VEREADORES;']);
    expect(doc.preambulo).toHaveLength(2);
    expect(doc.providencias).toHaveLength(2);
    expect(doc.providencias[1]).toMatch(/^2\./);
  });

  it('ariani_paz: sem preâmbulo e todo em caixa alta', () => {
    const doc = parseTextoToDoc(exemplo('ariani_paz', 'tapa_buraco'), TEMPLATE);

    expect(doc.vocativo).toEqual(['SR. PRESIDENTE,', 'SRAS. VEREADORAS E', 'SRS. VEREADORES.']);
    expect(doc.preambulo).toHaveLength(0);         // vai direto ao título
    expect(doc.corpo[0]).toContain('INDICO À MESA');
    expect(doc.providencias).toHaveLength(1);
    expect(doc.local).toBe('SALA ALBERTO SANTOS DUMONT');  // preserva a caixa
  });

  it('juninho_eroso: parágrafo único, sem providências numeradas', () => {
    const doc = parseTextoToDoc(exemplo('juninho_eroso', 'tapa_buraco'), TEMPLATE);

    expect(doc.vocativo).toHaveLength(3);
    expect(doc.preambulo).toHaveLength(0);
    expect(doc.corpo).toHaveLength(1);
    expect(doc.providencias).toHaveLength(0);
    expect(doc.corpo[0]).toContain('Indicamos a mesa');
  });
});

describe('round-trip parse → serialize', () => {
  const casos: [string, string][] = [
    ['marcio_pet', 'tapa_buraco'],
    ['marcio_pet', 'limpeza_canal'],
    ['valdemir', 'tapa_buraco'],
    ['valdemir', 'iluminacao_publica'],
    ['ariani_paz', 'tapa_buraco'],
    ['ariani_paz', 'iluminacao_publica'],
    ['juninho_eroso', 'tapa_buraco'],
    ['juninho_eroso', 'capinacao'],
    ['generico', 'tapa_buraco'],
    ['generico', 'cultura_lazer'],
    ['generico', 'multiplos_servicos'],
  ];

  it.each(casos)('preserva o texto de %s/%s', (slug, arquivo) => {
    const original = exemplo(slug, arquivo);
    const refeito = docToTexto(parseTextoToDoc(original, TEMPLATE));
    expect(refeito.trim()).toBe(original.trim());
  });
});

describe('detalhes do parser', () => {
  it('extrai o número quando ele existe, em vez de null', () => {
    const texto = [
      'Sr. Presidente,',
      '',
      'INDICAÇÃO Nº 9818 /2026',
      '',
      'Indico à Mesa...',
      '',
      'Sala Alberto Santos Dumont, 9 de junho de 2026.',
    ].join('\n');

    const doc = parseTextoToDoc(texto, TEMPLATE);
    expect(doc.tituloNumero).toBe('9818');
  });

  it('herda assinatura do template — ela não vem no texto gerado', () => {
    const doc = parseTextoToDoc(exemplo('marcio_pet', 'tapa_buraco'), TEMPLATE);
    expect(doc.assinaturaNome).toBe('MÁRCIO NABOR TARDELLI');
    expect(doc.assinaturaCargo).toBe('Vereador');
  });

  it('não confunde parágrafo comum com vocativo', () => {
    const doc = parseTextoToDoc(exemplo('valdemir', 'tapa_buraco'), TEMPLATE);
    for (const p of doc.preambulo) expect(p.length).toBeGreaterThan(60);
  });

  it('texto vazio não quebra', () => {
    const doc = parseTextoToDoc('', TEMPLATE);
    expect(doc.vocativo).toHaveLength(0);
    expect(doc.corpo).toHaveLength(0);
    expect(doc.data).toBeNull();
  });
});
