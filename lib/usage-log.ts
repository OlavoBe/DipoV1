/**
 * Usage Logging — métricas do beta.
 *
 * Nunca bloqueia a resposta nem propaga erro, mas a escrita **precisa**
 * acontecer: são estas métricas que dizem quais funcionalidades os gabinetes
 * usam de verdade.
 *
 * Antes isto era um fire-and-forget puro (promise solta, sem await). Em
 * serverless isso perde registros: a função pode ser congelada assim que a
 * resposta é enviada, com a escrita ainda pendente — e sem nenhum erro, o que
 * torna a subnotificação invisível.
 *
 * `after()` do Next resolve exatamente esse caso: a callback roda depois da
 * resposta ir para o cliente, mas o runtime mantém a invocação viva até ela
 * terminar. Fora de um contexto de request (scripts, testes) ele lança, e aí
 * caímos no disparo direto.
 */
import { after } from 'next/server';
import { prisma } from '@/lib/db';

export function logUsage(
  tenantId: string,
  action: string,
  userId?: string,
  metadata?: Record<string, unknown>,
): void {
  const escrever = () =>
    prisma.usageLog
      .create({
        data: {
          tenantId,
          userId: userId ?? null,
          action,
          metadata: metadata ? JSON.stringify(metadata) : null,
        },
      })
      .then(() => undefined)
      .catch((err) => {
        console.warn('[usage-log] falha ao registrar log (ignorado):', err?.message);
      });

  try {
    after(escrever);
  } catch {
    // Sem contexto de request — dispara direto e segue.
    void escrever();
  }
}
