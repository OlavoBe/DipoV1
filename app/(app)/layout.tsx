import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { AppShell } from '@/components/app/app-shell';
import { TRIAL_MAX, TRIAL_JANELA_MS } from '@/lib/planos';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  if (!session?.user) redirect('/login');

  if (!session.user.tenantId || !session.user.onboardingComplete) redirect('/onboarding');

  const tenantId = session.user.tenantId;
  const treHorasAtras = new Date(Date.now() - TRIAL_JANELA_MS);

  const [tenant, usageCount] = await Promise.all([
    prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { nome: true, plano: true },
    }),
    prisma.indicacao.count({
      where: {
        tenantId,
        createdAt: { gte: treHorasAtras },
      },
    }),
  ]);

  // TRIAL: 5/3h — outros planos: ilimitado (null)
  const usageLimit = tenant?.plano === 'TRIAL' ? TRIAL_MAX : null;

  return (
    <AppShell
      tenantNome={tenant?.nome ?? ''}
      plano={tenant?.plano ?? 'DEMO'}
      usageCount={usageCount}
      usageLimit={usageLimit}
      userEmail={session.user.email ?? ''}
    >
      {children}
    </AppShell>
  );
}
