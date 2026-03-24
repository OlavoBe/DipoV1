import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { Plano } from '@prisma/client';

export async function GET() {
  const session = await auth();
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const usuarios = await prisma.user.findMany({
    orderBy: { criadoEm: 'desc' },
    select: {
      id: true,
      email: true,
      nome: true,
      name: true,
      isAdmin: true,
      onboardingComplete: true,
      criadoEm: true,
      tenant: { select: { id: true, nome: true, plano: true } },
    },
  });

  return NextResponse.json(usuarios);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json();
  const { email, nome, plano, isAdmin } = body as {
    email: string;
    nome?: string;
    plano: Plano;
    isAdmin?: boolean;
  };

  if (!email || !plano) {
    return NextResponse.json({ error: 'email e plano são obrigatórios' }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: 'Usuário já existe' }, { status: 409 });
  }

  const tenant = await prisma.tenant.create({
    data: {
      nome: nome ?? email.split('@')[0],
      plano,
      nomeAssessor: nome ?? '',
    },
  });

  const user = await prisma.user.create({
    data: {
      email,
      nome: nome ?? null,
      name: nome ?? null,
      isAdmin: isAdmin ?? false,
      onboardingComplete: true,
      tenantId: tenant.id,
    },
  });

  return NextResponse.json({ user, tenant }, { status: 201 });
}
