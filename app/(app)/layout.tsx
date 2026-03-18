import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { AppShell } from '@/components/app/app-shell';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  // Não autenticado → página de login
  if (!session?.user) redirect('/login');

  // Onboarding não concluído (sem tenant ou flag não marcada)
  if (!session.user.tenantId || !session.user.onboardingComplete) redirect('/onboarding');

  const tenantId = session.user.tenantId;
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [tenant, usageCount] = await Promise.all([
    prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { nome: true, plano: true },
    }),
    prisma.indicacao.count({
      where: {
        tenantId,
        createdAt: { gte: sevenDaysAgo },
      },
    }),
  ]);

  // TRIAL: 3/semana — outros planos: ilimitado (null)
  const usageLimit = tenant?.plano === 'TRIAL' ? 3 : null;

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
