import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/admin';
import Link from 'next/link';
import { Users, Building2, FileText, TrendingUp } from 'lucide-react';

const PLANO_LABELS: Record<string, string> = {
  DEMO:         'Demo',
  TRIAL:        'Trial',
  PRO_ASSESSOR: 'Pro Assessor',
  PRO_GABINETE: 'Pro Gabinete',
  CAMARA:       'Câmara',
};

const PLANO_COLORS: Record<string, string> = {
  DEMO:         'bg-gray-700 text-gray-300',
  TRIAL:        'bg-yellow-900/50 text-yellow-300',
  PRO_ASSESSOR: 'bg-blue-900/50 text-blue-300',
  PRO_GABINETE: 'bg-purple-900/50 text-purple-300',
  CAMARA:       'bg-green-900/50 text-green-300',
};

export default async function AdminPage() {
  await requireAdmin();

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [
    totalUsuarios,
    totalTenants,
    totalIndicacoes,
    indicacoesUltimos7Dias,
    planoBreakdown,
    usuariosRecentes,
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
  ]);

  const cards = [
    { label: 'Usuários',              value: totalUsuarios,          icon: Users,      color: 'text-blue-400' },
    { label: 'Tenants',               value: totalTenants,           icon: Building2,  color: 'text-purple-400' },
    { label: 'Indicações totais',     value: totalIndicacoes,        icon: FileText,   color: 'text-green-400' },
    { label: 'Indicações (7 dias)',   value: indicacoesUltimos7Dias, icon: TrendingUp, color: 'text-yellow-400' },
  ];

  return (
    <div className="space-y-8 max-w-6xl">
      <div>
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="text-gray-400 text-sm mt-1">Visão geral da plataforma</p>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-gray-900 border border-gray-700 rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-gray-400 uppercase tracking-wide">{label}</span>
              <Icon className={`h-4 w-4 ${color}`} />
            </div>
            <div className="text-3xl font-bold text-white">{value}</div>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Planos breakdown */}
        <div className="bg-gray-900 border border-gray-700 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-white mb-4">Tenants por Plano</h2>
          <div className="space-y-2">
            {planoBreakdown.length === 0 ? (
              <p className="text-gray-500 text-sm">Nenhum tenant cadastrado</p>
            ) : (
              planoBreakdown.map(({ plano, _count }) => (
                <div key={plano} className="flex items-center justify-between">
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${PLANO_COLORS[plano] ?? 'bg-gray-700 text-gray-300'}`}>
                    {PLANO_LABELS[plano] ?? plano}
                  </span>
                  <span className="text-white font-semibold">{_count._all}</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent users */}
        <div className="bg-gray-900 border border-gray-700 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-white">Usuários Recentes</h2>
            <Link href="/admin/usuarios" className="text-xs text-blue-400 hover:text-blue-300">
              Ver todos →
            </Link>
          </div>
          <div className="space-y-3">
            {usuariosRecentes.length === 0 ? (
              <p className="text-gray-500 text-sm">Nenhum usuário</p>
            ) : (
              usuariosRecentes.map((u) => (
                <div key={u.id} className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-white truncate">{u.email}</span>
                      {u.isAdmin && (
                        <span className="text-[10px] bg-red-900/50 text-red-300 px-1.5 py-0.5 rounded-full shrink-0">
                          admin
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500">
                      {u.tenant?.nome ?? 'Sem tenant'} ·{' '}
                      {new Date(u.criadoEm).toLocaleDateString('pt-BR')}
                    </div>
                  </div>
                  {u.tenant?.plano && (
                    <span className={`text-[11px] px-2 py-0.5 rounded-full shrink-0 ${PLANO_COLORS[u.tenant.plano] ?? 'bg-gray-700 text-gray-300'}`}>
                      {PLANO_LABELS[u.tenant.plano] ?? u.tenant.plano}
                    </span>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
