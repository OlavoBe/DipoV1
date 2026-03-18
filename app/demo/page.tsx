'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import {
  Zap,
  Loader2,
  FileText,
  Download,
  AlertCircle,
  CheckCircle,
  Circle,
  ArrowRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ExtractedData } from '@/lib/types';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

type ResultState =
  | { kind: 'empty' }
  | { kind: 'loading'; step: number }
  | { kind: 'success'; textoFinal: string; pdfBase64: string }
  | { kind: 'error'; message: string }
  | { kind: 'limit'; message: string };

type QuestionsState = {
  perguntas: string[];
  extracted: ExtractedData;
  complementos: Record<string, string>;
} | null;

// ─────────────────────────────────────────────
// Constantes
// ─────────────────────────────────────────────

const LOADING_STEPS = [
  'Analisando o texto…',
  'Extraindo informações…',
  'Gerando o documento…',
  'Finalizando…',
];

// ─────────────────────────────────────────────
// LoadingSteps
// ─────────────────────────────────────────────

function LoadingSteps({ step }: { step: number }) {
  return (
    <div className="flex flex-col gap-3.5 p-8">
      <p className="text-[10px] text-gray-400 uppercase tracking-widest font-semibold mb-1">
        Processando
      </p>
      {LOADING_STEPS.map((label, i) => {
        const done    = i < step;
        const current = i === step;
        return (
          <div
            key={i}
            className={cn(
              'flex items-center gap-3 text-sm transition-all duration-300 animate-step-in',
              done    ? 'text-green-600' :
              current ? 'text-gray-900'  :
                        'text-gray-300',
            )}
            style={{ animationDelay: `${i * 90}ms` }}
          >
            {done ? (
              <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
            ) : current ? (
              <Loader2 className="h-4 w-4 animate-spin text-blue-500 shrink-0" />
            ) : (
              <Circle className="h-4 w-4 shrink-0" />
            )}
            <span className={current ? 'font-medium' : ''}>{label}</span>
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────
// PerguntasIncompletas
// ─────────────────────────────────────────────

function PerguntasIncompletas({
  perguntas,
  complementos,
  onChange,
  onSubmit,
  loading,
}: {
  perguntas: string[];
  complementos: Record<string, string>;
  onChange: (pergunta: string, valor: string) => void;
  onSubmit: () => void;
  loading: boolean;
}) {
  const allFilled = perguntas.every((p) => complementos[p]?.trim());

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 space-y-4 mt-4">
      <div>
        <p className="text-sm font-semibold text-amber-800">Informações adicionais necessárias</p>
        <p className="text-xs text-amber-600 mt-0.5">
          Responda para gerar a indicação completa.
        </p>
      </div>
      <div className="space-y-3">
        {perguntas.map((pergunta) => (
          <div key={pergunta}>
            <label className="block text-xs font-medium text-gray-700 mb-1">{pergunta}</label>
            <input
              type="text"
              className="input-base text-sm"
              placeholder="Sua resposta…"
              value={complementos[pergunta] ?? ''}
              onChange={(e) => onChange(pergunta, e.target.value)}
              disabled={loading}
            />
          </div>
        ))}
      </div>
      <button
        className="btn-primary w-full"
        onClick={onSubmit}
        disabled={!allFilled || loading}
      >
        {loading ? (
          <><Loader2 className="h-4 w-4 animate-spin" /> Gerando…</>
        ) : (
          'Completar e Gerar'
        )}
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────
// DemoCTABanner
// ─────────────────────────────────────────────

function DemoCTABanner() {
  return (
    <div className="rounded-2xl bg-gradient-to-br from-blue-700 to-blue-900 px-6 py-8 text-center space-y-5">
      <div className="space-y-1.5">
        <p className="text-white font-semibold text-base leading-snug">
          Gostou? Crie sua conta e tenha template personalizado do seu gabinete.
        </p>
        <p className="text-blue-200 text-sm">
          Sem marca d'água · histórico completo · PDF e Word · template com seu brasão.
        </p>
      </div>
      <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
        <a
          href="/api/auth/signin"
          className="inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-white text-blue-800 font-semibold text-sm rounded-xl hover:bg-blue-50 transition-colors shadow-sm"
        >
          Criar conta grátis
          <ArrowRight className="h-4 w-4" />
        </a>
        <a
          href="/planos"
          className="text-sm text-blue-300 hover:text-white transition-colors underline underline-offset-4"
        >
          Ver planos
        </a>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// ResultCard
// ─────────────────────────────────────────────

function ResultCard({
  state,
  onBaixarPdf,
  onRetry,
}: {
  state: ResultState;
  onBaixarPdf: () => void;
  onRetry: () => void;
}) {
  // ── empty ──────────────────────────────────
  if (state.kind === 'empty') {
    return (
      <div className="min-h-[240px] rounded-xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center gap-3 p-10 text-center">
        <FileText className="h-10 w-10 text-gray-200" />
        <div>
          <p className="text-sm font-medium text-gray-400">A indicação aparecerá aqui</p>
          <p className="text-xs text-gray-300 mt-1">
            Descreva o pedido acima e clique em Gerar
          </p>
        </div>
      </div>
    );
  }

  // ── loading ────────────────────────────────
  if (state.kind === 'loading') {
    return (
      <div className="rounded-xl border border-gray-200 bg-white min-h-[240px]">
        <LoadingSteps step={state.step} />
      </div>
    );
  }

  // ── limit (429) ────────────────────────────
  if (state.kind === 'limit') {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-7 flex flex-col items-center gap-5 text-center">
        <div className="h-14 w-14 rounded-full bg-amber-100 flex items-center justify-center">
          <AlertCircle className="h-7 w-7 text-amber-500" />
        </div>
        <div>
          <p className="text-sm font-semibold text-amber-900">Limite diário atingido</p>
          <p className="text-xs text-amber-700 mt-1 max-w-[280px] mx-auto leading-relaxed">
            {state.message}
          </p>
        </div>
        <a
          href="/api/auth/signin"
          className="btn-primary text-sm"
        >
          Criar conta grátis
        </a>
      </div>
    );
  }

  // ── error ──────────────────────────────────
  if (state.kind === 'error') {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-5 space-y-3">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-red-800">Erro ao gerar indicação</p>
            <p className="text-xs text-red-700 mt-1 leading-relaxed">{state.message}</p>
          </div>
        </div>
        <button onClick={onRetry} className="btn-secondary text-sm">
          Tentar novamente
        </button>
      </div>
    );
  }

  // ── success ────────────────────────────────
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
            <span className="text-sm font-medium text-green-700">Indicação gerada</span>
          </div>
          <span className="text-[10px] text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full font-medium">
            DEMO
          </span>
        </div>

        {/* Texto scrollável */}
        <div className="overflow-y-auto max-h-[400px] p-5 bg-gray-50">
          <pre className="whitespace-pre-wrap font-serif text-sm leading-relaxed text-gray-900">
            {state.textoFinal}
          </pre>
        </div>

        {/* Nota de marca d'água */}
        <div className="px-5 py-2.5 border-t border-gray-100 bg-white">
          <p className="text-[11px] text-gray-400 italic">
            O PDF inclui marca d'água "Dipo · dipo.com.br". Crie uma conta para remover.
          </p>
        </div>

        {/* Ações */}
        <div className="px-5 py-3.5 border-t border-gray-100 bg-white flex gap-2">
          <button onClick={onBaixarPdf} className="btn-primary text-sm gap-2">
            <Download className="h-4 w-4" />
            Baixar PDF Demo
          </button>
        </div>
      </div>

      {/* CTA Banner — aparece após resultado bem-sucedido */}
      <DemoCTABanner />
    </div>
  );
}

// ─────────────────────────────────────────────
// DemoPage — componente principal
// ─────────────────────────────────────────────

export default function DemoPage() {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [texto, setTexto]       = useState('');
  const [result, setResult]     = useState<ResultState>({ kind: 'empty' });
  const [questions, setQuestions] = useState<QuestionsState>(null);

  const isLoading = result.kind === 'loading';

  // ── Auto-avança o step de loading ───────────
  useEffect(() => {
    if (result.kind !== 'loading') return;
    const { step } = result;
    if (step >= LOADING_STEPS.length - 1) return;

    const timer = setTimeout(() => {
      setResult((prev) =>
        prev.kind === 'loading' ? { kind: 'loading', step: step + 1 } : prev,
      );
    }, 2000);
    return () => clearTimeout(timer);
  }, [result]);

  // ── Ctrl+Enter submete o formulário ─────────
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        if (texto.trim().length >= 10 && !isLoading) {
          handleGerar(texto);
        }
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [texto, isLoading]);

  // ── Auto-resize do textarea ─────────────────
  function handleTextareaChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setTexto(e.target.value);
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 360)}px`;
  }

  // ── Chamada à API de demo ───────────────────
  const handleGerar = useCallback(
    async (textoInput: string, complementos?: Record<string, string>) => {
      if (textoInput.trim().length < 10) return;

      setResult({ kind: 'loading', step: 0 });
      setQuestions(null);

      try {
        const res = await fetch('/api/demo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ texto: textoInput, complementos }),
        });

        const data = await res.json();

        // Limite por IP (429)
        if (res.status === 429) {
          setResult({ kind: 'limit', message: data.error });
          return;
        }

        if (!res.ok || data.status === 'error') {
          setResult({ kind: 'error', message: data.error ?? 'Erro desconhecido.' });
          return;
        }

        // Perguntas faltantes — não consome o limite
        if (data.status === 'incomplete') {
          setResult({ kind: 'empty' });
          setQuestions({
            perguntas: data.perguntas_faltantes ?? [],
            extracted: data.extracted,
            complementos: {},
          });
          return;
        }

        // Sucesso — PDF já vem em base64
        if (data.status === 'success') {
          setResult({
            kind: 'success',
            textoFinal: data.texto_final,
            pdfBase64: data.pdf_base64,
          });
        }
      } catch {
        setResult({ kind: 'error', message: 'Falha de conexão. Verifique sua internet.' });
      }
    },
    [],
  );

  // ── Download do PDF base64 ──────────────────
  function handleBaixarPdf() {
    if (result.kind !== 'success') return;
    const bytes = Uint8Array.from(atob(result.pdfBase64), (c) => c.charCodeAt(0));
    const blob = new Blob([bytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'indicacao-demo.pdf';
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleRetry() {
    handleGerar(texto, questions?.complementos);
  }

  function handleQuestionChange(pergunta: string, valor: string) {
    setQuestions((prev) =>
      prev ? { ...prev, complementos: { ...prev.complementos, [pergunta]: valor } } : prev,
    );
  }

  // ── Render ──────────────────────────────────
  return (
    <div className="space-y-8">

      {/* ── Hero ───────────────────────────── */}
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold text-gray-900 tracking-tight leading-tight">
          Gere uma indicação agora.{' '}
          <span className="text-blue-600">Sem cadastro.</span>
        </h1>
        <p className="text-gray-500 text-base">
          Descreva o pedido e receba o documento pronto em segundos.
        </p>
        <p className="text-xs text-gray-400 mt-1">
          1 geração gratuita por dia · PDF com marca d'água
        </p>
      </div>

      {/* ── Formulário ─────────────────────── */}
      <div className="card p-5 space-y-4">
        <label htmlFor="demo-texto" className="sr-only">
          Descrição do pedido legislativo
        </label>
        <textarea
          ref={textareaRef}
          id="demo-texto"
          aria-label="Descrição do pedido legislativo"
          className="textarea-base font-mono text-sm"
          style={{ minHeight: 160, maxHeight: 360, overflowY: 'auto' }}
          placeholder="Ex: Solicitar pavimentação da Rua das Flores, bairro Santo Antônio, próximo à escola municipal. Pedido do morador João da Silva."
          value={texto}
          onChange={handleTextareaChange}
          disabled={isLoading}
        />

        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-400">{texto.length} caracteres</span>
          <span className="text-xs text-gray-300">Ctrl+Enter para enviar</span>
        </div>

        <button
          className="btn-primary w-full"
          onClick={() => handleGerar(texto)}
          disabled={isLoading || texto.trim().length < 10}
        >
          {isLoading ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> Processando…</>
          ) : (
            <><Zap className="h-4 w-4" /> Gerar Indicação</>
          )}
        </button>
      </div>

      {/* ── Perguntas incompletas ───────────── */}
      {questions && (
        <PerguntasIncompletas
          perguntas={questions.perguntas}
          complementos={questions.complementos}
          onChange={handleQuestionChange}
          onSubmit={() => handleGerar(texto, questions.complementos)}
          loading={isLoading}
        />
      )}

      {/* ── ResultCard ─────────────────────── */}
      <div role="region" aria-label="Resultado da indicação" aria-live="polite" aria-atomic="true">
        {result.kind !== 'empty' && (
          <ResultCard
            key={result.kind}
            state={result}
            onBaixarPdf={handleBaixarPdf}
            onRetry={handleRetry}
          />
        )}
      </div>

      {/* ── Trust signals ──────────────────── */}
      {result.kind === 'empty' && !questions && (
        <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-xs text-gray-400">
          <span>✓ Sem cadastro</span>
          <span>✓ Gerado por IA</span>
          <span>✓ Texto legislativo oficial</span>
          <span>✓ PDF instantâneo</span>
        </div>
      )}
    </div>
  );
}
