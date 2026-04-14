import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { TRIAL_MAX, TRIAL_JANELA_MS } from '@/lib/planos';
import ConfiguracoesClient from './client';

export default async function ConfiguracoesPage() {
  const session = await auth();
  const tenantId = session?.user?.tenantId;

  if (!tenantId) redirect('/login');

  const treHorasAtras = new Date(Date.now() - TRIAL_JANELA_MS);

  const [tenant, usageCount] = await Promise.all([
    prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        plano:        true,
        nomeVereador: true,
        nomePartido:  true,
        municipio:    true,
        nomeAssessor: true,
        vereadorSlug: true,
      },
    }),
    prisma.indicacao.count({
      where: { tenantId, createdAt: { gte: treHorasAtras } },
    }),
  ]);

  if (!tenant) redirect('/login');

  const usageLimit = tenant.plano === 'TRIAL' ? TRIAL_MAX : null;

  return (
    <ConfiguracoesClient
      tenant={{
        plano:        tenant.plano,
        nomeVereador: tenant.nomeVereador,
        nomePartido:  tenant.nomePartido,
        municipio:    tenant.municipio,
        nomeAssessor: tenant.nomeAssessor,
        vereadorSlug: tenant.vereadorSlug,
      }}
      email={session.user?.email ?? ''}
      usageCount={usageCount}
      usageLimit={usageLimit}
    />
  );
}
