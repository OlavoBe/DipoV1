import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { logUsage } from '@/lib/usage-log';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
  }

  const tenantId = session.user.tenantId;
  if (!tenantId) {
    return NextResponse.json({ error: 'Usuário sem tenant.' }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const { feedback } = body as { feedback: 1 | -1 };

  if (feedback !== 1 && feedback !== -1) {
    return NextResponse.json({ error: 'feedback deve ser 1 ou -1.' }, { status: 400 });
  }

  // Garante que a indicação pertence ao tenant do usuário
  const indicacao = await prisma.indicacao.findUnique({
    where: { id },
    select: { tenantId: true },
  });

  if (!indicacao || indicacao.tenantId !== tenantId) {
    return NextResponse.json({ error: 'Indicação não encontrada.' }, { status: 404 });
  }

  await prisma.indicacao.update({
    where: { id },
    data: { feedback, feedbackEm: new Date() },
  });

  logUsage(tenantId, feedback === 1 ? 'feedback_positive' : 'feedback_negative', session.user.id, { indicacaoId: id });

  return NextResponse.json({ ok: true });
}
