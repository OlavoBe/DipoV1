import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/admin';
import { UsuariosClient } from './client';

export const dynamic = 'force-dynamic';

export default async function UsuariosPage() {
  const session = await requireAdmin();

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

  return (
    <UsuariosClient
      usuarios={usuarios}
      currentUserId={session.user.id}
    />
  );
}
