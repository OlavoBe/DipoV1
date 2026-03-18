import { NextRequest, NextResponse } from 'next/server';
import { MercadoPagoConfig, Payment } from 'mercadopago';
import { prisma } from '@/lib/db';

const client = new MercadoPagoConfig({
  accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN!,
});

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json();

    // Mercado Pago sends type and data.id
    if (body.type !== 'payment') {
      return NextResponse.json({ ok: true });
    }

    const paymentId = body.data?.id;
    if (!paymentId) {
      return NextResponse.json({ ok: true });
    }

    const paymentClient = new Payment(client);
    const payment = await paymentClient.get({ id: String(paymentId) });

    const status = payment.status;
    const meta = payment.metadata as { tenant_id?: string; plano?: string } | undefined;
    const tenantId = meta?.tenant_id;
    const plano = meta?.plano;

    if (!tenantId) {
      console.warn('[Webhook MP] sem tenantId no metadata', payment.id);
      return NextResponse.json({ ok: true });
    }

    if (status === 'approved') {
      const payerId = (payment.payer as any)?.id?.toString() ?? null;
      await prisma.tenant.update({
        where: { id: tenantId },
        data: {
          plano: plano as any ?? 'TRIAL',
          mpCustomerId: payerId,
          planoAtivoEm: new Date(),
        },
      });
      console.log(`[Webhook MP] tenant ${tenantId} → plano ${plano} ativado`);
    } else if (status === 'cancelled' || status === 'refunded') {
      await prisma.tenant.update({
        where: { id: tenantId },
        data: { plano: 'TRIAL' },
      });
      console.log(`[Webhook MP] tenant ${tenantId} revertido para TRIAL (status: ${status})`);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[Webhook MP] Erro:', err);
    // Retorna 200 para evitar reenvios desnecessários do MP
    return NextResponse.json({ ok: true });
  }
}
