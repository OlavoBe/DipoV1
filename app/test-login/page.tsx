'use client';

/**
 * PÁGINA EXCLUSIVA DE TESTES — só acessível quando TEST_MODE=true.
 * Permite login instantâneo com qualquer e-mail sem magic link.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const CONTAS_RAPIDAS = [
  { label: 'Demo', email: 'teste-demo@dipo.local' },
  { label: 'Trial', email: 'teste-trial@dipo.local' },
  { label: 'Pro Assessor', email: 'teste-pro-assessor@dipo.local' },
  { label: 'Pro Gabinete', email: 'teste-pro-gabinete@dipo.local' },
  { label: 'Câmara', email: 'teste-camara@dipo.local' },
];

export default function TestLoginPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  async function handleLogin(emailInput: string) {
    if (!emailInput.trim()) return;
    setLoading(true);
    setError('');

    const res = await fetch('/api/test-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: emailInput.trim() }),
    });

    if (res.status === 404) {
      setError('TEST_MODE não está ativo. Adicione TEST_MODE=true ao .env.local e reinicie.');
      setLoading(false);
      return;
    }

    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? 'Erro ao fazer login.');
      setLoading(false);
      return;
    }

    router.push('/');
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-yellow-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">

        {/* Banner de aviso */}
        <div className="bg-yellow-100 border-2 border-yellow-400 rounded-xl px-5 py-4 text-center">
          <div className="text-2xl mb-1">⚠️</div>
          <p className="font-bold text-yellow-900 text-sm">MODO DE TESTES</p>
          <p className="text-yellow-700 text-xs mt-1">
            Esta página não existe em produção. Remova TEST_MODE do .env.local quando terminar.
          </p>
        </div>

        {/* Contas rápidas */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-3">
          <p className="text-sm font-semibold text-gray-700">Entrar como:</p>
          <div className="grid grid-cols-1 gap-2">
            {CONTAS_RAPIDAS.map(({ label, email: e }) => (
              <button
                key={e}
                onClick={() => handleLogin(e)}
                disabled={loading}
                className="flex items-center justify-between px-4 py-2.5 border border-gray-200 rounded-lg text-sm hover:bg-gray-50 hover:border-blue-300 transition-colors disabled:opacity-50"
              >
                <span className="font-medium text-gray-800">{label}</span>
                <span className="text-xs text-gray-400">{e}</span>
              </button>
            ))}
          </div>
        </div>

        {/* E-mail customizado */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-3">
          <p className="text-sm font-semibold text-gray-700">Ou entre com qualquer e-mail:</p>
          <input
            type="email"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            placeholder="qualquer@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleLogin(email)}
          />
          <button
            onClick={() => handleLogin(email)}
            disabled={loading || !email.trim()}
            className="w-full px-4 py-2 bg-blue-800 text-white text-sm font-medium rounded-lg hover:bg-blue-900 disabled:opacity-50"
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>

        <p className="text-center text-xs text-gray-400">
          Após o login, configure o plano do usuário via{' '}
          <code className="bg-gray-100 px-1 rounded">npx prisma studio</code>
        </p>
      </div>
    </div>
  );
}
