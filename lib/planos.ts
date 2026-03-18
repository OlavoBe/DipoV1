import { prisma } from '@/lib/db';

export const PLANOS = {
  DEMO:         'DEMO',
  TRIAL:        'TRIAL',
  PRO_ASSESSOR: 'PRO_ASSESSOR',
  PRO_GABINETE: 'PRO_GABINETE',
  CAMARA:       'CAMARA',
} as const;

export type PlanoKey = keyof typeof PLANOS;

export interface LimiteResult {
  permitido: boolean;
  motivo?: string;
  restantes?: number;
}

export function getPlanoBadge(plano: string): { label: string; cor: string } {
  switch (plano) {
    case 'DEMO':         return { label: 'Demo',         cor: 'bg-gray-100 text-gray-600' };
    case 'TRIAL':        return { label: 'Trial',        cor: 'bg-yellow-100 text-yellow-700' };
    case 'PRO_ASSESSOR': return { label: 'Pro Assessor', cor: 'bg-blue-100 text-blue-700' };
    case 'PRO_GABINETE': return { label: 'Pro Gabinete', cor: 'bg-purple-100 text-purple-700' };
    case 'CAMARA':       return { label: 'Câmara',       cor: 'bg-green-100 text-green-700' };
    default:             return { label: plano,          cor: 'bg-gray-100 text-gray-500' };
  }
}

/**
 * Verifica se um tenant pode gerar mais indicações conforme seu plano.
 *
 * - DEMO: 1/dia por IP (tratado na rota /api/demo; aqui sempre bloqueia)
 * - TRIAL: máximo 3 indicações nos últimos 7 dias
 * - PRO_ASSESSOR, PRO_GABINETE, CAMARA: ilimitado
 */
export async function checkLimite(tenantId: string): Promise<LimiteResult> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { plano: true },
  });

  if (!tenant) {
    return { permitido: false, motivo: 'Tenant não encontrado.' };
  }

  const { plano } = tenant;

  // Planos ilimitados
  if (plano === 'PRO_ASSESSOR' || plano === 'PRO_GABINETE' || plano === 'CAMARA') {
    return { permitido: true };
  }

  // TRIAL: máximo 3 indicações nos últimos 7 dias
  if (plano === 'TRIAL') {
    const MAX_TRIAL = 3;
    const seteAtras = new Date();
    seteAtras.setDate(seteAtras.getDate() - 7);

    const count = await prisma.indicacao.count({
      where: {
        tenantId,
        createdAt: { gte: seteAtras },
      },
    });

    if (count >= MAX_TRIAL) {
      return {
        permitido: false,
        motivo: `Limite do plano Trial atingido: ${MAX_TRIAL} indicações por semana. Faça upgrade para o plano Pro e continue sem limites.`,
        restantes: 0,
      };
    }

    return { permitido: true, restantes: MAX_TRIAL - count };
  }

  // DEMO: acesso direto à rota autenticada não é permitido no plano Demo
  return {
    permitido: false,
    motivo: 'O plano Demo não permite acesso autenticado. Use a página de demonstração em /demo ou faça upgrade para o plano Trial.',
  };
}
