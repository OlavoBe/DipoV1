import { prisma } from './db';

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
    fontFamily: string;
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
  content?: string;
}

// ─────────────────────────────────────────────
// Defaults
// ─────────────────────────────────────────────

export const DEFAULT_SETTINGS: TemplateSettings = {
  version: 1,
  institution: {
    name: 'Câmara Municipal de Guarujá',
    title: 'ESTADO DE SÃO PAULO',
    subtitle: 'Márcio Nabor Tardelli',
    gabinete: 'Gabinete do Vereador MÁRCIO DO PET SHOP',
    email: 'Marcio@camaraguaruja.sp.gov.br',
  },
  vereador: {
    nome: 'MÁRCIO NABOR TARDELLI',
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
    fontFamily: "'Times New Roman', Times, serif",
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

/** Carrega o template ativo. Retorna defaults se nenhum for encontrado. */
export async function getActiveTemplate(tenantId?: string): Promise<TemplateSettings> {
  try {
    const record = await prisma.template.findFirst({
      where: { isActive: true, ...(tenantId ? { tenantId } : {}) },
      orderBy: { updatedAt: 'desc' },
    });

    if (record) {
      const parsed = JSON.parse(record.settings) as Partial<TemplateSettings>;
      return deepMerge(
        DEFAULT_SETTINGS as unknown as Record<string, unknown>,
        parsed as unknown as Record<string, unknown>,
      ) as unknown as TemplateSettings;
    }
  } catch (e) {
    console.warn('[template] Falha ao carregar do DB, usando defaults:', e);
  }
  return { ...DEFAULT_SETTINGS };
}

/** Carrega um template pelo ID. Retorna defaults se não encontrado. */
export async function getTemplateById(id: string, tenantId?: string): Promise<TemplateSettings> {
  try {
    const record = await prisma.template.findUnique({
      where: { id, ...(tenantId ? { tenantId } : {}) },
    });
    if (record) {
      const parsed = JSON.parse(record.settings) as Partial<TemplateSettings>;
      return deepMerge(
        DEFAULT_SETTINGS as unknown as Record<string, unknown>,
        parsed as unknown as Record<string, unknown>,
      ) as unknown as TemplateSettings;
    }
  } catch (e) {
    console.warn('[template] Falha ao carregar template por ID:', e);
  }
  return { ...DEFAULT_SETTINGS };
}

/** Retorna o template pelo ID (se fornecido) ou o template ativo. */
export async function getTemplate(templateId?: string, tenantId?: string): Promise<TemplateSettings> {
  if (templateId) return getTemplateById(templateId, tenantId);
  return getActiveTemplate(tenantId);
}

/** Salva/atualiza o template ativo (ou cria um novo com o nome dado). */
export async function saveActiveTemplate(
  settings: Partial<TemplateSettings>,
  name?: string,
  createNew?: boolean,
  tenantId?: string,
): Promise<string> {
  const json = JSON.stringify(settings);

  if (createNew) {
    const record = await prisma.template.create({
      data: { settings: json, name: name || 'Novo Template', isActive: false, tenantId: tenantId ?? '' },
    });
    return record.id;
  }

  const existing = await prisma.template.findFirst({
    where: { isActive: true, ...(tenantId ? { tenantId } : {}) },
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
    data: { settings: json, name: name || 'Template Padrão', tenantId: tenantId ?? '' },
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
