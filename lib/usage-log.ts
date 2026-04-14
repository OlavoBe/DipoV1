/**
 * Usage Logging — fire-and-forget para métricas do beta.
 * Nunca bloqueia o request principal nem propaga erros.
 */

import { prisma } from '@/lib/db';

export async function logUsage(
  tenantId: string,
  action: string,
  userId?: string,
  metadata?: Record<string, unknown>,
): Promise<void> {
  // Fire-and-forget: não awaita, não propaga erros
  prisma.usageLog.create({
    data: {
      tenantId,
      userId:   userId ?? null,
      action,
      metadata: metadata ? JSON.stringify(metadata) : null,
    },
  }).catch((err) => {
    console.warn('[usage-log] falha ao registrar log (ignorado):', err?.message);
  });
}
