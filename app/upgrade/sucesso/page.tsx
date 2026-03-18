import Link from 'next/link';

export default function UpgradeSucessoPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-2xl border border-gray-200 shadow-sm p-10 text-center space-y-5">
        <div className="text-5xl">🎉</div>
        <h1 className="text-2xl font-bold text-gray-900">Pagamento confirmado!</h1>
        <p className="text-gray-600 text-sm">
          Seu plano foi ativado com sucesso. Agora você pode gerar indicações ilimitadas sem marca d&apos;água.
        </p>
        <Link
          href="/"
          className="inline-block mt-2 px-6 py-3 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-colors"
        >
          Ir para o sistema
        </Link>
      </div>
    </div>
  );
}
