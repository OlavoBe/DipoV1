/**
 * Integration — PATCH /api/tenant/setup
 *
 * Testa:
 *  1. Slug beta (usuário com tenant) → nome auto-preenchido do perfil
 *  2. Slug "outro" → usa nome do body, plano TRIAL
 *  3. nomeVereador ausente → 400
 *  4. nomeAssessor ausente → 400
 *  5. Sem sessão → 401
 *  6. complete=true → chama user.update com onboardingComplete
 *  7. Slug genérico sem tenant → cria TRIAL e vincula
 *  8. Slug beta sem tenant, beta pré-existente sem users → vincula ao beta existente (plano BETA)
 *  9. Slug beta sem tenant, beta pré-existente com users → cria novo BETA
 * 10. Slug beta sem tenant, sem beta pré-existente → cria novo BETA
 */

import { testApiHandler } from 'next-test-api-route-handler';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as handler from '@/app/api/tenant/setup/route';

// ─── Mocks ─────────────────────────────────────────────────────────────────

vi.mock('@/auth', () => ({
  auth: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  prisma: {
    tenant: {
      update:    vi.fn(),
      create:    vi.fn(),
      findFirst: vi.fn(),
    },
    user: {
      update: vi.fn(),
    },
  },
}));

// ─── Imports após mocks ─────────────────────────────────────────────────────

import { auth } from '@/auth';
import { prisma } from '@/lib/db';

// ─── Helpers ────────────────────────────────────────────────────────────────

const SESSION_COM_TENANT = {
  user: { id: 'user-1', tenantId: 'tenant-1', name: 'Assessor', email: 'a@b.com' },
};

const SESSION_SEM_TENANT = {
  user: { id: 'user-2', tenantId: null, name: 'New', email: 'new@b.com' },
};

const BETA_TENANT_VAZIO     = { id: 'beta-tenant-1', plano: 'BETA', _count: { users: 0 } };
const BETA_TENANT_COM_USERS = { id: 'beta-tenant-2', plano: 'BETA', _count: { users: 1 } };

// ─── Testes ──────────────────────────────────────────────────────────────────

describe('PATCH /api/tenant/setup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (auth as ReturnType<typeof vi.fn>).mockResolvedValue(SESSION_COM_TENANT);
    (prisma.tenant.update    as ReturnType<typeof vi.fn>).mockResolvedValue({});
    (prisma.tenant.create    as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'tenant-new' });
    (prisma.tenant.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (prisma.user.update      as ReturnType<typeof vi.fn>).mockResolvedValue({});
  });

  it('slug beta (usuário com tenant) → atualiza tenant existente com nomeCompleto do perfil', async () => {
    await testApiHandler({
      appHandler: handler,
      async test({ fetch }) {
        const res = await fetch({
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            vereadorSlug: 'juninho_eroso',
            nomeVereador: 'qualquer nome digitado',
            nomeAssessor: 'Ana Souza',
          }),
        });
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.ok).toBe(true);

        const updateCall = (prisma.tenant.update as ReturnType<typeof vi.fn>).mock.calls[0];
        const data = updateCall[0].data;
        expect(data.nomeVereador).toBe('EDMAR LIMA DOS SANTOS');
        expect(data.vereadorSlug).toBe('juninho_eroso');
      },
    });
  });

  it('slug "outro" (usuário com tenant) → usa nomeVereador do body', async () => {
    await testApiHandler({
      appHandler: handler,
      async test({ fetch }) {
        const res = await fetch({
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            vereadorSlug: 'outro',
            nomeVereador: 'Vereador Fulano de Tal',
            nomeAssessor: 'João Silva',
          }),
        });
        expect(res.status).toBe(200);

        const updateCall = (prisma.tenant.update as ReturnType<typeof vi.fn>).mock.calls[0];
        const data = updateCall[0].data;
        expect(data.nomeVereador).toBe('Vereador Fulano de Tal');
        expect(data.vereadorSlug).toBe('outro');
      },
    });
  });

  it('nomeVereador ausente → 400', async () => {
    await testApiHandler({
      appHandler: handler,
      async test({ fetch }) {
        const res = await fetch({
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nomeAssessor: 'João' }),
        });
        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.error).toMatch(/vereador/i);
      },
    });
  });

  it('nomeAssessor ausente → 400', async () => {
    await testApiHandler({
      appHandler: handler,
      async test({ fetch }) {
        const res = await fetch({
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nomeVereador: 'Alguém' }),
        });
        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.error).toMatch(/assessor/i);
      },
    });
  });

  it('sem sessão → 401', async () => {
    (auth as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    await testApiHandler({
      appHandler: handler,
      async test({ fetch }) {
        const res = await fetch({
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nomeVereador: 'X', nomeAssessor: 'Y' }),
        });
        expect(res.status).toBe(401);
      },
    });
  });

  it('complete=true → chama user.update com onboardingComplete: true', async () => {
    await testApiHandler({
      appHandler: handler,
      async test({ fetch }) {
        const res = await fetch({
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ complete: true }),
        });
        expect(res.status).toBe(200);

        const userUpdateCall = (prisma.user.update as ReturnType<typeof vi.fn>).mock.calls[0];
        expect(userUpdateCall[0].data.onboardingComplete).toBe(true);
      },
    });
  });

  it('slug genérico sem tenant → cria TRIAL e vincula ao usuário', async () => {
    (auth as ReturnType<typeof vi.fn>).mockResolvedValue(SESSION_SEM_TENANT);

    await testApiHandler({
      appHandler: handler,
      async test({ fetch }) {
        const res = await fetch({
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            vereadorSlug: 'outro',
            nomeVereador: 'Vereador Novo',
            nomeAssessor: 'Assessor Novo',
          }),
        });
        expect(res.status).toBe(200);

        expect(prisma.tenant.create as ReturnType<typeof vi.fn>).toHaveBeenCalledOnce();
        const createCall = (prisma.tenant.create as ReturnType<typeof vi.fn>).mock.calls[0];
        expect(createCall[0].data.plano).toBe('TRIAL');

        const userCall = (prisma.user.update as ReturnType<typeof vi.fn>).mock.calls[0];
        expect(userCall[0].data.tenantId).toBe('tenant-new');
      },
    });
  });

  it('slug beta sem tenant, beta pré-existente sem users → vincula ao beta existente', async () => {
    (auth as ReturnType<typeof vi.fn>).mockResolvedValue(SESSION_SEM_TENANT);
    (prisma.tenant.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(BETA_TENANT_VAZIO);

    await testApiHandler({
      appHandler: handler,
      async test({ fetch }) {
        const res = await fetch({
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            vereadorSlug: 'ariani_paz',
            nomeVereador: 'Ariani',
            nomeAssessor: 'Assessora Beta',
          }),
        });
        expect(res.status).toBe(200);

        // Não deve criar tenant novo
        expect(prisma.tenant.create as ReturnType<typeof vi.fn>).not.toHaveBeenCalled();

        // Deve atualizar o tenant beta existente com plano BETA
        const updateCall = (prisma.tenant.update as ReturnType<typeof vi.fn>).mock.calls[0];
        expect(updateCall[0].where.id).toBe('beta-tenant-1');
        expect(updateCall[0].data.plano).toBe('BETA');

        // Deve vincular o user ao tenant beta
        const userCall = (prisma.user.update as ReturnType<typeof vi.fn>).mock.calls[0];
        expect(userCall[0].data.tenantId).toBe('beta-tenant-1');
      },
    });
  });

  it('slug beta sem tenant, beta pré-existente com users → cria novo tenant BETA', async () => {
    (auth as ReturnType<typeof vi.fn>).mockResolvedValue(SESSION_SEM_TENANT);
    (prisma.tenant.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(BETA_TENANT_COM_USERS);

    await testApiHandler({
      appHandler: handler,
      async test({ fetch }) {
        const res = await fetch({
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            vereadorSlug: 'marcio_pet',
            nomeVereador: 'Márcio',
            nomeAssessor: 'Segundo Assessor',
          }),
        });
        expect(res.status).toBe(200);

        // Deve criar novo tenant
        expect(prisma.tenant.create as ReturnType<typeof vi.fn>).toHaveBeenCalledOnce();
        const createCall = (prisma.tenant.create as ReturnType<typeof vi.fn>).mock.calls[0];
        expect(createCall[0].data.plano).toBe('BETA');

        const userCall = (prisma.user.update as ReturnType<typeof vi.fn>).mock.calls[0];
        expect(userCall[0].data.tenantId).toBe('tenant-new');
      },
    });
  });

  it('slug beta sem tenant, sem beta pré-existente → cria novo tenant BETA', async () => {
    (auth as ReturnType<typeof vi.fn>).mockResolvedValue(SESSION_SEM_TENANT);
    (prisma.tenant.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    await testApiHandler({
      appHandler: handler,
      async test({ fetch }) {
        const res = await fetch({
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            vereadorSlug: 'valdemir',
            nomeVereador: 'Valdemir',
            nomeAssessor: 'Novo Assessor',
          }),
        });
        expect(res.status).toBe(200);

        expect(prisma.tenant.create as ReturnType<typeof vi.fn>).toHaveBeenCalledOnce();
        const createCall = (prisma.tenant.create as ReturnType<typeof vi.fn>).mock.calls[0];
        expect(createCall[0].data.plano).toBe('BETA');
      },
    });
  });
});
