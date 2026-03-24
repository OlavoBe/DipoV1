import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { TRIAL_MAX, TRIAL_JANELA_MS } from '@/lib/planos';
import GerarPageClient from './client';

export default async function GerarPage() {
  const session = await auth();
  const tenantId = session?.user?.tenantId;

  if (!tenantId) redirect('/login');

  const treHorasAtras = new Date(Date.now() - TRIAL_JANELA_MS);

  const [tenant, usageCount] = await Promise.all([
    prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { plano: true },
    }),
    prisma.indicacao.count({
      where: { tenantId, createdAt: { gte: treHorasAtras } },
    }),
  ]);

  const usageLimit = tenant?.plano === 'TRIAL' ? TRIAL_MAX : null;

  return <GerarPageClient usageCount={usageCount} usageLimit={usageLimit} />;
}
