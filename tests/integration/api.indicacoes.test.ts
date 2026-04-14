/**
 * Integration — GET /api/indicacoes
 *
 * Testa:
 *  1. Sem autenticação → 401
 *  2. Sem tenant → 403
 *  3. Lista vazia → { items: [], total: 0, page: 1, totalPages: 1 }
 *  4. Paginação: page=2 passa skip correto ao Prisma
 *  5. Filtro por período (7d) → passa gte ao Prisma
 *  6. Filtro por search → passa OR com contains ao Prisma
 *  7. Retorna items com campos corretos (id, assunto, numero, enderecoCompleto, feedback)
 */

import { testApiHandler } from 'next-test-api-route-handler';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as handler from '@/app/api/indicacoes/route';

// ─── Mocks ─────────────────────────────────────────────────────────────────

vi.mock('@/auth', () => ({
  auth: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  prisma: {
    indicacao: {
      count:    vi.fn(),
      findMany: vi.fn(),
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

const SESSION_SEM_TENANT = {
  user: { id: 'user-2', tenantId: null, name: 'New', email: 'new@b.com' },
};

function makeRecord(overrides = {}) {
  return {
    id: 'ind-1',
    createdAt: new Date('2024-01-15T10:00:00Z'),
    inputRaw: 'Buraco na rua',
    extractedJson: JSON.stringify({ tema: 'Tapa-buraco Rua das Flores' }),
    textoFinal: 'INDICAÇÃO...',
    tipoServico: 'tapa_buraco',
    logradouro: 'Rua das Flores',
    bairro: 'Centro',
    numero: '100',
    cep: null,
    feedback: null,
    ...overrides,
  };
}

// ─── Testes ──────────────────────────────────────────────────────────────────

describe('GET /api/indicacoes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (auth as ReturnType<typeof vi.fn>).mockResolvedValue(SESSION);
    (prisma.indicacao.count    as ReturnType<typeof vi.fn>).mockResolvedValue(0);
    (prisma.indicacao.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
  });

  it('sem autenticação → 401', async () => {
    (auth as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    await testApiHandler({
      appHandler: handler,
      async test({ fetch }) {
        const res = await fetch({ method: 'GET' });
        expect(res.status).toBe(401);
      },
    });
  });

  it('sem tenant → 403', async () => {
    (auth as ReturnType<typeof vi.fn>).mockResolvedValue(SESSION_SEM_TENANT);

    await testApiHandler({
      appHandler: handler,
      async test({ fetch }) {
        const res = await fetch({ method: 'GET' });
        expect(res.status).toBe(403);
      },
    });
  });

  it('lista vazia → items: [], total: 0, page: 1, totalPages: 1', async () => {
    await testApiHandler({
      appHandler: handler,
      async test({ fetch }) {
        const res = await fetch({ method: 'GET' });
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.items).toEqual([]);
        expect(body.total).toBe(0);
        expect(body.page).toBe(1);
        expect(body.totalPages).toBe(1);
      },
    });
  });

  it('retorna items com campos mapeados corretamente', async () => {
    (prisma.indicacao.count    as ReturnType<typeof vi.fn>).mockResolvedValue(1);
    (prisma.indicacao.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      makeRecord({ feedback: 1 }),
    ]);

    await testApiHandler({
      appHandler: handler,
      async test({ fetch }) {
        const res = await fetch({ method: 'GET' });
        const body = await res.json();
        expect(body.total).toBe(1);
        const item = body.items[0];
        expect(item.id).toBe('ind-1');
        expect(item.assunto).toBe('Tapa-buraco Rua das Flores');
        expect(item.enderecoCompleto).toBe('Rua das Flores, 100, Centro');
        expect(item.feedback).toBe(1);
        expect(item.status).toBe('gerada');
        expect(item.createdAt).toBe('2024-01-15T10:00:00.000Z');
      },
    });
  });

  it('paginação: page=2 → skip=20 passado ao findMany', async () => {
    (prisma.indicacao.count    as ReturnType<typeof vi.fn>).mockResolvedValue(25);
    (prisma.indicacao.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    await testApiHandler({
      appHandler: handler,
      url: '/?page=2',
      async test({ fetch }) {
        const res = await fetch({ method: 'GET' });
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.page).toBe(2);
        expect(body.totalPages).toBe(2);

        const findManyCall = (prisma.indicacao.findMany as ReturnType<typeof vi.fn>).mock.calls[0];
        expect(findManyCall[0].skip).toBe(20);
        expect(findManyCall[0].take).toBe(20);
      },
    });
  });

  it('filtro periodo=7d → where.createdAt.gte é definido', async () => {
    await testApiHandler({
      appHandler: handler,
      url: '/?periodo=7d',
      async test({ fetch }) {
        const res = await fetch({ method: 'GET' });
        expect(res.status).toBe(200);

        const countCall = (prisma.indicacao.count as ReturnType<typeof vi.fn>).mock.calls[0];
        const where = countCall[0].where;
        expect(where.createdAt).toBeDefined();
        expect(where.createdAt.gte).toBeInstanceOf(Date);

        // Data deve ser ~7 dias atrás (tolerância de 5 segundos)
        const diff = Date.now() - where.createdAt.gte.getTime();
        const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
        expect(diff).toBeGreaterThan(sevenDaysMs - 5000);
        expect(diff).toBeLessThan(sevenDaysMs + 5000);
      },
    });
  });

  it('filtro search="flores" → where.OR com contains passado ao Prisma', async () => {
    await testApiHandler({
      appHandler: handler,
      url: '/?search=flores',
      async test({ fetch }) {
        const res = await fetch({ method: 'GET' });
        expect(res.status).toBe(200);

        const countCall = (prisma.indicacao.count as ReturnType<typeof vi.fn>).mock.calls[0];
        const where = countCall[0].where;
        expect(Array.isArray(where.OR)).toBe(true);
        const texts = where.OR.map((c: Record<string, unknown>) => Object.keys(c)[0]);
        expect(texts).toContain('logradouro');
        expect(texts).toContain('bairro');
      },
    });
  });

  it('periodo=todos → where.createdAt não é definido', async () => {
    await testApiHandler({
      appHandler: handler,
      url: '/?periodo=todos',
      async test({ fetch }) {
        await fetch({ method: 'GET' });
        const countCall = (prisma.indicacao.count as ReturnType<typeof vi.fn>).mock.calls[0];
        const where = countCall[0].where;
        expect(where.createdAt).toBeUndefined();
      },
    });
  });

  it('assunto usa fallback para firstLine quando extractedJson não tem tema', async () => {
    (prisma.indicacao.count    as ReturnType<typeof vi.fn>).mockResolvedValue(1);
    (prisma.indicacao.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      makeRecord({ extractedJson: '{}', inputRaw: 'Capinação urgente na Avenida Santos Dumont' }),
    ]);

    await testApiHandler({
      appHandler: handler,
      async test({ fetch }) {
        const res = await fetch({ method: 'GET' });
        const body = await res.json();
        expect(body.items[0].assunto).toBe('Capinação urgente na Avenida Santos Dumont');
      },
    });
  });
});
