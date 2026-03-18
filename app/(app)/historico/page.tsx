'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  MapPin,
  Calendar,
  FileDown,
  Copy,
  Check,
  Search,
  ChevronLeft,
  ChevronRight,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

interface IndicacaoItem {
  id: string;
  numero: number;
  assunto: string;
  enderecoCompleto: string | null;
  createdAt: string;
  textoFinal: string;
  status: 'gerada' | 'incompleta';
}

interface ApiResponse {
  items: IndicacaoItem[];
  total: number;
  page: number;
  totalPages: number;
}

type Periodo = '7d' | '30d' | 'mes' | 'todos';

// ─────────────────────────────────────────────
// Constantes
// ─────────────────────────────────────────────

const PERIODOS: { value: Periodo; label: string }[] = [
  { value: '7d',    label: 'Últimos 7 dias'  },
  { value: '30d',   label: 'Últimos 30 dias' },
  { value: 'mes',   label: 'Este mês'        },
  { value: 'todos', label: 'Todos'           },
];

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function formatData(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day:    '2-digit',
    month:  '2-digit',
    year:   'numeric',
    hour:   '2-digit',
    minute: '2-digit',
  });
}

// ─────────────────────────────────────────────
// StatusBadge
// ─────────────────────────────────────────────

function StatusBadge({ status }: { status: 'gerada' | 'incompleta' }) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide',
        status === 'gerada'
          ? 'bg-green-100 text-green-700'
          : 'bg-yellow-100 text-yellow-700',
      )}
    >
      {status === 'gerada' ? 'Gerada' : 'Incompleta'}
    </span>
  );
}

// ─────────────────────────────────────────────
// Skeleton
// ─────────────────────────────────────────────

function IndicacaoSkeleton() {
  return (
    <div className="card p-4 animate-pulse">
      <div className="flex items-start gap-3">
        {/* Número */}
        <div className="h-4 w-6 bg-gray-100 rounded shrink-0 mt-0.5" />
        {/* Conteúdo */}
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-2">
            <div className="h-4 bg-gray-100 rounded w-2/3" />
            <div className="h-4 bg-gray-100 rounded w-14" />
          </div>
          <div className="h-3 bg-gray-100 rounded w-1/2" />
          <div className="h-3 bg-gray-100 rounded w-1/3" />
        </div>
        {/* Botões */}
        <div className="flex gap-2 shrink-0">
          <div className="h-7 w-14 bg-gray-100 rounded" />
          <div className="h-7 w-18 bg-gray-100 rounded" />
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// IndicacaoCard
// ─────────────────────────────────────────────

function IndicacaoCard({ item }: { item: IndicacaoItem }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(item.textoFinal);
      setCopied(true);
      toast.success('Texto copiado para a área de transferência.');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Não foi possível copiar o texto.');
    }
  }

  return (
    <div className="card p-4 hover:shadow-md hover:-translate-y-0.5 transition-all duration-150">
      <div className="flex items-start gap-3 flex-wrap sm:flex-nowrap">

        {/* Número sequencial */}
        <span className="text-xs font-mono text-gray-300 pt-0.5 w-7 shrink-0 text-right select-none">
          #{item.numero}
        </span>

        {/* Conteúdo */}
        <div className="flex-1 min-w-0 space-y-1.5">
          {/* Assunto + badge */}
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-medium text-gray-900 truncate leading-snug">
              {item.assunto}
            </p>
            <StatusBadge status={item.status} />
          </div>

          {/* Endereço */}
          {item.enderecoCompleto && (
            <div className="flex items-center gap-1.5 text-xs text-gray-500">
              <MapPin className="h-3 w-3 shrink-0 text-gray-400" />
              <span className="truncate">{item.enderecoCompleto}</span>
            </div>
          )}

          {/* Data */}
          <div className="flex items-center gap-1.5 text-xs text-gray-400">
            <Calendar className="h-3 w-3 shrink-0" />
            <span>{formatData(item.createdAt)}</span>
          </div>
        </div>

        {/* Ações */}
        <div className="flex items-center gap-2 shrink-0 flex-wrap sm:flex-nowrap">
          <a
            href={`/api/pdf/${item.id}`}
            download
            className="btn-secondary text-xs px-3 py-1.5 gap-1.5"
          >
            <FileDown className="h-3.5 w-3.5" />
            PDF
          </a>
          <button
            onClick={handleCopy}
            className="btn-secondary text-xs px-3 py-1.5 gap-1.5 min-w-[90px] justify-center"
          >
            {copied ? (
              <><Check className="h-3.5 w-3.5 text-green-500" /> Copiado</>
            ) : (
              <><Copy className="h-3.5 w-3.5" /> Copiar texto</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// EmptyState
// ─────────────────────────────────────────────

function EmptyState({ search }: { search: string }) {
  return (
    <div className="card p-12 flex flex-col items-center gap-5 text-center animate-fade-in">
      {search ? (
        /* Search empty — lupa com X */
        <svg width="72" height="72" viewBox="0 0 72 72" fill="none" aria-hidden="true">
          <circle cx="32" cy="32" r="18" fill="#F3F4F6" stroke="#E5E7EB" strokeWidth="1.5"/>
          <line x1="44" y1="44" x2="58" y2="58" stroke="#D1D5DB" strokeWidth="2.5" strokeLinecap="round"/>
          <line x1="26" y1="26" x2="38" y2="38" stroke="#D1D5DB" strokeWidth="1.5" strokeLinecap="round"/>
          <line x1="38" y1="26" x2="26" y2="38" stroke="#D1D5DB" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      ) : (
        /* No data — clipboard vazio */
        <svg width="72" height="72" viewBox="0 0 72 72" fill="none" aria-hidden="true">
          <rect x="16" y="22" width="40" height="42" rx="4" fill="#F9FAFB" stroke="#E5E7EB" strokeWidth="1.5"/>
          <rect x="26" y="14" width="20" height="14" rx="3" fill="#F3F4F6" stroke="#E5E7EB" strokeWidth="1.5"/>
          <line x1="24" y1="38" x2="48" y2="38" stroke="#E5E7EB" strokeWidth="1.5" strokeLinecap="round"/>
          <line x1="24" y1="46" x2="48" y2="46" stroke="#E5E7EB" strokeWidth="1.5" strokeLinecap="round"/>
          <line x1="24" y1="54" x2="38" y2="54" stroke="#E5E7EB" strokeWidth="1.5" strokeLinecap="round"/>
          <circle cx="36" cy="21" r="3" fill="#D1D5DB"/>
        </svg>
      )}
      <div className="space-y-1">
        {search ? (
          <>
            <p className="text-sm font-medium text-gray-700">
              Nenhum resultado para <span className="text-gray-900">"{search}"</span>
            </p>
            <p className="text-xs text-gray-400">
              Tente um termo diferente ou limpe a busca.
            </p>
          </>
        ) : (
          <>
            <p className="text-sm font-medium text-gray-700">Nenhuma indicação ainda</p>
            <p className="text-xs text-gray-400">
              Gere sua primeira indicação e ela aparecerá aqui.
            </p>
          </>
        )}
      </div>
      {!search && (
        <Link href="/gerar" className="btn-primary text-sm">
          Gerar primeira indicação
        </Link>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// HistoricoPage
// ─────────────────────────────────────────────

export default function HistoricoPage() {
  const [search, setSearch]                 = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [periodo, setPeriodo]               = useState<Periodo>('todos');
  const [page, setPage]                     = useState(1);
  const [data, setData]                     = useState<ApiResponse | null>(null);
  const [loading, setLoading]               = useState(true);

  // ── Debounce da busca (300ms) ─────────────
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // ── Reset de página ao trocar período ─────
  useEffect(() => {
    setPage(1);
  }, [periodo]);

  // ── Fetch ─────────────────────────────────
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        search:  debouncedSearch,
        periodo,
        page:    String(page),
      });
      const res = await fetch(`/api/indicacoes?${params}`);
      if (!res.ok) throw new Error('Erro ao carregar histórico.');
      const json: ApiResponse = await res.json();
      setData(json);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao carregar histórico.');
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, periodo, page]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const items      = data?.items      ?? [];
  const total      = data?.total      ?? 0;
  const totalPages = data?.totalPages ?? 1;

  // ── Render ────────────────────────────────
  return (
    <div className="space-y-5 animate-fade-in">

      {/* ── Header ──────────────────────────── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="section-title">Histórico</h1>
          <p className="section-subtitle">
            {loading
              ? 'Carregando…'
              : total > 0
                ? `${total} indicaç${total === 1 ? 'ão' : 'ões'} encontrada${total === 1 ? '' : 's'}`
                : 'Todas as indicações geradas'}
          </p>
        </div>
        <Link href="/gerar" className="btn-primary text-sm shrink-0">
          Nova indicação
        </Link>
      </div>

      {/* ── Filtros ─────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-3">

        {/* Busca */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
          <input
            type="text"
            className="input-base pl-9 pr-8"
            aria-label="Buscar indicações por assunto ou endereço"
            placeholder="Buscar por assunto ou endereço…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded text-gray-400 hover:text-gray-600"
              aria-label="Limpar busca"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Filtro de período */}
        <div className="flex gap-0.5 p-1 bg-gray-100 rounded-lg shrink-0">
          {PERIODOS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setPeriodo(value)}
              className={cn(
                'px-3 py-1.5 rounded-md text-xs font-medium transition-all whitespace-nowrap',
                periodo === value
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700',
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Lista ───────────────────────────── */}
      <div className="space-y-2.5">
        {loading ? (
          // 6 skeletons
          Array.from({ length: 6 }).map((_, i) => <IndicacaoSkeleton key={i} />)
        ) : items.length === 0 ? (
          <EmptyState search={debouncedSearch} />
        ) : (
          items.map((item) => <IndicacaoCard key={item.id} item={item} />)
        )}
      </div>

      {/* ── Paginação ───────────────────────── */}
      {!loading && totalPages > 1 && (
        <div className="flex items-center justify-between pt-1">
          <p className="text-xs text-gray-400">
            Página <span className="font-medium text-gray-600">{page}</span> de {totalPages}
            {total > 0 && (
              <span className="ml-1 text-gray-300">
                · {total} result{total === 1 ? 'ado' : 'ados'}
              </span>
            )}
          </p>
          <div className="flex gap-2">
            <button
              className="btn-secondary text-sm gap-1.5"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
              Anterior
            </button>
            <button
              className="btn-secondary text-sm gap-1.5"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Próxima
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
