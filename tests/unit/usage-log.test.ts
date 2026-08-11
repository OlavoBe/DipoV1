import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * As métricas do beta são o instrumento para decidir o rumo do produto, então
 * a escrita precisa acontecer de fato — mas sem bloquear a resposta e sem
 * nunca derrubar o request que a originou.
 */

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  after: vi.fn((cb: () => unknown) => { void cb(); }),
}));

vi.mock('@/lib/db', () => ({
  prisma: { usageLog: { create: mocks.create } },
  default: { usageLog: { create: mocks.create } },
}));
vi.mock('next/server', () => ({ after: mocks.after }));

import { logUsage } from '@/lib/usage-log';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.create.mockResolvedValue({ id: 'log-1' });
  mocks.after.mockImplementation((cb: () => unknown) => { void cb(); });
});

describe('logUsage', () => {
  it('agenda a escrita com after() em vez de soltar a promise', () => {
    logUsage('tenant-a', 'generate');
    expect(mocks.after).toHaveBeenCalledTimes(1);
  });

  it('grava tenant, ação, usuário e metadata serializada', async () => {
    logUsage('tenant-a', 'download_pdf', 'user-1', { recordId: 'rec-9' });
    await vi.waitFor(() => expect(mocks.create).toHaveBeenCalled());

    expect(mocks.create).toHaveBeenCalledWith({
      data: {
        tenantId: 'tenant-a',
        userId: 'user-1',
        action: 'download_pdf',
        metadata: JSON.stringify({ recordId: 'rec-9' }),
      },
    });
  });

  it('userId e metadata ausentes viram null', async () => {
    logUsage('tenant-a', 'copy_text');
    await vi.waitFor(() => expect(mocks.create).toHaveBeenCalled());

    expect(mocks.create).toHaveBeenCalledWith({
      data: { tenantId: 'tenant-a', userId: null, action: 'copy_text', metadata: null },
    });
  });

  it('não lança nem retorna promise — é chamado sem await no request', () => {
    mocks.create.mockRejectedValue(new Error('banco fora do ar'));
    expect(logUsage('tenant-a', 'generate')).toBeUndefined();
  });

  it('falha do banco é engolida e não vira rejeição não tratada', async () => {
    mocks.create.mockRejectedValue(new Error('banco fora do ar'));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    logUsage('tenant-a', 'generate');
    await vi.waitFor(() => expect(warn).toHaveBeenCalled());

    expect(warn.mock.calls[0][0]).toContain('[usage-log]');
    warn.mockRestore();
  });

  it('fora de contexto de request (after lança) ainda grava', async () => {
    mocks.after.mockImplementation(() => {
      throw new Error('after() called outside a request scope');
    });

    expect(() => logUsage('tenant-a', 'generate')).not.toThrow();
    await vi.waitFor(() => expect(mocks.create).toHaveBeenCalled());
  });
});
