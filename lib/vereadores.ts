/**
 * Perfis de vereador — personalização da geração de indicações.
 * Cada perfil define o estilo textual, estrutura e formatação do gabinete.
 */

export interface VereadorPerfil {
  slug: string;              // identificador único (ex: 'juninho_eroso')
  nomeCompleto: string;      // nome formal completo
  nomeExibicao: string;      // como aparece no dropdown
  apelido: string;           // apelido político entre aspas
  partido: string;
  saudacao: 'tipo_a' | 'tipo_b';
  // tipo_a = "SENHOR PRESIDENTE, / SENHORAS VEREADORAS, / SENHORES VEREADORES;"
  // tipo_b = "Sr. Presidente, / Sras. Vereadoras e / Srs. Vereadores."
  estiloCorpo: 'variacao_1' | 'variacao_2' | 'variacao_3';
  // variacao_1 = Padrão clássico conciso (Juninho)
  // variacao_2 = Providências numeradas (Márcio, Ariani, Valdemir)
  // variacao_3 = Douto plenário (Aparecido Davi, Andréia)
  temJustificativa: boolean;
  estiloJustificativa: 'ausente' | 'narrativa_demanda' | 'argumentacao_tecnica' | 'narrativa_campo';
  usaCaixaAlta: boolean;       // Ariani usa CAIXA ALTA no corpo
  cepSemprePresente: boolean;  // Ariani sempre inclui CEP
  prefixoDemanda: string | null; // ex: "Fomos procurados por moradores" para Márcio
  nomePrefeito: string;        // default: "Farid Said Madi"
  salaLocal: string;           // default: "Sala Alberto Santos Dumont"
  gabinete: string;            // ex: "Gabinete do Vereador EDMAR LIMA DOS SANTOS"
  email: string;               // email do gabinete
}

export const VEREADORES_BETA: VereadorPerfil[] = [
  {
    slug: 'juninho_eroso',
    nomeCompleto: 'EDMAR LIMA DOS SANTOS',
    nomeExibicao: 'Vereador Juninho Eroso',
    apelido: '"Juninho Eroso"',
    partido: '',
    saudacao: 'tipo_b',
    estiloCorpo: 'variacao_1',
    temJustificativa: false,
    estiloJustificativa: 'ausente',
    usaCaixaAlta: false,
    cepSemprePresente: false,
    prefixoDemanda: null,
    nomePrefeito: 'Farid Said Madi',
    salaLocal: 'Sala Alberto Santos Dumont',
    gabinete: 'Gabinete do Vereador EDMAR LIMA DOS SANTOS',
    email: '',
  },
  {
    slug: 'ariani_paz',
    nomeCompleto: 'ARIANI DA SILVA PAZ',
    nomeExibicao: 'Vereadora Ariani',
    apelido: '"Ariani"',
    partido: '',
    saudacao: 'tipo_b',
    estiloCorpo: 'variacao_2',
    temJustificativa: false,
    estiloJustificativa: 'ausente',
    usaCaixaAlta: true,
    cepSemprePresente: true,
    prefixoDemanda: null,
    nomePrefeito: 'Farid Said Madi',
    salaLocal: 'Sala Alberto Santos Dumont',
    gabinete: 'Gabinete da Vereadora ARIANI DA SILVA PAZ',
    email: '',
  },
  {
    slug: 'marcio_pet',
    nomeCompleto: 'MÁRCIO NABOR TARDELLI',
    nomeExibicao: 'Vereador Márcio do Pet',
    apelido: '"Márcio do Pet Shop"',
    partido: '',
    saudacao: 'tipo_b',
    estiloCorpo: 'variacao_2',
    temJustificativa: true,
    estiloJustificativa: 'narrativa_demanda',
    usaCaixaAlta: false,
    cepSemprePresente: false,
    prefixoDemanda: 'Fomos procurados por moradores',
    nomePrefeito: 'Farid Said Madi',
    salaLocal: 'Sala Alberto Santos Dumont',
    gabinete: 'Gabinete do Vereador MÁRCIO DO PET SHOP',
    email: 'Marcio@camaraguaruja.sp.gov.br',
  },
  {
    slug: 'valdemir',
    nomeCompleto: 'VALDEMIR BATISTA SANTANA',
    nomeExibicao: 'Vereador Valdemir',
    apelido: '"Val Advogado"',
    partido: 'Podemos',
    saudacao: 'tipo_a',
    estiloCorpo: 'variacao_2',
    temJustificativa: true,
    estiloJustificativa: 'argumentacao_tecnica',
    usaCaixaAlta: false,
    cepSemprePresente: false,
    prefixoDemanda: null,
    nomePrefeito: 'Farid Said Madi',
    salaLocal: 'Sala Alberto Santos Dumont',
    gabinete: 'Gabinete do Vereador VALDEMIR BATISTA SANTANA',
    email: '',
  },
];

export function getVereadorPerfil(slug: string): VereadorPerfil | null {
  return VEREADORES_BETA.find(v => v.slug === slug) ?? null;
}

export function isVereadorBeta(slug: string): boolean {
  return VEREADORES_BETA.some(v => v.slug === slug);
}
