/**
 * Integration — PATCH /api/indicacoes/[id]/feedback
 *
 * Testa:
 *  1. Feedback 1 (positivo) → 200
 *  2. Feedback -1 (negativo) → 200
 *  3. Valor inválido (0, 2, string) → 400
 *  4. Sem sessão → 401
 *  5. Indicação de outro tenant → 404
 *  6. Indicação inexistente → 404
 */

import { testApiHandler } from 'next-test-api-route-handler';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as handler from '@/app/api/indicacoes/[id]/feedback/route';

// ─── Mocks ─────────────────────────────────────────────────────────────────

vi.mock('@/auth', () => ({
  auth: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  prisma: {
    indicacao: {
      findUnique: vi.fn(),
      update:     vi.fn(),
    },
  },
}));

// ─── Imports após mocks ─────────────────────────────────────────────────────

import { auth } from '@/auth';
import { prisma } from '@/lib/db';

// ─── Helpers ────────────────────────────────────────────────────────────────

const SESSION = {
  user: { id: 'user-1', tenantId: 'tenant-1', name: 'Assessor', email: 'a@b.com' },
};

const IND_ID = 'ind-abc123';

// ─── Testes ──────────────────────────────────────────────────────────────────

describe('PATCH /api/indicacoes/[id]/feedback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (auth as ReturnType<typeof vi.fn>).mockResolvedValue(SESSION);
    (prisma.indicacao.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      tenantId: 'tenant-1',
    });
    (prisma.indicacao.update as ReturnType<typeof vi.fn>).mockResolvedValue({});
  });

  it('feedback 1 (positivo) → 200 { ok: true }', async () => {
    await testApiHandler({
      appHandler: handler,
      params: { id: IND_ID },
      async test({ fetch }) {
        const res = await fetch({
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ feedback: 1 }),
        });
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.ok).toBe(true);

        const updateCall = (prisma.indicacao.update as ReturnType<typeof vi.fn>).mock.calls[0];
        expect(updateCall[0].data.feedback).toBe(1);
      },
    });
  });

  it('feedback -1 (negativo) → 200 { ok: true }', async () => {
    await testApiHandler({
      appHandler: handler,
      params: { id: IND_ID },
      async test({ fetch }) {
        const res = await fetch({
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ feedback: -1 }),
        });
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.ok).toBe(true);

        const updateCall = (prisma.indicacao.update as ReturnType<typeof vi.fn>).mock.calls[0];
        expect(updateCall[0].data.feedback).toBe(-1);
      },
    });
  });

  it('valor 0 → 400', async () => {
    await testApiHandler({
      appHandler: handler,
      params: { id: IND_ID },
      async test({ fetch }) {
        const res = await fetch({
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ feedback: 0 }),
        });
        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.error).toMatch(/1 ou -1/);
      },
    });
  });

  it('valor 2 → 400', async () => {
    await testApiHandler({
      appHandler: handler,
      params: { id: IND_ID },
      async test({ fetch }) {
        const res = await fetch({
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ feedback: 2 }),
        });
        expect(res.status).toBe(400);
      },
    });
  });

  it('valor string → 400', async () => {
    await testApiHandler({
      appHandler: handler,
      params: { id: IND_ID },
      async test({ fetch }) {
        const res = await fetch({
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ feedback: 'bom' }),
        });
        expect(res.status).toBe(400);
      },
    });
  });

  it('sem sessão → 401', async () => {
    (auth as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    await testApiHandler({
      appHandler: handler,
      params: { id: IND_ID },
      async test({ fetch }) {
        const res = await fetch({
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ feedback: 1 }),
        });
        expect(res.status).toBe(401);
      },
    });
  });

  it('indicação de outro tenant → 404', async () => {
    (prisma.indicacao.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      tenantId: 'tenant-OUTRO',
    });

    await testApiHandler({
      appHandler: handler,
      params: { id: IND_ID },
      async test({ fetch }) {
        const res = await fetch({
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ feedback: 1 }),
        });
        expect(res.status).toBe(404);
      },
    });
  });

  it('indicação inexistente → 404', async () => {
    (prisma.indicacao.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    await testApiHandler({
      appHandler: handler,
      params: { id: 'nao-existe' },
      async test({ fetch }) {
        const res = await fetch({
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ feedback: 1 }),
        });
        expect(res.status).toBe(404);
      },
    });
  });
});
