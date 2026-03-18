/**
 * ROTA EXCLUSIVA DE TESTES — nunca ativa em produção.
 *
 * Só funciona quando TEST_MODE=true está definido em .env.local.
 * Cria uma sessão real no banco de dados e seta o cookie do NextAuth,
 * permitindo login instantâneo com qualquer e-mail sem magic link.
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { randomUUID } from 'crypto';

const TEST_MODE = process.env.TEST_MODE === 'true';

export async function POST(req: NextRequest) {
  if (!TEST_MODE) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const { email } = await req.json();
  if (!email || typeof email !== 'string') {
    return NextResponse.json({ error: 'E-mail obrigatório.' }, { status: 400 });
  }

  // Encontrar ou criar o usuário
  let user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    user = await prisma.user.create({
      data: { email, emailVerified: new Date() },
    });
  }

  // Remover sessões antigas deste usuário
  await prisma.session.deleteMany({ where: { userId: user.id } });

  // Criar sessão nova com validade de 24h
  const sessionToken = randomUUID();
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);

  await prisma.session.create({
    data: { sessionToken, userId: user.id, expires },
  });

  // Setar cookie exatamente como o NextAuth faz em desenvolvimento
  const cookieName = 'authjs.session-token';
  const res = NextResponse.json({ ok: true });
  res.cookies.set(cookieName, sessionToken, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    expires,
    // secure: false em desenvolvimento (http://localhost)
  });

  return res;
}
