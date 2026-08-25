import type { Metadata } from 'next';
import { Check, Clock } from 'lucide-react';
import { TRIAL_MAX, TRIAL_JANELA_MS } from '@/lib/planos';
import { CHECKOUT_SUSPENSO, CONTATO_SUPORTE } from '@/lib/checkout';

/**
 * O limite do Trial escrito por extenso, derivado das constantes.
 *
 * Esta página dizia "3 indicações por semana" enquanto o código fazia 5 a cada
 * 3 horas, e a tela /plano dizia ainda outra coisa. Três números para o mesmo
 * plano. Texto derivado não diverge.
 */
const TRIAL_HORAS = TRIAL_JANELA_MS / (60 * 60 * 1000);
const LIMITE_TRIAL = `${TRIAL_MAX} indicações a cada ${TRIAL_HORAS} horas`;

export const metadata: Metadata = {
  title: 'Planos — Dipo',
  description: 'Indicações legislativas ilimitadas, PDF profissional e template do seu gabinete.',
};

// ─────────────────────────────────────────────
// Dados dos planos
//
// Regra desta tela: `features` lista SÓ o que funciona hoje. O que ainda não
// existe vai em `planejado`, marcado como tal — nunca misturado com um ✓.
//
// Antes disto, a página prometia "Relatórios e estatísticas", "Administração
// centralizada", "Integração com sistema da câmara", "Múltiplos usuários por
// gabinete" e "Múltiplos templates por vereador". Nenhum existe no código: não
// há rota, tela nem modelo para relatório, convite de usuário ou integração.
// Eram promessas cobradas a R$ 97 e R$ 197.
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
      // "Histórico completo" era exagero: a listagem devolve as 50 mais recentes.
      'Histórico das 50 indicações mais recentes',
      'Papel timbrado do gabinete no PDF',
      'Suporte por e-mail',
    ],
    planejado: [
      // O template existe e é aplicado, mas quem edita é a gente, por script.
      // Enquanto não houver editor na tela, isto não é entrega do plano.
      'Editor de template dentro do app',
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
      'Prioridade no suporte',
      'Onboarding personalizado',
    ],
    planejado: [
      'Múltiplos usuários por gabinete',
      'Múltiplos templates por vereador',
      'Relatórios e estatísticas',
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
      'Preço sob consulta',
    ],
    planejado: [
      'Número ilimitado de vereadores',
      'Administração centralizada',
      'Integração com o sistema da câmara',
      'SLA e suporte dedicado',
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
  planejado,
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

        {/* O que ainda não existe fica visualmente separado do que existe:
            cinza, sem ✓ e sob um rótulo explícito. Um item planejado não pode
            ser confundido com entrega ao bater o olho na lista. */}
        {planejado.length > 0 && (
          <>
            <li className="pt-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
              Em desenvolvimento
            </li>
            {planejado.map((f) => (
              <li key={f} className="flex items-start gap-2.5 text-sm text-gray-400">
                <Clock className="h-4 w-4 shrink-0 mt-0.5" />
                {f}
              </li>
            ))}
          </>
        )}
      </ul>

      <a
        href="/api/auth/signin"
        className={`block w-full text-center py-3 rounded-xl text-sm font-semibold transition-colors ${
          destaque
            ? 'bg-blue-600 text-white hover:bg-blue-700'
            : 'bg-gray-900 text-white hover:bg-gray-800'
        }`}
      >
        {/* Não convida a assinar enquanto o checkout está suspenso — ver
            lib/checkout.ts. Criar conta continua valendo: o Trial funciona. */}
        {preco === null || CHECKOUT_SUSPENSO ? 'Criar conta grátis' : 'Criar conta e assinar'}
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

        {/* Assinatura suspensa: os preços seguem visíveis como referência, mas
            a página não pode sugerir que dá para contratar hoje. */}
        {CHECKOUT_SUSPENSO && (
          <div className="rounded-2xl bg-amber-50 border border-amber-200 p-5 text-sm text-amber-900 text-center">
            Os planos pagos ainda não estão abertos para contratação — estamos
            preparando a cobrança recorrente. Para entrar na fila, escreva para{' '}
            <a href={`mailto:${CONTATO_SUPORTE}`} className="font-semibold underline">
              {CONTATO_SUPORTE}
            </a>
            .
          </div>
        )}

        {/* Trial callout */}
        <div className="rounded-2xl bg-white border border-gray-200 p-7 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div>
            <p className="font-semibold text-gray-900">Comece com o plano Trial gratuito</p>
            <p className="text-sm text-gray-500 mt-0.5">
              {LIMITE_TRIAL}, sem precisar de cartão de crédito.
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
