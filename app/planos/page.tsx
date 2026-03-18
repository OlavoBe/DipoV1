import type { Metadata } from 'next';
import { Check } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Planos — Dipo',
  description: 'Indicações legislativas ilimitadas, PDF profissional e template do seu gabinete.',
};

// ─────────────────────────────────────────────
// Dados dos planos
// ─────────────────────────────────────────────

const PLANOS = [
  {
    id:       'PRO_ASSESSOR',
    nome:     'Pro Assessor',
    preco:    97,
    descricao: 'Para assessores que precisam de agilidade no dia a dia.',
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
    id:       'PRO_GABINETE',
    nome:     'Pro Gabinete',
    preco:    197,
    descricao: 'Para gabinetes com múltiplos assessores e vereadores.',
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
  {
    id:       'CAMARA',
    nome:     'Câmara',
    preco:    null,
    descricao: 'Para câmaras municipais com vários vereadores.',
    destaque: false,
    features: [
      'Tudo do Pro Gabinete',
      'Número ilimitado de vereadores',
      'Administração centralizada',
      'Integração com sistema da câmara',
      'SLA e suporte dedicado',
      'Preço sob consulta',
    ],
  },
] as const;

// ─────────────────────────────────────────────
// PlanCard
// ─────────────────────────────────────────────

function PlanCard({
  nome,
  preco,
  descricao,
  features,
  destaque,
}: (typeof PLANOS)[number]) {
  return (
    <div
      className={`relative flex flex-col rounded-2xl border p-7 shadow-sm ${
        destaque
          ? 'border-blue-500 ring-2 ring-blue-500 bg-white'
          : 'border-gray-200 bg-white'
      }`}
    >
      {destaque && (
        <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-xs font-semibold px-4 py-1 rounded-full whitespace-nowrap">
          Mais completo
        </div>
      )}

      <div className="mb-5">
        <h2 className="text-xl font-bold text-gray-900">{nome}</h2>
        <p className="text-sm text-gray-500 mt-1">{descricao}</p>
        <div className="mt-4 flex items-end gap-1">
          {preco !== null ? (
            <>
              <span className="text-4xl font-extrabold text-gray-900">R$&nbsp;{preco}</span>
              <span className="text-gray-400 mb-1 text-sm">/mês</span>
            </>
          ) : (
            <span className="text-2xl font-bold text-gray-500">Sob consulta</span>
          )}
        </div>
      </div>

      <ul className="space-y-2.5 flex-1 mb-7">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-2.5 text-sm text-gray-700">
            <Check className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
            {f}
          </li>
        ))}
      </ul>

      <a
        href="/api/auth/signin"
        className={`block w-full text-center py-3 rounded-xl text-sm font-semibold transition-colors ${
          destaque
            ? 'bg-blue-600 text-white hover:bg-blue-700'
            : 'bg-gray-900 text-white hover:bg-gray-800'
        }`}
      >
        {preco !== null ? 'Criar conta e assinar' : 'Entrar em contato'}
      </a>
    </div>
  );
}

// ─────────────────────────────────────────────
// PlanosPage
// ─────────────────────────────────────────────

export default function PlanosPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-16 px-4">
      <div className="max-w-5xl mx-auto space-y-12">

        {/* Header */}
        <div className="text-center space-y-3">
          <div className="font-bold text-blue-700 text-xl">Dipo</div>
          <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight">
            Planos simples e transparentes
          </h1>
          <p className="text-gray-500 text-lg max-w-xl mx-auto">
            Indicações ilimitadas, PDF profissional sem marca d'água e template personalizado
            do seu gabinete.
          </p>
        </div>

        {/* Cards */}
        <div className="grid md:grid-cols-3 gap-6 items-start">
          {PLANOS.map((plano) => (
            <PlanCard key={plano.id} {...plano} />
          ))}
        </div>

        {/* Trial callout */}
        <div className="rounded-2xl bg-white border border-gray-200 p-7 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div>
            <p className="font-semibold text-gray-900">Comece com o plano Trial gratuito</p>
            <p className="text-sm text-gray-500 mt-0.5">
              3 indicações por semana, sem precisar de cartão de crédito.
            </p>
          </div>
          <a
            href="/api/auth/signin"
            className="shrink-0 px-5 py-2.5 bg-gray-900 text-white text-sm font-semibold rounded-xl hover:bg-gray-800 transition-colors whitespace-nowrap"
          >
            Criar conta grátis
          </a>
        </div>

        {/* Trust */}
        <div className="flex flex-wrap justify-center gap-x-8 gap-y-3 text-sm text-gray-400">
          <span>✓ Sem contrato de fidelidade</span>
          <span>✓ Cancele quando quiser</span>
          <span>✓ Pagamento seguro via Mercado Pago</span>
          <span>✓ Suporte incluído</span>
        </div>

        {/* Back to demo */}
        <p className="text-center text-sm text-gray-400">
          Ainda com dúvidas?{' '}
          <a href="/demo" className="text-blue-600 hover:underline font-medium">
            Experimente grátis sem cadastro
          </a>
        </p>
      </div>
    </div>
  );
}
