'use client';

import { useState, useRef } from 'react';
import type { ExtractedData } from '@/lib/types';

type UIState =
  | { phase: 'idle' }
  | { phase: 'loading' }
  | { phase: 'incomplete'; perguntas: string[]; extracted: ExtractedData }
  | { phase: 'success'; textoFinal: string; pdfBase64: string }
  | { phase: 'error'; message: string }
  | { phase: 'limit'; message: string };

export default function DemoPage() {
  const [texto, setTexto] = useState('');
  const [state, setState] = useState<UIState>({ phase: 'idle' });
  const [complementos, setComplementos] = useState<Record<string, string>>({});
  const resultRef = useRef<HTMLDivElement>(null);

  async function handleGerar(textoInput: string, complementosInput?: Record<string, string>) {
    if (textoInput.trim().length < 10) return;
    setState({ phase: 'loading' });

    try {
      const res = await fetch('/api/demo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texto: textoInput, complementos: complementosInput }),
      });

      const data = await res.json();

      if (res.status === 429) {
        setState({ phase: 'limit', message: data.error });
        return;
      }

      if (data.status === 'incomplete') {
        setState({
          phase: 'incomplete',
          perguntas: data.perguntas_faltantes ?? [],
          extracted: data.extracted,
        });
        return;
      }

      if (data.status === 'success') {
        setState({
          phase: 'success',
          textoFinal: data.texto_final,
          pdfBase64: data.pdf_base64,
        });
        setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
        return;
      }

      setState({ phase: 'error', message: data.error ?? 'Erro desconhecido.' });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Falha de conexão.';
      setState({ phase: 'error', message: msg });
    }
  }

  async function handleCompletar() {
    if (state.phase !== 'incomplete') return;
    setState({ phase: 'loading' });
    await handleGerar(texto, complementos);
  }

  function handleNova() {
    setState({ phase: 'idle' });
    setTexto('');
    setComplementos({});
  }

  function handleBaixarPdf() {
    if (state.phase !== 'success') return;
    const bytes = Uint8Array.from(atob(state.pdfBase64), (c) => c.charCodeAt(0));
    const blob = new Blob([bytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'indicacao-demo.pdf';
    a.click();
    URL.revokeObjectURL(url);
  }

  const isLoading = state.phase === 'loading';

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-10 space-y-6">

        {/* Banner demo */}
        <div className="rounded-xl bg-blue-50 border border-blue-200 px-5 py-4">
          <div className="flex items-start gap-3">
            <div className="text-blue-500 text-xl mt-0.5">⚡</div>
            <div>
              <h2 className="font-semibold text-blue-900 text-base">Versão Demo — 1 geração gratuita por dia</h2>
              <p className="text-sm text-blue-700 mt-1">
                Experimente o Dipo sem criar conta. Descreva o pedido e veja a indicação legislativa gerada automaticamente.
                O PDF de demonstração inclui marca d&apos;água. Para uso profissional,{' '}
                <a href="/api/auth/signin" className="underline font-medium">crie sua conta grátis</a>.
              </p>
            </div>
          </div>
        </div>

        {/* Título */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gerar Indicação Legislativa</h1>
          <p className="text-gray-500 text-sm mt-1">
            Descreva o problema em texto livre. O sistema gera automaticamente o texto oficial.
          </p>
        </div>

        {/* Formulário */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Relato do pedido <span className="text-red-500">*</span>
            </label>
            <textarea
              className="w-full border border-gray-200 rounded-lg p-3 text-sm font-mono resize-none focus:outline-none focus:ring-2 focus:ring-blue-400 h-40 disabled:bg-gray-50"
              placeholder={`Descreva em texto livre:\n\n• "Buraco na Rua das Flores nº 120, Jardim Três Marias"\n• "Solicitar ampliação do horário da UBS do Perequê"\n• "Propor forró como patrimônio cultural de Guarujá"`}
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              disabled={isLoading}
            />
            <div className="flex justify-between mt-1">
              <span className="text-xs text-gray-400">Mínimo 10 caracteres</span>
              <span className="text-xs text-gray-400">{texto.length} caracteres</span>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              className="flex items-center gap-2 px-4 py-2 bg-blue-800 text-white text-sm font-medium rounded-lg hover:bg-blue-900 disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={() => handleGerar(texto)}
              disabled={isLoading || texto.trim().length < 10}
            >
              {isLoading ? (
                <>
                  <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                  Processando...
                </>
              ) : (
                'Gerar Indicação'
              )}
            </button>
            {state.phase !== 'idle' && (
              <button
                className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                onClick={handleNova}
                disabled={isLoading}
              >
                Nova
              </button>
            )}
          </div>
        </div>

        {/* Perguntas faltando */}
        {state.phase === 'incomplete' && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 space-y-4">
            <div>
              <h2 className="text-base font-semibold text-amber-800">Informações faltando</h2>
              <p className="text-sm text-amber-700 mt-1">
                Para gerar a indicação, precisamos das seguintes informações adicionais:
              </p>
            </div>
            <div className="space-y-3">
              {state.perguntas.map((pergunta, idx) => (
                <div key={idx}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{pergunta}</label>
                  <input
                    type="text"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                    placeholder="Sua resposta..."
                    value={complementos[pergunta] ?? ''}
                    onChange={(e) =>
                      setComplementos((prev) => ({ ...prev, [pergunta]: e.target.value }))
                    }
                  />
                </div>
              ))}
            </div>
            <button
              className="px-4 py-2 bg-blue-800 text-white text-sm font-medium rounded-lg hover:bg-blue-900 disabled:opacity-50"
              onClick={handleCompletar}
              disabled={state.perguntas.some((p) => !complementos[p]?.trim())}
            >
              Completar e Gerar
            </button>
          </div>
        )}

        {/* Erro */}
        {state.phase === 'error' && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-5">
            <h2 className="text-base font-semibold text-red-800 mb-1">Erro ao gerar</h2>
            <p className="text-sm text-red-700">{state.message}</p>
          </div>
        )}

        {/* Limite atingido */}
        {state.phase === 'limit' && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 space-y-3">
            <h2 className="text-base font-semibold text-amber-800">Limite diário atingido</h2>
            <p className="text-sm text-amber-700">{state.message}</p>
            <a
              href="/api/auth/signin"
              className="inline-block px-4 py-2 bg-blue-800 text-white text-sm font-medium rounded-lg hover:bg-blue-900"
            >
              Crie sua conta grátis
            </a>
          </div>
        )}

        {/* Resultado */}
        {state.phase === 'success' && (
          <div ref={resultRef} className="space-y-4">
            {/* Prévia do texto */}
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
                Prévia — Indicação Legislativa (Demo)
              </h2>
              <div className="bg-gray-50 border border-gray-200 rounded-md p-4">
                <pre className="whitespace-pre-wrap font-serif text-sm leading-relaxed text-gray-900">
                  {state.textoFinal}
                </pre>
              </div>
              <p className="text-xs text-gray-400 mt-2 italic">
                O PDF inclui rodapé e marca d&apos;água de demonstração.
              </p>
            </div>

            {/* Ações */}
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5 flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
              <div>
                <span className="text-sm font-medium text-green-700 flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-green-500 inline-block" />
                  Indicação gerada com sucesso
                </span>
              </div>
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={handleBaixarPdf}
                  className="px-4 py-2 bg-gray-800 text-white text-sm font-medium rounded-lg hover:bg-gray-900"
                >
                  Baixar PDF Demo
                </button>
              </div>
            </div>

            {/* CTA */}
            <div className="rounded-xl bg-gradient-to-br from-blue-800 to-blue-900 text-white px-6 py-6 text-center space-y-3">
              <h3 className="text-lg font-bold">Gostou? Use sem limites.</h3>
              <p className="text-blue-100 text-sm">
                Crie sua conta grátis e gere indicações sem marca d&apos;água, com histórico completo e download em PDF e Word.
              </p>
              <a
                href="/api/auth/signin"
                className="inline-block px-6 py-2.5 bg-white text-blue-900 text-sm font-semibold rounded-lg hover:bg-blue-50 transition-colors"
              >
                Crie sua conta grátis
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
