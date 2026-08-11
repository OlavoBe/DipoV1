import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * Cobre o isolamento por tenant de lib/template.ts.
 *
 * Regressões que estes testes travam:
 *  - buscar o template ativo sem filtrar por tenant (um gabinete renderizava
 *    PDF/DOCX com o cabeçalho de outro);
 *  - defaults com os dados de um vereador hardcoded, que vazavam para
 *    qualquer gabinete sem template salvo;
 *  - salvar template com `tenantId: ''`, que viola a FK no Postgres.
 */

const mocks = vi.hoisted(() => ({
  prisma: {
    tenant:   { findUnique: vi.fn() },
    template: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
  },
}));

vi.mock('@/lib/db', () => ({ prisma: mocks.prisma, default: mocks.prisma }));

import {
  DEFAULT_SETTINGS,
  getActiveTemplate,
  getTemplateById,
  saveActiveTemplate,
} from '@/lib/template';

const TENANT_A = 'tenant-a';
const TENANT_B = 'tenant-b';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.prisma.template.findFirst.mockResolvedValue(null);
  mocks.prisma.tenant.findUnique.mockResolvedValue(null);
});

describe('DEFAULT_SETTINGS', () => {
  it('não carrega dados de nenhum gabinete específico', () => {
    expect(DEFAULT_SETTINGS.institution.subtitle).toBe('');
    expect(DEFAULT_SETTINGS.institution.gabinete).toBe('');
    expect(DEFAULT_SETTINGS.institution.email).toBe('');
    expect(DEFAULT_SETTINGS.vereador.nome).toBe('');
  });
});

describe('getActiveTemplate', () => {
  it('sem tenantId não consulta o banco e devolve defaults neutros', async () => {
    const t = await getActiveTemplate();

    expect(mocks.prisma.template.findFirst).not.toHaveBeenCalled();
    expect(mocks.prisma.tenant.findUnique).not.toHaveBeenCalled();
    expect(t.vereador.nome).toBe('');
    expect(t.institution.gabinete).toBe('');
  });

  it('filtra a busca do template pelo tenant', async () => {
    await getActiveTemplate(TENANT_A);

    expect(mocks.prisma.template.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: TENANT_A, isActive: true },
      }),
    );
  });

  it('aplica o template salvo sobre os defaults do tenant', async () => {
    mocks.prisma.tenant.findUnique.mockResolvedValue({
      nomeVereador: 'Fulano de Tal',
      municipio: 'Guarujá',
      vereadorSlug: 'outro',
    });
    mocks.prisma.template.findFirst.mockResolvedValue({
      settings: JSON.stringify({ typography: { fontSize: 14 } }),
    });

    const t = await getActiveTemplate(TENANT_A);

    expect(t.typography.fontSize).toBe(14);          // veio do template salvo
    expect(t.vereador.nome).toBe('FULANO DE TAL');   // veio dos defaults do tenant
    expect(t.typography.lineHeight).toBe(1.5);       // veio dos defaults globais
  });
});

describe('defaults derivados do tenant', () => {
  it('usa o perfil quando o tenant tem vereadorSlug dedicado', async () => {
    mocks.prisma.tenant.findUnique.mockResolvedValue({
      nomeVereador: 'ignorado',
      municipio: 'Guarujá',
      vereadorSlug: 'marcio_pet',
    });

    const t = await getActiveTemplate(TENANT_A);

    expect(t.vereador.nome).toBe('MÁRCIO NABOR TARDELLI');
    expect(t.institution.gabinete).toBe('Gabinete do Vereador MÁRCIO DO PET SHOP');
    expect(t.institution.email).toBe('Marcio@camaraguaruja.sp.gov.br');
  });

  it('usa os dados do onboarding quando o slug é "outro"', async () => {
    mocks.prisma.tenant.findUnique.mockResolvedValue({
      nomeVereador: 'Maria Souza',
      municipio: 'Santos',
      vereadorSlug: 'outro',
    });

    const t = await getActiveTemplate(TENANT_A);

    expect(t.institution.name).toBe('Câmara Municipal de Santos');
    expect(t.institution.subtitle).toBe('Maria Souza');
    expect(t.institution.gabinete).toBe('Gabinete do Vereador MARIA SOUZA');
    expect(t.vereador.nome).toBe('MARIA SOUZA');
  });

  it('não vaza o gabinete de um tenant para outro', async () => {
    mocks.prisma.tenant.findUnique.mockResolvedValue({
      nomeVereador: '', municipio: 'Guarujá', vereadorSlug: 'marcio_pet',
    });
    const a = await getActiveTemplate(TENANT_A);

    mocks.prisma.tenant.findUnique.mockResolvedValue({
      nomeVereador: '', municipio: 'Guarujá', vereadorSlug: 'ariani_paz',
    });
    const b = await getActiveTemplate(TENANT_B);

    expect(a.institution.gabinete).not.toBe(b.institution.gabinete);
    expect(b.vereador.nome).toBe('ARIANI DA SILVA PAZ');
  });
});

describe('settings corrompido não derruba a geração', () => {
  beforeEach(() => {
    mocks.prisma.tenant.findUnique.mockResolvedValue({
      nomeVereador: 'Maria Souza', municipio: 'Guarujá', vereadorSlug: 'outro',
    });
  });

  it('JSON inválido cai nos defaults do tenant', async () => {
    mocks.prisma.template.findFirst.mockResolvedValue({ settings: '{"typography": ' });
    const t = await getActiveTemplate(TENANT_A);

    expect(t.vereador.nome).toBe('MARIA SOUZA');
    expect(t.typography.fontSize).toBe(DEFAULT_SETTINGS.typography.fontSize);
  });

  it('tipo errado num campo cai nos defaults em vez de gerar documento quebrado', async () => {
    // fontSize como texto quebraria o CSS silenciosamente
    mocks.prisma.template.findFirst.mockResolvedValue({
      settings: JSON.stringify({ typography: { fontSize: 'grande' } }),
    });
    const t = await getActiveTemplate(TENANT_A);

    expect(t.typography.fontSize).toBe(DEFAULT_SETTINGS.typography.fontSize);
  });

  it('template parcial válido é aplicado normalmente', async () => {
    mocks.prisma.template.findFirst.mockResolvedValue({
      settings: JSON.stringify({ typography: { fontSize: 14 }, layout: { marginLateral: 31.7 } }),
    });
    const t = await getActiveTemplate(TENANT_A);

    expect(t.typography.fontSize).toBe(14);
    expect(t.layout.marginLateral).toBe(31.7);
    expect(t.typography.lineHeight).toBe(DEFAULT_SETTINGS.typography.lineHeight);
  });

  it('campo desconhecido não invalida o template', async () => {
    mocks.prisma.template.findFirst.mockResolvedValue({
      settings: JSON.stringify({ typography: { fontSize: 13 }, campoNovoDoEditor: true }),
    });
    const t = await getActiveTemplate(TENANT_A);

    expect(t.typography.fontSize).toBe(13);
  });
});

describe('getTemplateById', () => {
  it('restringe a busca ao tenant', async () => {
    await getTemplateById('tpl-1', TENANT_A);

    expect(mocks.prisma.template.findFirst).toHaveBeenCalledWith({
      where: { id: 'tpl-1', tenantId: TENANT_A },
    });
  });

  it('um template de outro tenant não é encontrado — cai nos defaults', async () => {
    mocks.prisma.tenant.findUnique.mockResolvedValue({
      nomeVereador: 'Maria Souza', municipio: 'Guarujá', vereadorSlug: 'outro',
    });
    mocks.prisma.template.findFirst.mockResolvedValue(null); // filtrado pelo where

    const t = await getTemplateById('tpl-de-outro-tenant', TENANT_A);

    expect(t.vereador.nome).toBe('MARIA SOUZA');
  });

  it('sem tenantId não consulta o banco', async () => {
    await getTemplateById('tpl-1');
    expect(mocks.prisma.template.findFirst).not.toHaveBeenCalled();
  });
});

describe('saveActiveTemplate', () => {
  it('recusa salvar sem tenantId em vez de gravar tenantId vazio', async () => {
    await expect(saveActiveTemplate({}, 'Nome', false, undefined)).rejects.toThrow(/tenantId/);
    expect(mocks.prisma.template.create).not.toHaveBeenCalled();
  });

  it('cria o template com o tenantId recebido', async () => {
    mocks.prisma.template.create.mockResolvedValue({ id: 'novo' });

    const id = await saveActiveTemplate({}, 'Meu Template', true, TENANT_A);

    expect(id).toBe('novo');
    expect(mocks.prisma.template.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ tenantId: TENANT_A }),
      }),
    );
  });

  it('atualiza o template ativo do próprio tenant', async () => {
    mocks.prisma.template.findFirst.mockResolvedValue({ id: 'tpl-a', name: 'Antigo' });
    mocks.prisma.template.update.mockResolvedValue({ id: 'tpl-a' });

    const id = await saveActiveTemplate({}, undefined, false, TENANT_A);

    expect(id).toBe('tpl-a');
    expect(mocks.prisma.template.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId: TENANT_A, isActive: true } }),
    );
  });
});
