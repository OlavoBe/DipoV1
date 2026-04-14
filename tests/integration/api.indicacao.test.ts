/**
 * Integration — POST /api/indicacao
 *
 * Testa os ramos principais do route handler:
 *  1. Texto válido + pipeline OK → 200 com texto_final
 *  2. Texto muito curto → 400
 *  3. Sem sessão → 401
 *  4. Sem tenant → 403
 *  5. Limite Trial atingido → 402
 *  6. Modo demo (sem API key) → 503
 *  7. Pipeline retorna 'incomplete' → 200 com perguntas_faltantes
 */

import { testApiHandler } from 'next-test-api-route-handler';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as handler from '@/app/api/indicacao/route';

// ─── Mocks ─────────────────────────────────────────────────────────────────

vi.mock('@/auth', () => ({
  auth: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  prisma: {
    tenant: {
      findUnique: vi.fn(),
    },
    indicacao: {
      create: vi.fn(),
    },
    usageLog: {
      create: vi.fn().mockResolvedValue({}),
    },
  },
}));

vi.mock('@/lib/pipeline', () => ({
  indicacaoPipeline: vi.fn(),
}));

vi.mock('@/lib/llm', () => ({
  isDemoMode: vi.fn(),
}));

vi.mock('@/lib/planos', () => ({
  checkLimite: vi.fn(),
}));

// ─── Imports após mocks ─────────────────────────────────────────────────────

import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { indicacaoPipeline } from '@/lib/pipeline';
import { isDemoMode } from '@/lib/llm';
import { checkLimite } from '@/lib/planos';

// ─── Helpers ────────────────────────────────────────────────────────────────

const SESSION_PRO = {
  user: { id: 'user-1', tenantId: 'tenant-1', name: 'Assessor', email: 'a@b.com' },
};

const SESSION_SEM_TENANT = {
  user: { id: 'user-2', tenantId: null, name: 'New', email: 'new@b.com' },
};

const TEXTO_VALIDO = 'Buraco grande na Rua das Palmeiras, nº 340, bairro Jardim Três Marias, Guarujá.';

const EXTRACTED_MOCK = {
  categoria: 'servico_urbano',
  tipos_servico: ['tapa_buraco'],
  bairro: 'Jardim Três Marias',
  logradouro: 'Rua das Palmeiras',
  numero: '340',
  cep: null,
  tema: 'Tapa-buraco',
  descricao_problema: 'Buraco grande',
  providencias_sugeridas: [],
  observacoes_contextuais: '',
  perguntas_faltantes: [],
  origem_solicitacao: null,
  tipo_problema: null,
  cidade: 'Guarujá',
  uf: 'SP',
  ponto_referencia: null,
  trecho_localizacao: null,
  impactos: [],
  precisa_maquinario: false,
  sugestao_maquinario: [],
  precisa_estudo_tecnico: false,
};

// ─── Testes ──────────────────────────────────────────────────────────────────

describe('POST /api/indicacao', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Defaults que podem ser sobrescritos em cada teste
    (auth as ReturnType<typeof vi.fn>).mockResolvedValue(SESSION_PRO);
    (isDemoMode as ReturnType<typeof vi.fn>).mockReturnValue(false);
    (checkLimite as ReturnType<typeof vi.fn>).mockResolvedValue({ permitido: true });
    (prisma.tenant.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      plano: 'PRO_ASSESSOR',
      vereadorSlug: 'outro',
    });
    (prisma.indicacao.create as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'ind-1' });
    (indicacaoPipeline as ReturnType<typeof vi.fn>).mockResolvedValue({
      status: 'success',
      textoFinal: 'INDICAÇÃO Nº XXX...',
      extracted: EXTRACTED_MOCK,
    });
  });

  it('texto válido → 200 com texto_final e record_id', async () => {
    await testApiHandler({
      appHandler: handler,
      async test({ fetch }) {
        const res = await fetch({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ texto: TEXTO_VALIDO }),
        });
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.status).toBe('success');
        expect(body.texto_final).toBe('INDICAÇÃO Nº XXX...');
        expect(body.record_id).toBe('ind-1');
      },
    });
  });

  it('texto muito curto → 400', async () => {
    await testApiHandler({
      appHandler: handler,
      async test({ fetch }) {
        const res = await fetch({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ texto: 'oi' }),
        });
        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.status).toBe('error');
        expect(body.error).toMatch(/curto/i);
      },
    });
  });

  it('sem sessão → 401', async () => {
    (auth as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    await testApiHandler({
      appHandler: handler,
      async test({ fetch }) {
        const res = await fetch({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ texto: TEXTO_VALIDO }),
        });
        expect(res.status).toBe(401);
      },
    });
  });

  it('sem tenant → 403', async () => {
    (auth as ReturnType<typeof vi.fn>).mockResolvedValue(SESSION_SEM_TENANT);

    await testApiHandler({
      appHandler: handler,
      async test({ fetch }) {
        const res = await fetch({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ texto: TEXTO_VALIDO }),
        });
        expect(res.status).toBe(403);
      },
    });
  });

  it('limite Trial atingido → 402 com error limite_atingido', async () => {
    (checkLimite as ReturnType<typeof vi.fn>).mockResolvedValue({
      permitido: false,
      motivo: 'Limite de 5 indicações atingido.',
      restantes: 0,
    });

    await testApiHandler({
      appHandler: handler,
      async test({ fetch }) {
        const res = await fetch({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ texto: TEXTO_VALIDO }),
        });
        expect(res.status).toBe(402);
        const body = await res.json();
        expect(body.error).toBe('limite_atingido');
        expect(body.upgrade_url).toBe('/upgrade');
      },
    });
  });

  it('modo demo (sem API key) → 503', async () => {
    (isDemoMode as ReturnType<typeof vi.fn>).mockReturnValue(true);

    await testApiHandler({
      appHandler: handler,
      async test({ fetch }) {
        const res = await fetch({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ texto: TEXTO_VALIDO }),
        });
        expect(res.status).toBe(503);
        const body = await res.json();
        expect(body.status).toBe('error');
        expect(body.error).toMatch(/LLM_API_KEY/);
      },
    });
  });

  it('pipeline retorna incomplete → 200 com perguntas_faltantes', async () => {
    (indicacaoPipeline as ReturnType<typeof vi.fn>).mockResolvedValue({
      status: 'incomplete',
      perguntas: ['Qual o número do imóvel?', 'Qual o CEP?'],
      extracted: EXTRACTED_MOCK,
    });

    await testApiHandler({
      appHandler: handler,
      async test({ fetch }) {
        const res = await fetch({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ texto: TEXTO_VALIDO }),
        });
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.status).toBe('incomplete');
        expect(body.perguntas_faltantes).toHaveLength(2);
      },
    });
  });
});
