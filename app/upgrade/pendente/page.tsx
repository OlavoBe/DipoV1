import Link from 'next/link';

export default function UpgradePendentePage() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-2xl border border-gray-200 shadow-sm p-10 text-center space-y-5">
        <div className="text-5xl">⏳</div>
        <h1 className="text-2xl font-bold text-gray-900">Pagamento em análise</h1>
        <p className="text-gray-600 text-sm">
          Seu pagamento está sendo processado. Você receberá um e-mail assim que for confirmado e seu plano será ativado automaticamente.
        </p>
        <Link
          href="/"
          className="inline-block mt-2 px-6 py-3 bg-gray-800 text-white text-sm font-semibold rounded-xl hover:bg-gray-900 transition-colors"
        >
          Ir para o sistema
        </Link>
      </div>
    </div>
  );
}
