import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { Plano } from '@prisma/client';

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const { nome, email, plano, isAdmin } = body as {
    nome?: string;
    email?: string;
    plano?: Plano;
    isAdmin?: boolean;
  };

  const user = await prisma.user.findUnique({
    where: { id },
    include: { tenant: true },
  });

  if (!user) {
    return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 });
  }

  // Atualiza dados do usuário
  const updatedUser = await prisma.user.update({
    where: { id },
    data: {
      ...(nome !== undefined && { nome, name: nome }),
      ...(email !== undefined && { email }),
      ...(isAdmin !== undefined && { isAdmin }),
    },
  });

  // Atualiza plano do tenant se fornecido
  if (plano && user.tenantId) {
    await prisma.tenant.update({
      where: { id: user.tenantId },
      data: { plano },
    });
  }

  return NextResponse.json(updatedUser);
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;

  // Não permite deletar a si mesmo
  if (id === session.user.id) {
    return NextResponse.json({ error: 'Não é possível deletar sua própria conta' }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { id },
    include: {
      tenant: { include: { users: true } },
    },
  });

  if (!user) {
    return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 });
  }

  // Deleta usuário (cascade: sessions, accounts)
  await prisma.user.delete({ where: { id } });

  // Se o tenant ficou sem usuários, limpa tudo
  if (user.tenant && user.tenant.users.length === 1) {
    await prisma.indicacao.deleteMany({ where: { tenantId: user.tenant.id } });
    await prisma.template.deleteMany({ where: { tenantId: user.tenant.id } });
    await prisma.tenant.delete({ where: { id: user.tenant.id } });
  }

  return NextResponse.json({ ok: true });
}
