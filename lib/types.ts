// ─────────────────────────────────────────────
// Categorias de indicação
// ─────────────────────────────────────────────

export type IndicacaoCategoria =
  | 'servico_urbano'      // tapa-buraco, limpeza, iluminação, drenagem…
  | 'seguranca_publica'   // câmeras, policiamento, sinalização de trânsito…
  | 'saude'               // UBS, medicamentos, equipamentos, campanhas…
  | 'educacao'            // escolas, transporte escolar, cursos, merenda…
  | 'cultura_lazer'       // patrimônio cultural, eventos, praças, esporte, arte…
  | 'meio_ambiente'       // arborização, parques, preservação ambiental…
  | 'homenagem'           // título honorífico, nome de rua/escola, medalha…
  | 'outros';             // qualquer outro pedido legislativo

// ─────────────────────────────────────────────
// Tipos de serviço (apenas para servico_urbano)
// ─────────────────────────────────────────────

export type TipoServico =
  | 'tapa_buraco'
  | 'capinacao_rocada'
  | 'iluminacao_publica'
  | 'drenagem_galerias'
  | 'limpeza_canal_desassoreamento'
  | 'redutor_velocidade'
  | 'retirada_lixo_entulho'
  | 'fiscalizacao_transito'
  | 'vulnerabilidade_social'
  | 'estudo_tecnico'
  | 'outro';

// ─────────────────────────────────────────────
// Dados extraídos — estrutura unificada
// ─────────────────────────────────────────────

export interface ExtractedData {
  // ── Presentes em TODAS as categorias ──────────────────
  categoria: IndicacaoCategoria;
  tema: string;                       // resumo em 1 linha do pedido
  descricao_problema: string;         // o que o usuário relatou
  providencias_sugeridas: string[];   // o que se quer que aconteça
  observacoes_contextuais: string;
  perguntas_faltantes: string[];

  // ── Localização (servico_urbano / seguranca_publica) ──
  // Para outras categorias ficam vazios ("")
  logradouro: string;
  numero: string;
  bairro: string;
  cidade: string;
  uf: string;
  cep: string | null;
  ponto_referencia: string | null;

  // ── Específico de serviço urbano ──────────────────────
  tipos_servico: string[];          // substitui tipo_servico; suporta múltiplos serviços
  impactos: string[];
  precisa_maquinario: boolean;
  sugestao_maquinario: string[];
  precisa_estudo_tecnico: boolean;

  // ── Campos de contexto (todas as categorias) ──────────
  origem_solicitacao: string | null;  // ex: "moradores", "comerciantes", "pais de alunos"
  tipo_problema: string | null;       // ex: "buraco", "mato alto", "tampa quebrada"
  trecho_localizacao: string | null;  // ex: "atrás da Escola 1º de Maio", "final da rua"

  // ── Metadado de geo-enriquecimento (uso interno) ──────
  geo_enriquecido?: boolean; // true quando geocoder preencheu bairro/cep automaticamente
}

// ─────────────────────────────────────────────
// Request / Response da API
// ─────────────────────────────────────────────

export interface IndicacaoRequest {
  texto: string;
  complementos?: Record<string, string>;
}

export interface IndicacaoResponse {
  status: 'success' | 'incomplete' | 'error';
  texto_final?: string;
  record_id?: string;
  perguntas_faltantes?: string[];
  extracted?: ExtractedData;
  error?: string;
}
