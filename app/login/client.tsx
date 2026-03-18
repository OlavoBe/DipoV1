'use client';

import { useState, useRef, useEffect } from 'react';
import { signIn } from 'next-auth/react';
import { MailCheck, Loader2, ArrowLeft, Mail } from 'lucide-react';
import { cn } from '@/lib/utils';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

type UIState =
  | { phase: 'idle' }
  | { phase: 'loading' }
  | { phase: 'success'; sentTo: string }
  | { phase: 'error'; message: string };

// ─────────────────────────────────────────────
// LoginClient
// ─────────────────────────────────────────────

export default function LoginClient() {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<UIState>({ phase: 'idle' });
  const inputRef = useRef<HTMLInputElement>(null);

  // autofocus no input ao montar e ao voltar para idle
  useEffect(() => {
    if (state.phase === 'idle') {
      inputRef.current?.focus();
    }
  }, [state.phase]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) return;

    setState({ phase: 'loading' });

    try {
      const result = await signIn('resend', {
        email:       trimmed,
        callbackUrl: '/gerar',
        redirect:    false,
      });

      if (result?.error) {
        setState({
          phase:   'error',
          message: 'Não foi possível enviar o link. Verifique o e-mail e tente novamente.',
        });
      } else {
        setState({ phase: 'success', sentTo: trimmed });
      }
    } catch {
      setState({
        phase:   'error',
        message: 'Falha de conexão. Verifique sua internet e tente novamente.',
      });
    }
  }

  function handleBack() {
    setState({ phase: 'idle' });
  }

  const isLoading = state.phase === 'loading';

  // ── Estado de sucesso ─────────────────────────
  if (state.phase === 'success') {
    return (
      <PageShell>
        <div className="w-full max-w-sm space-y-6">
          {/* Card de sucesso */}
          <div className="bg-white rounded-2xl border border-green-200 shadow-sm p-8 text-center space-y-4">
            <div className="flex justify-center">
              <div className="h-14 w-14 rounded-full bg-green-50 border border-green-100 flex items-center justify-center">
                <MailCheck className="h-7 w-7 text-green-600" />
              </div>
            </div>

            <div className="space-y-1">
              <h2 className="text-base font-semibold text-gray-900">
                Verifique seu e-mail
              </h2>
              <p className="text-sm text-gray-500 leading-relaxed">
                Enviamos um link de acesso para{' '}
                <span className="font-medium text-gray-800">{state.sentTo}</span>.
              </p>
            </div>

            <p className="text-xs text-gray-400 leading-relaxed">
              Clique no link do e-mail para entrar. Ele expira em 24 horas.
              Verifique também a pasta de spam.
            </p>
          </div>

          {/* Link de voltar */}
          <button
            onClick={handleBack}
            className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-700 transition-colors mx-auto"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Errou o e-mail? Voltar
          </button>
        </div>
      </PageShell>
    );
  }

  // ── Formulário (idle / loading / error) ───────
  return (
    <PageShell>
      <div className="w-full max-w-sm space-y-6">

        {/* Card principal */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 space-y-6">

          {/* Logo + subtítulo */}
          <div className="text-center space-y-1">
            <div className="font-bold text-blue-700 text-2xl tracking-tight">Dipo</div>
            <p className="text-sm text-gray-500">Plataforma para gabinetes legislativos</p>
          </div>

          {/* Formulário */}
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div className="space-y-1.5">
              <label
                htmlFor="email"
                className="block text-sm font-medium text-gray-700"
              >
                Seu e-mail
              </label>

              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                <input
                  ref={inputRef}
                  id="email"
                  type="email"
                  autoComplete="email"
                  // autofocus via useEffect para compatibilidade com SSR
                  className={cn(
                    'input-base pl-9',
                    state.phase === 'error' && 'border-red-400 focus:ring-red-400',
                  )}
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (state.phase === 'error') setState({ phase: 'idle' });
                  }}
                  disabled={isLoading}
                  required
                />
              </div>

              {/* Mensagem de erro inline */}
              {state.phase === 'error' && (
                <p className="text-xs text-red-600">{state.message}</p>
              )}
            </div>

            <button
              type="submit"
              className="btn-primary w-full"
              disabled={isLoading || !email.trim()}
            >
              {isLoading ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Enviando link…</>
              ) : (
                'Enviar link de acesso'
              )}
            </button>
          </form>

          {/* Divisor + texto auxiliar */}
          <p className="text-center text-xs text-gray-400 leading-relaxed">
            Sem senha. Você receberá um link no e-mail para entrar diretamente.
          </p>
        </div>

        {/* Link para demo */}
        <p className="text-center text-xs text-gray-400">
          Quer experimentar antes?{' '}
          <a href="/demo" className="text-blue-600 hover:underline font-medium">
            Ver demonstração
          </a>
        </p>
      </div>
    </PageShell>
  );
}

// ─────────────────────────────────────────────
// PageShell — layout centralizado
// ─────────────────────────────────────────────

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Área central */}
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        {children}
      </div>

      {/* Footer discreto */}
      <footer className="pb-6 px-4 text-center">
        <p className="text-xs text-gray-400">
          Ao acessar, você concorda com os{' '}
          <a href="/termos" className="underline hover:text-gray-600 transition-colors">
            Termos de Uso
          </a>
          .
        </p>
      </footer>
    </div>
  );
}
