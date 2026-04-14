import { prisma } from '@/lib/db';

export const PLANOS = {
  DEMO:         'DEMO',
  TRIAL:        'TRIAL',
  BETA:         'BETA',
  PRO_ASSESSOR: 'PRO_ASSESSOR',
  PRO_GABINETE: 'PRO_GABINETE',
  CAMARA:       'CAMARA',
} as const;

export type PlanoKey = keyof typeof PLANOS;

// Limite do plano Trial
export const TRIAL_MAX       = 5;
export const TRIAL_JANELA_MS = 3 * 60 * 60 * 1000; // 3 horas em ms

export interface LimiteResult {
  permitido: boolean;
  motivo?: string;
  restantes?: number;
}

export function getPlanoBadge(plano: string): { label: string; cor: string } {
  switch (plano) {
    case 'DEMO':         return { label: 'Demo',         cor: 'bg-gray-100 text-gray-600' };
    case 'TRIAL':        return { label: 'Trial',        cor: 'bg-yellow-100 text-yellow-700' };
    case 'BETA':         return { label: 'Beta',         cor: 'bg-emerald-100 text-emerald-700' };
    case 'PRO_ASSESSOR': return { label: 'Pro Assessor', cor: 'bg-blue-100 text-blue-700' };
    case 'PRO_GABINETE': return { label: 'Pro Gabinete', cor: 'bg-purple-100 text-purple-700' };
    case 'CAMARA':       return { label: 'Câmara',       cor: 'bg-green-100 text-green-700' };
    default:             return { label: plano,          cor: 'bg-gray-100 text-gray-500' };
  }
}

/**
 * Verifica se um tenant pode gerar mais indicações conforme seu plano.
 *
 * - TRIAL: máximo 5 indicações nas últimas 3 horas
 * - PRO_ASSESSOR, PRO_GABINETE, CAMARA: ilimitado
 * - DEMO: bloqueado na rota autenticada (usa /api/demo)
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
  if (plano === 'BETA' || plano === 'PRO_ASSESSOR' || plano === 'PRO_GABINETE' || plano === 'CAMARA') {
    return { permitido: true };
  }

  // TRIAL: máximo 5 indicações nas últimas 3 horas
  if (plano === 'TRIAL') {
    const treHorasAtras = new Date(Date.now() - TRIAL_JANELA_MS);

    const count = await prisma.indicacao.count({
      where: {
        tenantId,
        createdAt: { gte: treHorasAtras },
      },
    });

    if (count >= TRIAL_MAX) {
      return {
        permitido: false,
        motivo: `Você atingiu o limite de ${TRIAL_MAX} indicações por período de 3 horas. Aguarde um momento e tente novamente.`,
        restantes: 0,
      };
    }

    return { permitido: true, restantes: TRIAL_MAX - count };
  }

  // DEMO: acesso direto à rota autenticada não é permitido
  return {
    permitido: false,
    motivo: 'O plano Demo não permite acesso autenticado. Use a página de demonstração em /demo.',
  };
}
