import { describe, it, expect, vi, beforeEach } from 'vitest';
import { testApiHandler } from 'next-test-api-route-handler';
import * as handler from '@/app/api/checkout/route';

vi.mock('@/auth', () => ({ auth: vi.fn() }));
vi.mock('@/lib/mercadopago', () => ({ createPreference: vi.fn() }));

import { auth } from '@/auth';
import { createPreference } from '@/lib/mercadopago';

/**
 * O checkout está suspenso enquanto a cobrança for avulsa anunciada como
 * mensal, e enquanto o webhook conceder plano Pro sem prazo por um pagamento
 * único. Ver lib/checkout.ts.
 *
 * O que estes testes travam: nenhuma requisição pode chegar ao Mercado Pago,
 * nem de usuário autenticado, nem por chamada direta à rota.
 */
describe('POST /api/checkout — suspenso', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (auth as ReturnType<typeof vi.fn>).mockResolvedValue({
      user: { id: 'u1', tenantId: 't1', email: 'a@b.com' },
    });
  });

  it('responde 503 e não cria preferência no Mercado Pago', async () => {
    await testApiHandler({
      appHandler: handler,
      async test({ fetch }) {
        const res = await fetch({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ plano: 'PRO_ASSESSOR' }),
        });

        expect(res.status).toBe(503);
        const body = await res.json();
        expect(body.error).toMatch(/indispon/i);
        expect(createPreference).not.toHaveBeenCalled();
      },
    });
  });

  it('barra antes mesmo de checar a sessão', async () => {
    (auth as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    await testApiHandler({
      appHandler: handler,
      async test({ fetch }) {
        const res = await fetch({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ plano: 'PRO_ASSESSOR' }),
        });

        // 503, não 401: a suspensão vale para qualquer requisição.
        expect(res.status).toBe(503);
        expect(createPreference).not.toHaveBeenCalled();
      },
    });
  });
});
