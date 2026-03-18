import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import OnboardingClient from './client';

export default async function OnboardingPage() {
  const session = await auth();

  // Não autenticado → login
  if (!session?.user) redirect('/api/auth/signin');

  // Onboarding já concluído → ir direto para o painel
  if (session.user.onboardingComplete) redirect('/gerar');

  // Carrega dados existentes do tenant (se o usuário voltou após passo 1)
  let prefill: {
    nomeVereador: string;
    nomePartido: string;
    municipio: string;
    nomeAssessor: string;
  } | null = null;

  if (session.user.tenantId) {
    const tenant = await prisma.tenant.findUnique({
      where: { id: session.user.tenantId },
      select: {
        nomeVereador: true,
        nomePartido: true,
        municipio: true,
        nomeAssessor: true,
      },
    });
    if (tenant) prefill = tenant;
  }

  return <OnboardingClient prefill={prefill} />;
}
