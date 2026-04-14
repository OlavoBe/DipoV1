/**
 * Fixtures compartilhados entre os testes.
 * Dados mínimos válidos para ExtractedData e variações.
 */

import type { ExtractedData } from '@/lib/types';

/** ExtractedData mínimo válido para servico_urbano */
export function makeExtracted(overrides: Partial<ExtractedData> = {}): ExtractedData {
  return {
    categoria:               'servico_urbano',
    tema:                    'Tapa-buraco na Rua das Flores',
    descricao_problema:      'Buraco de 60cm causando risco a motociclistas',
    providencias_sugeridas:  ['Execução de operação tapa-buraco'],
    observacoes_contextuais: '',
    perguntas_faltantes:     [],
    origem_solicitacao:      'moradores',
    tipo_problema:           'buraco no asfalto',
    logradouro:              'Rua das Flores',
    numero:                  '120',
    bairro:                  'Jardim Três Marias',
    cidade:                  'Guarujá',
    uf:                      'SP',
    cep:                     null,
    ponto_referencia:        null,
    trecho_localizacao:      null,
    tipos_servico:           ['tapa_buraco'],
    impactos:                ['risco de acidentes'],
    precisa_maquinario:      false,
    sugestao_maquinario:     [],
    precisa_estudo_tecnico:  false,
    ...overrides,
  };
}

/** ExtractedData mínimo válido para categoria geral (sem localização) */
export function makeExtractedGeral(overrides: Partial<ExtractedData> = {}): ExtractedData {
  return {
    categoria:               'cultura_lazer',
    tema:                    'Reconhecimento de patrimônio cultural',
    descricao_problema:      'Solicitação de reconhecimento da festa junina como patrimônio imaterial',
    providencias_sugeridas:  ['Instauração de processo de reconhecimento'],
    observacoes_contextuais: '',
    perguntas_faltantes:     [],
    origem_solicitacao:      null,
    tipo_problema:           null,
    logradouro:              '',
    numero:                  's/n',
    bairro:                  '',
    cidade:                  'Guarujá',
    uf:                      'SP',
    cep:                     null,
    ponto_referencia:        null,
    trecho_localizacao:      null,
    tipos_servico:           [],
    impactos:                [],
    precisa_maquinario:      false,
    sugestao_maquinario:     [],
    precisa_estudo_tecnico:  false,
    ...overrides,
  };
}
