import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { redirect } from 'next/navigation';
import { getPlanoBadge } from '@/lib/planos';
import { Clock, Zap } from 'lucide-react';

export default async function PlanoPage() {
  const session = await auth();
  if (!session?.user?.tenantId) redirect('/login');

  const tenant = await prisma.tenant.findUnique({
    where: { id: session.user.tenantId },
    select: { plano: true },
  });

  const plano = tenant?.plano ?? 'TRIAL';
  const badge = getPlanoBadge(plano);

  return (
    <div className="max-w-lg space-y-6">
      <div>
        <h1 className="section-title">Plano</h1>
        <p className="section-subtitle">Seu plano atual e opções de upgrade</p>
      </div>

      {/* Plano atual */}
      <div className="card p-5 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700">Plano atual</span>
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${badge.cor}`}>
            {badge.label}
          </span>
        </div>

        {plano === 'TRIAL' && (
          <div className="flex items-start gap-2.5 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2.5">
            <Clock className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
            <p className="text-xs text-blue-700 leading-relaxed">
              No plano Trial você pode gerar até <strong>5 indicações a cada 3 horas</strong>.
              É gratuito durante o período de validação do produto.
            </p>
          </div>
        )}
      </div>

      {/* Em breve */}
      <div className="card p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-blue-600" />
          <h2 className="text-base font-semibold text-gray-900">Planos Pro — Em breve</h2>
        </div>

        <p className="text-sm text-gray-600 leading-relaxed">
          Estamos finalizando os planos pagos com indicações ilimitadas, templates personalizados
          e muito mais. Em breve você poderá assinar diretamente por aqui.
        </p>

        <div className="space-y-2">
          {[
            'Indicações ilimitadas',
            'Templates personalizados do gabinete',
            'Histórico completo',
            'Suporte prioritário',
          ].map((f) => (
            <div key={f} className="flex items-center gap-2 text-sm text-gray-700">
              <span className="text-green-500 font-bold">✓</span>
              {f}
            </div>
          ))}
        </div>

        <p className="text-xs text-gray-400">
          Interesse? Entre em contato pelo e-mail{' '}
          <a href="mailto:contato@dipo.com.br" className="text-blue-600 hover:underline">
            contato@dipo.com.br
          </a>
        </p>
      </div>
    </div>
  );
}
