'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CHECKOUT_SUSPENSO, MOTIVO_SUSPENSAO } from '@/lib/checkout';

const PLANOS = [
  {
    id: 'PRO_ASSESSOR',
    nome: 'Pro Assessor',
    preco: 97,
    destaque: false,
    features: [
      'Indicações ilimitadas',
      'Geração por IA com extração automática',
      'Download em PDF e Word',
      'Histórico completo',
      'Template personalizável',
      'Suporte por e-mail',
    ],
  },
  {
    id: 'PRO_GABINETE',
    nome: 'Pro Gabinete',
    preco: 197,
    destaque: true,
    features: [
      'Tudo do Pro Assessor',
      'Múltiplos usuários por gabinete',
      'Múltiplos templates por vereador',
      'Relatórios e estatísticas',
      'Prioridade no suporte',
      'Onboarding personalizado',
    ],
  },
];

export default function UpgradePage() {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function handleAssinar(planoId: string) {
    setLoading(planoId);
    setErro(null);
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plano: planoId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErro(data.error ?? 'Erro ao iniciar checkout.');
        setLoading(null);
        return;
      }
      router.push(data.init_point);
    } catch {
      setErro('Falha de conexão. Tente novamente.');
      setLoading(null);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-4xl mx-auto space-y-8">

        <div className="text-center space-y-2">
          <h1 className="section-title text-3xl">Escolha seu plano</h1>
          <p className="section-subtitle text-base">
            Indicações ilimitadas, PDF profissional e sem marca d&apos;água.
          </p>
        </div>

        {CHECKOUT_SUSPENSO && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-900 text-center">
            {MOTIVO_SUSPENSAO}
          </div>
        )}

        <div role="alert" aria-live="assertive">
          {erro && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700 text-center">
              {erro}
            </div>
          )}
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {PLANOS.map((p) => (
            <div
              key={p.id}
              className={`relative bg-white rounded-2xl border shadow-sm p-7 flex flex-col ${
                p.destaque
                  ? 'border-blue-500 ring-2 ring-blue-500'
                  : 'border-gray-200'
              }`}
            >
              {p.destaque && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-xs font-semibold px-4 py-1 rounded-full whitespace-nowrap">
                  Mais completo
                </div>
              )}

              <div className="mb-5">
                <h2 className="text-xl font-bold text-gray-900">{p.nome}</h2>
                <div className="mt-2 flex items-end gap-1">
                  <span className="text-4xl font-extrabold text-gray-900">
                    R$&nbsp;{p.preco}
                  </span>
                  {/* Sem "/mês" enquanto a cobrança for avulsa: o preço mensal
                      era a promessa que o código não cumpria. */}
                  <span className="text-gray-500 mb-1">
                    {CHECKOUT_SUSPENSO ? 'por mês (em breve)' : '/mês'}
                  </span>
                </div>
              </div>

              <ul className="space-y-2 flex-1 mb-6">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-gray-700">
                    <span className="text-green-500 font-bold mt-0.5">✓</span>
                    {f}
                  </li>
                ))}
              </ul>

              <button
                onClick={() => handleAssinar(p.id)}
                disabled={CHECKOUT_SUSPENSO || loading !== null}
                className={
                  (p.destaque ? 'btn-primary w-full' : 'btn-secondary w-full !bg-gray-900 !text-white hover:!bg-gray-800 !border-gray-900') +
                  (CHECKOUT_SUSPENSO ? ' opacity-50 cursor-not-allowed' : '')
                }
              >
                {CHECKOUT_SUSPENSO
                  ? 'Indisponível no momento'
                  : loading === p.id
                    ? 'Redirecionando...'
                    : 'Assinar agora'}
              </button>
            </div>
          ))}
        </div>

        <p className="text-center text-xs text-gray-400">
          {CHECKOUT_SUSPENSO
            ? 'Nenhuma cobrança será feita enquanto a assinatura estiver indisponível.'
            : 'Pagamento seguro via Mercado Pago. Cancele quando quiser.'}
        </p>
      </div>
    </div>
  );
}
