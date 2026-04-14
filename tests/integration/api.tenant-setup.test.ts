/**
 * Integration — PATCH /api/tenant/setup
 *
 * Testa:
 *  1. Slug beta → nome auto-preenchido do perfil
 *  2. Slug "outro" → usa nome do body
 *  3. nomeVereador ausente → 400
 *  4. nomeAssessor ausente → 400
 *  5. Sem sessão → 401
 *  6. complete=true → chama user.update com onboardingComplete
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
      update: vi.fn(),
      create: vi.fn(),
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

// ─── Testes ──────────────────────────────────────────────────────────────────

describe('PATCH /api/tenant/setup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (auth as ReturnType<typeof vi.fn>).mockResolvedValue(SESSION_COM_TENANT);
    (prisma.tenant.update as ReturnType<typeof vi.fn>).mockResolvedValue({});
    (prisma.tenant.create as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'tenant-new' });
    (prisma.user.update as ReturnType<typeof vi.fn>).mockResolvedValue({});
  });

  it('slug beta (juninho_eroso) → nome auto-preenchido do perfil', async () => {
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

        // Deve ter chamado update com o nomeCompleto do perfil, não o do body
        const updateCall = (prisma.tenant.update as ReturnType<typeof vi.fn>).mock.calls[0];
        const data = updateCall[0].data;
        expect(data.nomeVereador).toBe('EDMAR LIMA DOS SANTOS');
        expect(data.vereadorSlug).toBe('juninho_eroso');
      },
    });
  });

  it('slug "outro" → usa nomeVereador do body', async () => {
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

  it('sem tenant → cria tenant e vincula ao usuário', async () => {
    (auth as ReturnType<typeof vi.fn>).mockResolvedValue(SESSION_SEM_TENANT);

    await testApiHandler({
      appHandler: handler,
      async test({ fetch }) {
        const res = await fetch({
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            nomeVereador: 'Vereador Novo',
            nomeAssessor: 'Assessor Novo',
          }),
        });
        expect(res.status).toBe(200);

        expect(prisma.tenant.create as ReturnType<typeof vi.fn>).toHaveBeenCalledOnce();
        const createCall = (prisma.tenant.create as ReturnType<typeof vi.fn>).mock.calls[0];
        expect(createCall[0].data.plano).toBe('TRIAL');

        expect(prisma.user.update as ReturnType<typeof vi.fn>).toHaveBeenCalledOnce();
        const userCall = (prisma.user.update as ReturnType<typeof vi.fn>).mock.calls[0];
        expect(userCall[0].data.tenantId).toBe('tenant-new');
      },
    });
  });
});
