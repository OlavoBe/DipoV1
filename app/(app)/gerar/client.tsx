'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  Zap,
  Loader2,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Circle,
  Copy,
  Check,
  Info,
  Clock,
  ThumbsUp,
  ThumbsDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ExtractedData } from '@/lib/types';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

type ResultState =
  | { kind: 'empty' }
  | { kind: 'loading'; step: number }
  | { kind: 'success'; textoFinal: string; recordId: string }
  | { kind: 'error'; message: string }
  | { kind: 'limite'; motivo: string };

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
// UsageBadge
// ─────────────────────────────────────────────

function UsageBadge({ count, limit }: { count: number; limit: number | null }) {
  if (limit === null) return null;

  const pct = limit > 0 ? (count / limit) * 100 : 100;
  const colorClass =
    pct < 70  ? 'bg-green-50  text-green-700  border-green-200'  :
    pct < 90  ? 'bg-yellow-50 text-yellow-700 border-yellow-200' :
                'bg-red-50    text-red-700    border-red-200';

  return (
    <div className={cn('flex items-center justify-between px-3 py-2 rounded-lg border text-xs', colorClass)}>
      <span className="flex items-center gap-1.5">
        <Clock className="h-3 w-3" />
        Indicações nas últimas 3 horas
      </span>
      <span className="font-semibold tabular-nums">{count} / {limit}</span>
    </div>
  );
}

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

interface PerguntasProps {
  perguntas: string[];
  complementos: Record<string, string>;
  onChange: (pergunta: string, valor: string) => void;
  onSubmit: () => void;
  loading: boolean;
}

function PerguntasIncompletas({
  perguntas,
  complementos,
  onChange,
  onSubmit,
  loading,
}: PerguntasProps) {
  const allFilled = perguntas.every((p) => complementos[p]?.trim());

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-3">
      <div>
        <p className="text-sm font-semibold text-amber-800">Informações adicionais necessárias</p>
        <p className="text-xs text-amber-600 mt-0.5">
          Responda para gerar a indicação completa.
        </p>
      </div>

      <div className="space-y-2.5">
        {perguntas.map((pergunta) => (
          <div key={pergunta}>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              {pergunta}
            </label>
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
          <><Loader2 className="h-4 w-4 animate-spin" /> Gerando...</>
        ) : (
          'Completar e Gerar'
        )}
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────
// FeedbackBar
// ─────────────────────────────────────────────

function FeedbackBar({ recordId }: { recordId: string }) {
  const [feedback, setFeedback] = useState<1 | -1 | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleFeedback(value: 1 | -1) {
    if (feedback !== null || loading) return;
    setLoading(true);
    try {
      await fetch(`/api/indicacoes/${recordId}/feedback`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feedback: value }),
      });
      setFeedback(value);
    } catch {
      // silencioso — feedback é opcional
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-2 text-xs text-gray-400">
      {feedback !== null ? (
        <span className={cn(
          'flex items-center gap-1',
          feedback === 1 ? 'text-green-600' : 'text-gray-500',
        )}>
          {feedback === 1 ? <ThumbsUp className="h-3.5 w-3.5" /> : <ThumbsDown className="h-3.5 w-3.5" />}
          Obrigado pelo feedback!
        </span>
      ) : (
        <>
          <span>Esta indicação foi útil?</span>
          <button
            onClick={() => handleFeedback(1)}
            disabled={loading}
            className="flex items-center gap-1 px-2 py-1 rounded hover:bg-green-50 hover:text-green-600 transition-colors disabled:opacity-50"
          >
            <ThumbsUp className="h-3.5 w-3.5" /> Sim
          </button>
          <button
            onClick={() => handleFeedback(-1)}
            disabled={loading}
            className="flex items-center gap-1 px-2 py-1 rounded hover:bg-red-50 hover:text-red-500 transition-colors disabled:opacity-50"
          >
            <ThumbsDown className="h-3.5 w-3.5" /> Não
          </button>
        </>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// CopyButton
// ─────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success('Texto copiado!');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Não foi possível copiar. Selecione e copie manualmente.');
    }
  }

  return (
    <button
      onClick={handleCopy}
      className={cn(
        'btn-primary flex-1 justify-center text-sm transition-all',
        copied && 'bg-green-600 hover:bg-green-600',
      )}
    >
      {copied ? (
        <><Check className="h-4 w-4" /> Copiado!</>
      ) : (
        <><Copy className="h-4 w-4" /> Copiar texto</>
      )}
    </button>
  );
}

// ─────────────────────────────────────────────
// ResultCard
// ─────────────────────────────────────────────

interface ResultCardProps {
  state: ResultState;
  onRetry: () => void;
  onRegenerate: () => void;
}

function ResultCard({ state, onRetry, onRegenerate }: ResultCardProps) {
  // ── empty ──────────────────────────────────
  if (state.kind === 'empty') {
    return (
      <div className="min-h-[280px] rounded-xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center gap-4 p-10 text-center animate-fade-in">
        <svg width="72" height="72" viewBox="0 0 72 72" fill="none" aria-hidden="true">
          <rect x="14" y="10" width="36" height="46" rx="4" fill="#F3F4F6" stroke="#E5E7EB" strokeWidth="1.5"/>
          <path d="M38 10 L50 22 L38 22 Z" fill="#E5E7EB"/>
          <path d="M38 10 L50 22 L38 22" stroke="#E5E7EB" strokeWidth="1.5"/>
          <line x1="21" y1="30" x2="43" y2="30" stroke="#D1D5DB" strokeWidth="1.5" strokeLinecap="round"/>
          <line x1="21" y1="37" x2="43" y2="37" stroke="#D1D5DB" strokeWidth="1.5" strokeLinecap="round"/>
          <line x1="21" y1="44" x2="34" y2="44" stroke="#D1D5DB" strokeWidth="1.5" strokeLinecap="round"/>
          <circle cx="56" cy="56" r="10" fill="#DBEAFE"/>
          <path d="M56 51 L56 61 M51 56 L56 61 L61 56" stroke="#93C5FD" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        <div>
          <p className="text-sm font-medium text-gray-400">A indicação aparecerá aqui</p>
          <p className="text-xs text-gray-300 mt-1">
            Descreva o pedido ao lado e clique em Gerar
          </p>
        </div>
      </div>
    );
  }

  // ── loading ────────────────────────────────
  if (state.kind === 'loading') {
    return (
      <div className="min-h-[280px] rounded-xl border border-gray-200 bg-white animate-fade-in">
        <LoadingSteps step={state.step} />
      </div>
    );
  }

  // ── success ────────────────────────────────
  if (state.kind === 'success') {
    return (
      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden flex flex-col animate-fade-in">
        {/* Header */}
        <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2 shrink-0">
          <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
          <span className="text-sm font-medium text-green-700">Indicação gerada com sucesso</span>
        </div>

        {/* Aviso de uso */}
        <div className="px-4 py-3 border-b border-blue-100 bg-blue-50 flex items-start gap-2.5">
          <Info className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
          <p className="text-xs text-blue-700 leading-relaxed">
            <span className="font-semibold">Como usar:</span> Copie o texto abaixo e cole no modelo do seu gabinete. Adicione o nome do vereador, o número da indicação e a assinatura.
          </p>
        </div>

        {/* Texto scrollável */}
        <div className="overflow-y-auto max-h-[400px] p-5 bg-gray-50">
          <pre className="whitespace-pre-wrap font-serif text-sm leading-relaxed text-gray-900">
            {state.textoFinal}
          </pre>
        </div>

        {/* Ações */}
        <div className="px-4 py-3 border-t border-gray-100 flex gap-2 flex-wrap shrink-0">
          <CopyButton text={state.textoFinal} />
          <button onClick={onRegenerate} className="btn-secondary text-sm">
            <RefreshCw className="h-3.5 w-3.5" />
            Nova indicação
          </button>
        </div>

        {/* Feedback */}
        <div className="px-4 pb-3">
          <FeedbackBar recordId={state.recordId} />
        </div>
      </div>
    );
  }

  // ── limite ─────────────────────────────────
  if (state.kind === 'limite') {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-8 flex flex-col items-center gap-4 text-center animate-fade-in">
        <div className="h-12 w-12 rounded-full bg-amber-100 flex items-center justify-center">
          <Clock className="h-6 w-6 text-amber-500" />
        </div>
        <div>
          <p className="text-sm font-semibold text-amber-900">Limite temporário atingido</p>
          <p className="text-xs text-amber-700 mt-1 max-w-[260px] mx-auto leading-relaxed">
            {state.motivo}
          </p>
        </div>
      </div>
    );
  }

  // ── error ──────────────────────────────────
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-5 space-y-3 animate-fade-in">
      <div className="flex items-start gap-3">
        <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-red-800">Erro ao gerar indicação</p>
          <p className="text-xs text-red-700 mt-1 whitespace-pre-wrap leading-relaxed">
            {state.message}
          </p>
        </div>
      </div>
      <button onClick={onRetry} className="btn-secondary text-sm">
        Tentar novamente
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────
// GerarPageClient — componente principal
// ─────────────────────────────────────────────

interface GerarPageClientProps {
  usageCount: number;
  usageLimit: number | null;
}

export default function GerarPageClient({
  usageCount: initialUsage,
  usageLimit,
}: GerarPageClientProps) {
  const router = useRouter();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [texto, setTexto] = useState('');
  const [result, setResult] = useState<ResultState>({ kind: 'empty' });
  const [questions, setQuestions] = useState<QuestionsState>(null);
  const [localUsage, setLocalUsage] = useState(initialUsage);

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

  // ── Ctrl+Enter envia o formulário ───────────
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

  // ── Chamada à API ───────────────────────────
  const handleGerar = useCallback(
    async (textoInput: string, complementos?: Record<string, string>) => {
      if (textoInput.trim().length < 10) return;

      setResult({ kind: 'loading', step: 0 });
      setQuestions(null);

      try {
        const res = await fetch('/api/indicacao', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ texto: textoInput, complementos }),
        });

        if (res.status === 402) {
          const data = await res.json();
          setResult({ kind: 'limite', motivo: data.motivo ?? 'Limite do período atingido.' });
          return;
        }

        const data = await res.json();

        if (!res.ok || data.status === 'error') {
          const message = data.error ?? 'Erro desconhecido.';
          setResult({ kind: 'error', message });
          toast.error('Erro ao gerar indicação', {
            description: message,
            action: {
              label: 'Tentar novamente',
              onClick: () => handleGerar(textoInput, complementos),
            },
          });
          return;
        }

        if (data.status === 'incomplete') {
          setResult({ kind: 'empty' });
          setQuestions({
            perguntas: data.perguntas_faltantes ?? [],
            extracted: data.extracted,
            complementos: {},
          });
          return;
        }

        if (data.status === 'success') {
          setResult({
            kind: 'success',
            textoFinal: data.texto_final,
            recordId: data.record_id,
          });
          setLocalUsage((u) => u + 1);
          toast.success('Indicação gerada!');
          router.refresh();
        }
      } catch {
        const message = 'Falha de conexão. Verifique sua internet.';
        setResult({ kind: 'error', message });
        toast.error(message, {
          action: {
            label: 'Tentar novamente',
            onClick: () => handleGerar(textoInput, complementos),
          },
        });
      }
    },
    [router],
  );

  function handleRegenerate() {
    setResult({ kind: 'empty' });
    setQuestions(null);
  }

  function handleRetry() {
    handleGerar(texto, questions?.complementos);
  }

  function handleQuestionChange(pergunta: string, valor: string) {
    setQuestions((prev) =>
      prev ? { ...prev, complementos: { ...prev.complementos, [pergunta]: valor } } : prev,
    );
  }

  function handleCompleteAndGenerate() {
    if (!questions) return;
    handleGerar(texto, questions.complementos);
  }

  // ── Render ──────────────────────────────────
  return (
    <div className="grid gap-6 lg:grid-cols-[55%_45%] items-start animate-fade-in">

      {/* ══ COLUNA ESQUERDA ══════════════════════ */}
      <div className="space-y-4">
        <div>
          <h1 className="section-title">Gerar Indicação</h1>
          <p className="section-subtitle">Descreva o pedido em linguagem natural</p>
        </div>

        <div className="card p-4 space-y-3">
          <label htmlFor="texto-pedido" className="sr-only">
            Descrição do pedido legislativo
          </label>
          <textarea
            ref={textareaRef}
            id="texto-pedido"
            className="textarea-base font-mono text-sm"
            style={{ minHeight: 160, maxHeight: 360, overflowY: 'auto' }}
            placeholder="Ex: Solicitar pavimentação da Rua das Flores, bairro Santo Antônio, próximo à escola municipal. Pedido do morador João da Silva."
            value={texto}
            onChange={handleTextareaChange}
            disabled={isLoading}
          />

          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400">
              {texto.length} caracteres
            </span>
            <span className="text-xs text-gray-300">
              Ctrl+Enter para enviar
            </span>
          </div>

          <button
            className="btn-primary w-full"
            onClick={() => handleGerar(texto)}
            disabled={isLoading || texto.trim().length < 10}
          >
            {isLoading ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Processando...</>
            ) : (
              <><Zap className="h-4 w-4" /> Gerar Indicação</>
            )}
          </button>

          <UsageBadge count={localUsage} limit={usageLimit} />
        </div>

        {questions && (
          <PerguntasIncompletas
            perguntas={questions.perguntas}
            complementos={questions.complementos}
            onChange={handleQuestionChange}
            onSubmit={handleCompleteAndGenerate}
            loading={isLoading}
          />
        )}
      </div>

      {/* ══ COLUNA DIREITA ═══════════════════════ */}
      <div
        className="lg:sticky lg:top-[calc(56px+1.5rem)]"
        role="region"
        aria-label="Resultado da indicação"
        aria-live="polite"
        aria-atomic="true"
      >
        <ResultCard
          key={result.kind}
          state={result}
          onRetry={handleRetry}
          onRegenerate={handleRegenerate}
        />
      </div>
    </div>
  );
}
