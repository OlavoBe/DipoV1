import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';

export async function GET() {
  const session = await auth();
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [
    totalUsuarios,
    totalTenants,
    totalIndicacoes,
    indicacoesUltimos7Dias,
    planoBreakdown,
    usuariosRecentes,
    usageLogsByAction,
    usageLogsByTenant,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.tenant.count(),
    prisma.indicacao.count(),
    prisma.indicacao.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
    prisma.tenant.groupBy({ by: ['plano'], _count: { _all: true } }),
    prisma.user.findMany({
      take: 10,
      orderBy: { criadoEm: 'desc' },
      select: {
        id: true,
        email: true,
        nome: true,
        isAdmin: true,
        criadoEm: true,
        tenant: { select: { nome: true, plano: true } },
      },
    }),
    // Contagem por ação nos últimos 7 dias
    prisma.usageLog.groupBy({
      by: ['action'],
      where: { createdAt: { gte: sevenDaysAgo } },
      _count: { _all: true },
      orderBy: { _count: { action: 'desc' } },
    }),
    // Contagem por tenant nos últimos 7 dias (top 20)
    prisma.usageLog.groupBy({
      by: ['tenantId'],
      where: { createdAt: { gte: sevenDaysAgo } },
      _count: { _all: true },
      orderBy: { _count: { tenantId: 'desc' } },
      take: 20,
    }),
  ]);

  return NextResponse.json({
    totalUsuarios,
    totalTenants,
    totalIndicacoes,
    indicacoesUltimos7Dias,
    planoBreakdown,
    usuariosRecentes,
    usageLogsByAction:  usageLogsByAction.map(r => ({ action: r.action, count: r._count._all })),
    usageLogsByTenant:  usageLogsByTenant.map(r => ({ tenantId: r.tenantId, count: r._count._all })),
  });
}
