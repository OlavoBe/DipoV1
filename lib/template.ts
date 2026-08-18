import { z } from 'zod';
import { prisma } from './db';
import { getVereadorPerfil } from './vereadores';

// ─────────────────────────────────────────────
// Tipos do template
// ─────────────────────────────────────────────

export interface TemplateSettings {
  version?: number;
  institution: {
    name: string;
    title: string;
    subtitle: string;
    gabinete: string;
    email: string;
  };
  vereador: {
    nome: string;
    cargo: string;
    salaLocal: string;
    nomePrefeito: string;
  };
  logos: {
    left: string | null;          // base64 data URL
    leftSize?: number;            // % 50-200, default 100
    right: string | null;
    rightSize?: number;
    partido?: string | null;      // logo do partido (abaixo da assinatura)
    partidoSize?: number;
    watermark: string | null;
    watermarkOpacity: number;
    watermarkSize?: number;
    signature: string | null;
    signatureSize?: number;
  };
  typography: {
    fontFamily: string;            // corpo do documento
    fontFamilyCabecalho?: string;  // cabeçalho; ausente = usa fontFamily
    fontSize: number;
    lineHeight: number;
    paragraphSpacing: number;
    paragraphIndent: number;
    textJustified: boolean;
  };
  colors: {
    text: string;
    header: string;
    background: string;
    divider: string;
    dividerWidth: number;
    leftBorder: boolean;
    leftBorderColor: string;
    footerLine: boolean;
  };
  layout: {
    marginLateral: number;   // mm
    marginTopBottom: number;  // mm
  };
  /** Layout estrutural. Ausente = HTML legado (mantem o visual dos templates antigos). */
  layoutId?: string;
  /** Escape hatch: CSS injetado por ultimo, para ajustes finos por gabinete. */
  customCss?: string;
  content?: string;
}

// ─────────────────────────────────────────────
// Defaults
// ─────────────────────────────────────────────

/**
 * Defaults NEUTROS — não contêm dados de nenhum gabinete específico.
 *
 * Os campos de identificação (subtitle, gabinete, email, vereador.nome) ficam
 * vazios de propósito: são preenchidos por `buildTenantDefaults()` a partir do
 * tenant. Antes havia os dados de um vereador hardcoded aqui, que vazavam para
 * qualquer gabinete sem template salvo.
 */
export const DEFAULT_SETTINGS: TemplateSettings = {
  version: 1,
  institution: {
    name: 'Câmara Municipal de Guarujá',
    title: 'ESTADO DE SÃO PAULO',
    subtitle: '',
    gabinete: '',
    email: '',
  },
  vereador: {
    nome: '',
    cargo: 'Vereador',
    salaLocal: 'Sala Alberto Santos Dumont',
    nomePrefeito: 'Farid Said Madi',
  },
  logos: {
    left: null,
    leftSize: 100,
    right: null,
    rightSize: 100,
    partido: null,
    partidoSize: 100,
    watermark: null,
    watermarkOpacity: 8,
    watermarkSize: 100,
    signature: null,
    signatureSize: 100,
  },
  typography: {
    // O documento de referência do gabinete usa Bookman Old Style no corpo e
    // Times New Roman no cabeçalho. Os defaults mantêm Times nos dois para não
    // alterar o visual dos PDFs já em uso — a mudança para Bookman no corpo
    // deve ser feita por template, junto da calibração (ver docs/).
    fontFamily: "'Times New Roman', Times, serif",
    fontFamilyCabecalho: "'Times New Roman', Times, serif",
    fontSize: 12,
    lineHeight: 1.5,
    paragraphSpacing: 12,
    paragraphIndent: 0,
    textJustified: true,
  },
  colors: {
    text: '#000000',
    header: '#000000',
    background: '#ffffff',
    divider: '#000000',
    dividerWidth: 2,
    leftBorder: false,
    leftBorderColor: '#1a365d',
    footerLine: true,
  },
  layout: {
    marginLateral: 25,
    marginTopBottom: 25,
  },
};

// ─────────────────────────────────────────────
// Acesso ao banco
// ─────────────────────────────────────────────

/**
 * Monta os defaults do tenant: parte dos defaults neutros e preenche a
 * identificação do gabinete a partir do perfil do vereador (quando é um dos
 * gabinetes com perfil dedicado) ou dos dados do onboarding.
 *
 * Sem `tenantId` — o caso da demo pública — devolve os defaults neutros, sem
 * consultar o banco. Nunca cai no template de outro tenant.
 */
async function buildTenantDefaults(tenantId?: string): Promise<TemplateSettings> {
  const base: TemplateSettings = structuredClone(DEFAULT_SETTINGS);
  if (!tenantId) return base;

  try {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { nomeVereador: true, municipio: true, vereadorSlug: true },
    });
    if (!tenant) return base;

    const perfil = tenant.vereadorSlug && tenant.vereadorSlug !== 'outro'
      ? getVereadorPerfil(tenant.vereadorSlug)
      : null;

    const nomeVereador = perfil?.nomeCompleto || tenant.nomeVereador || '';

    if (tenant.municipio) {
      base.institution.name = `Câmara Municipal de ${tenant.municipio}`;
    }
    base.institution.subtitle = nomeVereador;
    base.institution.gabinete = perfil?.gabinete
      || (nomeVereador ? `Gabinete do Vereador ${nomeVereador.toUpperCase()}` : '');
    base.institution.email = perfil?.email || '';

    base.vereador.nome         = nomeVereador.toUpperCase();
    base.vereador.salaLocal    = perfil?.salaLocal    || base.vereador.salaLocal;
    base.vereador.nomePrefeito = perfil?.nomePrefeito || base.vereador.nomePrefeito;
  } catch (e) {
    console.warn('[template] Falha ao montar defaults do tenant:', e);
  }

  return base;
}

/**
 * Schema do que pode vir gravado em `Template.settings`.
 *
 * Tudo é opcional de propósito: o editor salva parcialmente e o merge com os
 * defaults completa o resto. O papel do schema não é impor campos, é barrar
 * lixo — um template gravado por uma versão antiga do editor, um número onde
 * se espera texto, um JSON truncado. Sem isso o erro só aparecia na hora de
 * gerar o documento, que é o pior momento possível.
 */
const TemplateSettingsSchema = z.object({
  version: z.number().optional(),
  institution: z.object({
    name: z.string(), title: z.string(), subtitle: z.string(),
    gabinete: z.string(), email: z.string(),
  }).partial().optional(),
  vereador: z.object({
    nome: z.string(), cargo: z.string(), salaLocal: z.string(), nomePrefeito: z.string(),
  }).partial().optional(),
  logos: z.object({
    left: z.string().nullable(), leftSize: z.number(),
    right: z.string().nullable(), rightSize: z.number(),
    partido: z.string().nullable(), partidoSize: z.number(),
    watermark: z.string().nullable(), watermarkOpacity: z.number(), watermarkSize: z.number(),
    signature: z.string().nullable(), signatureSize: z.number(),
  }).partial().optional(),
  typography: z.object({
    fontFamily: z.string(), fontFamilyCabecalho: z.string(),
    fontSize: z.number(), lineHeight: z.number(),
    paragraphSpacing: z.number(), paragraphIndent: z.number(),
    textJustified: z.boolean(),
  }).partial().optional(),
  colors: z.object({
    text: z.string(), header: z.string(), background: z.string(),
    divider: z.string(), dividerWidth: z.number(),
    leftBorder: z.boolean(), leftBorderColor: z.string(), footerLine: z.boolean(),
  }).partial().optional(),
  layout: z.object({
    marginLateral: z.number(), marginTopBottom: z.number(),
  }).partial().optional(),
  layoutId: z.string().optional(),
  customCss: z.string().optional(),
  content: z.string().optional(),
}).passthrough();

/**
 * Aplica o JSON salvo sobre os defaults do tenant.
 *
 * JSON inválido ou fora do schema não derruba a geração: registra o motivo e
 * devolve os defaults, que sempre produzem um documento válido.
 */
function mergeSettings(defaults: TemplateSettings, settingsJson: string): TemplateSettings {
  let bruto: unknown;
  try {
    bruto = JSON.parse(settingsJson);
  } catch (e) {
    console.warn('[template] settings não é JSON válido, usando defaults:', e);
    return defaults;
  }

  const resultado = TemplateSettingsSchema.safeParse(bruto);
  if (!resultado.success) {
    console.warn(
      '[template] settings fora do schema, usando defaults:',
      resultado.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
    );
    return defaults;
  }

  return deepMerge(
    defaults as unknown as Record<string, unknown>,
    resultado.data as unknown as Record<string, unknown>,
  ) as unknown as TemplateSettings;
}

/**
 * Carrega o template ativo DO TENANT. Retorna os defaults do tenant se não
 * houver nenhum salvo.
 *
 * `tenantId` é obrigatório para tocar o banco: sem ele a busca voltaria a
 * pegar o template ativo de qualquer gabinete.
 */
export async function getActiveTemplate(tenantId?: string): Promise<TemplateSettings> {
  const defaults = await buildTenantDefaults(tenantId);
  if (!tenantId) return defaults;

  try {
    const record = await prisma.template.findFirst({
      where: { tenantId, isActive: true },
      orderBy: { updatedAt: 'desc' },
    });
    if (record) return mergeSettings(defaults, record.settings);
  } catch (e) {
    console.warn('[template] Falha ao carregar do DB, usando defaults:', e);
  }
  return defaults;
}

/**
 * Carrega um template pelo ID, restrito ao tenant.
 * Um ID de outro tenant não é encontrado — cai nos defaults do tenant atual.
 */
export async function getTemplateById(id: string, tenantId?: string): Promise<TemplateSettings> {
  const defaults = await buildTenantDefaults(tenantId);
  if (!tenantId) return defaults;

  try {
    const record = await prisma.template.findFirst({ where: { id, tenantId } });
    if (record) return mergeSettings(defaults, record.settings);
  } catch (e) {
    console.warn('[template] Falha ao carregar template por ID:', e);
  }
  return defaults;
}

/** Retorna o template pelo ID (se fornecido) ou o template ativo do tenant. */
export async function getTemplate(templateId?: string, tenantId?: string): Promise<TemplateSettings> {
  if (templateId) return getTemplateById(templateId, tenantId);
  return getActiveTemplate(tenantId);
}

/**
 * Salva/atualiza o template ativo do tenant (ou cria um novo com o nome dado).
 *
 * `tenantId` é obrigatório: antes, na ausência dele, gravava `tenantId: ''`,
 * que viola a foreign key de Template.tenantId no Postgres.
 */
export async function saveActiveTemplate(
  settings: Partial<TemplateSettings>,
  name?: string,
  createNew?: boolean,
  tenantId?: string,
): Promise<string> {
  if (!tenantId) {
    throw new Error('saveActiveTemplate: tenantId é obrigatório para salvar um template.');
  }

  const json = JSON.stringify(settings);

  if (createNew) {
    const record = await prisma.template.create({
      data: { settings: json, name: name || 'Novo Template', isActive: false, tenantId },
    });
    return record.id;
  }

  const existing = await prisma.template.findFirst({
    where: { tenantId, isActive: true },
    orderBy: { updatedAt: 'desc' },
  });

  if (existing) {
    await prisma.template.update({
      where: { id: existing.id },
      data: { settings: json, name: name || existing.name },
    });
    return existing.id;
  }

  const record = await prisma.template.create({
    data: { settings: json, name: name || 'Template Padrão', tenantId },
  });
  return record.id;
}

// ─────────────────────────────────────────────
// Utilitário de deep merge
// ─────────────────────────────────────────────

function deepMerge(target: Record<string, unknown>, source: Record<string, unknown>): Record<string, unknown> {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    const sv = source[key];
    const tv = target[key];
    if (sv && typeof sv === 'object' && !Array.isArray(sv) && tv && typeof tv === 'object' && !Array.isArray(tv)) {
      result[key] = deepMerge(tv as Record<string, unknown>, sv as Record<string, unknown>);
    } else if (sv !== undefined) {
      result[key] = sv;
    }
  }
  return result;
}
