import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { createPreference } from '@/lib/mercadopago';

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
    }

    const tenantId = session.user.tenantId;
    if (!tenantId) {
      return NextResponse.json({ error: 'Usuário sem tenant vinculado.' }, { status: 403 });
    }

    const { plano } = await req.json();
    if (!['PRO_ASSESSOR', 'PRO_GABINETE'].includes(plano)) {
      return NextResponse.json({ error: 'Plano inválido.' }, { status: 400 });
    }

    const { init_point } = await createPreference(
      plano,
      tenantId,
      session.user.email ?? '',
    );

    return NextResponse.json({ init_point });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro interno';
    console.error('[API /checkout]', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
