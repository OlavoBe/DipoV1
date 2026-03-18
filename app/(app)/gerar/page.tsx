import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import GerarPageClient from './client';

export default async function GerarPage() {
  const session = await auth();
  const tenantId = session?.user?.tenantId;

  // Defesa contra sessão inválida em renderização concorrente com o layout
  if (!tenantId) redirect('/login');

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [tenant, usageCount] = await Promise.all([
    prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { plano: true },
    }),
    prisma.indicacao.count({
      where: { tenantId, createdAt: { gte: sevenDaysAgo } },
    }),
  ]);

  const usageLimit = tenant?.plano === 'TRIAL' ? 3 : null;

  return <GerarPageClient usageCount={usageCount} usageLimit={usageLimit} />;
}
