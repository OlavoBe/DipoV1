import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TRIAL_MAX, TRIAL_JANELA_MS, getPlanoBadge, PLANOS } from '@/lib/planos';

// ─────────────────────────────────────────────
// Mock do Prisma — isolado do banco real
// ─────────────────────────────────────────────

vi.mock('@/lib/db', () => ({
  prisma: {
    tenant: {
      findUnique: vi.fn(),
    },
    indicacao: {
      count: vi.fn(),
    },
  },
}));

// Importa depois do mock para pegar o módulo com prisma mockado
const { checkLimite } = await import('@/lib/planos');
const { prisma } = await import('@/lib/db');

const mockTenant = prisma.tenant.findUnique as ReturnType<typeof vi.fn>;
const mockCount  = prisma.indicacao.count  as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
});

// ─────────────────────────────────────────────
// Constantes do plano Trial
// ─────────────────────────────────────────────

describe('constantes do plano Trial', () => {
  it('TRIAL_MAX é 5', () => {
    expect(TRIAL_MAX).toBe(5);
  });

  it('TRIAL_JANELA_MS é 3 horas em ms', () => {
    expect(TRIAL_JANELA_MS).toBe(3 * 60 * 60 * 1000);
  });
});

// ─────────────────────────────────────────────
// checkLimite
// ─────────────────────────────────────────────

describe('checkLimite', () => {
  it('retorna permitido=false quando tenant não encontrado', async () => {
    mockTenant.mockResolvedValue(null);
    const result = await checkLimite('tenant-inexistente');
    expect(result.permitido).toBe(false);
    expect(result.motivo).toContain('não encontrado');
  });

  it('TRIAL: permite quando abaixo do limite', async () => {
    mockTenant.mockResolvedValue({ plano: 'TRIAL' });
    mockCount.mockResolvedValue(3);
    const result = await checkLimite('tenant-trial');
    expect(result.permitido).toBe(true);
    expect(result.restantes).toBe(2); // 5 - 3
  });

  it('TRIAL: bloqueia quando no limite exato', async () => {
    mockTenant.mockResolvedValue({ plano: 'TRIAL' });
    mockCount.mockResolvedValue(5);
    const result = await checkLimite('tenant-trial');
    expect(result.permitido).toBe(false);
    expect(result.restantes).toBe(0);
  });

  it('TRIAL: bloqueia quando acima do limite', async () => {
    mockTenant.mockResolvedValue({ plano: 'TRIAL' });
    mockCount.mockResolvedValue(7);
    const result = await checkLimite('tenant-trial');
    expect(result.permitido).toBe(false);
  });

  it('TRIAL: motivo de bloqueio menciona limite e período', async () => {
    mockTenant.mockResolvedValue({ plano: 'TRIAL' });
    mockCount.mockResolvedValue(5);
    const result = await checkLimite('tenant-trial');
    expect(result.motivo).toContain('5');
    expect(result.motivo).toContain('3 horas');
  });

  it('PRO_ASSESSOR: sempre permitido (ilimitado)', async () => {
    mockTenant.mockResolvedValue({ plano: 'PRO_ASSESSOR' });
    const result = await checkLimite('tenant-pro');
    expect(result.permitido).toBe(true);
    expect(mockCount).not.toHaveBeenCalled();
  });

  it('PRO_GABINETE: sempre permitido (ilimitado)', async () => {
    mockTenant.mockResolvedValue({ plano: 'PRO_GABINETE' });
    const result = await checkLimite('tenant-pro-gabinete');
    expect(result.permitido).toBe(true);
  });

  it('CAMARA: sempre permitido (ilimitado)', async () => {
    mockTenant.mockResolvedValue({ plano: 'CAMARA' });
    const result = await checkLimite('tenant-camara');
    expect(result.permitido).toBe(true);
  });

  it('BETA: sempre permitido (ilimitado)', async () => {
    mockTenant.mockResolvedValue({ plano: 'BETA' });
    const result = await checkLimite('tenant-beta');
    expect(result.permitido).toBe(true);
    expect(mockCount).not.toHaveBeenCalled();
  });

  it('DEMO: bloqueado na rota autenticada', async () => {
    mockTenant.mockResolvedValue({ plano: 'DEMO' });
    const result = await checkLimite('tenant-demo');
    expect(result.permitido).toBe(false);
    expect(result.motivo).toContain('Demo');
  });
});

// ─────────────────────────────────────────────
// getPlanoBadge
// ─────────────────────────────────────────────

describe('getPlanoBadge', () => {
  it('retorna label e cor para cada plano conhecido', () => {
    const casos = [
      { plano: 'DEMO',         label: 'Demo' },
      { plano: 'TRIAL',        label: 'Trial' },
      { plano: 'BETA',         label: 'Beta' },
      { plano: 'PRO_ASSESSOR', label: 'Pro Assessor' },
      { plano: 'PRO_GABINETE', label: 'Pro Gabinete' },
      { plano: 'CAMARA',       label: 'Câmara' },
    ] as const;

    for (const { plano, label } of casos) {
      const badge = getPlanoBadge(plano);
      expect(badge.label).toBe(label);
      expect(badge.cor).toBeTruthy();
    }
  });

  it('BETA usa cor verde-esmeralda', () => {
    const badge = getPlanoBadge('BETA');
    expect(badge.cor).toContain('emerald');
  });

  it('retorna fallback para plano desconhecido', () => {
    const badge = getPlanoBadge('PLANO_INVENTADO');
    expect(badge.label).toBe('PLANO_INVENTADO');
    expect(badge.cor).toBeTruthy();
  });

  it('objeto PLANOS contém todos os planos esperados', () => {
    expect(Object.keys(PLANOS)).toEqual(
      expect.arrayContaining(['DEMO', 'TRIAL', 'BETA', 'PRO_ASSESSOR', 'PRO_GABINETE', 'CAMARA']),
    );
  });
});
