'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  Zap,
  ClipboardList,
  Settings,
  CreditCard,
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ─────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────

const NAV_ITEMS = [
  { href: '/gerar',         label: 'Gerar Indicação', icon: Zap },
  { href: '/historico',     label: 'Histórico',       icon: ClipboardList },
  { href: '/configuracoes', label: 'Configurações',   icon: Settings },
  { href: '/plano',         label: 'Plano',           icon: CreditCard },
] as const;

const PAGE_TITLES: Record<string, string> = {
  '/gerar':         'Gerar Indicação',
  '/historico':     'Histórico',
  '/configuracoes': 'Configurações',
  '/plano':         'Plano',
};

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
    <div className={cn('mx-3 mb-3 px-3 py-2 rounded-lg border text-xs font-medium animate-slide-down', colorClass)}>
      <div className="text-[10px] font-normal opacity-60 mb-0.5">Últimas 3 horas</div>
      {count} / {limit} indicações
    </div>
  );
}

// ─────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────

interface AppShellProps {
  tenantNome: string;
  plano: string;
  usageCount: number;
  usageLimit: number | null;
  userEmail: string;
  children: React.ReactNode;
}

// ─────────────────────────────────────────────
// AppShell
// ─────────────────────────────────────────────

export function AppShell({
  tenantNome,
  plano,
  usageCount,
  usageLimit,
  userEmail,
  children,
}: AppShellProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Fecha o drawer mobile em toda mudança de rota
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const pageTitle = PAGE_TITLES[pathname] ?? '';

  // ── Conteúdo interno da sidebar ──────────────
  function SidebarContent({ mobile = false }: { mobile?: boolean }) {
    const show = mobile || !collapsed;

    return (
      <>
        {/* Brand */}
        <div
          className={cn(
            'flex items-center border-b border-gray-100 px-4 py-4',
            show ? 'justify-between' : 'justify-center',
          )}
        >
          {show ? (
            <>
              <span className="font-bold text-blue-700 text-xl tracking-tight select-none">
                Dipo
              </span>
              {mobile && (
                <button
                  onClick={() => setMobileOpen(false)}
                  className="p-1.5 rounded-md hover:bg-gray-100 text-gray-400 transition-colors"
                  aria-label="Fechar menu"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </>
          ) : (
            <span className="font-bold text-blue-700 text-lg select-none">D</span>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const isActive = pathname === href || pathname.startsWith(href + '/');
            return (
              <Link
                key={href}
                href={href}
                title={!show ? label : undefined}
                className={cn(
                  'flex items-center gap-3 rounded-md text-sm transition-colors duration-150 group',
                  show ? 'px-3 py-2' : 'justify-center px-2 py-2.5',
                  isActive
                    ? 'border-l-[3px] border-blue-600 bg-blue-50 text-blue-700 font-medium'
                    : 'border-l-[3px] border-transparent text-gray-600 hover:bg-gray-50 hover:text-gray-900',
                  // compensar a borda esquerda para alinhar o ícone
                  isActive ? 'pl-[9px]' : 'pl-[9px]',
                )}
              >
                <Icon
                  className={cn(
                    'h-4 w-4 shrink-0',
                    isActive
                      ? 'text-blue-600'
                      : 'text-gray-400 group-hover:text-gray-600',
                  )}
                />
                {show && <span>{label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Usage badge (só quando expandida) */}
        {show && <UsageBadge count={usageCount} limit={usageLimit} />}

        {/* Rodapé: usuário + botão colapsar */}
        <div
          className={cn(
            'border-t border-gray-100 p-3',
            show ? 'space-y-1.5' : 'flex flex-col items-center gap-2',
          )}
        >
          {show && (
            <>
              <div className="text-xs font-medium text-gray-700 truncate px-1">
                {tenantNome || 'Sem gabinete'}
              </div>
              <div className="text-xs text-gray-400 truncate px-1">{userEmail}</div>
              <a
                href="/api/auth/signout"
                className="block text-xs text-gray-400 hover:text-red-500 transition-colors px-1 pt-0.5"
              >
                Sair da conta
              </a>
            </>
          )}

          {/* Botão colapsar — apenas desktop */}
          {!mobile && (
            <button
              onClick={() => setCollapsed((c) => !c)}
              className="flex items-center justify-center w-full p-1.5 rounded-md hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
              title={collapsed ? 'Expandir sidebar' : 'Colapsar sidebar'}
            >
              {collapsed ? (
                <ChevronRight className="h-4 w-4" />
              ) : (
                <ChevronLeft className="h-4 w-4" />
              )}
            </button>
          )}
        </div>
      </>
    );
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* ── Desktop sidebar ──────────────────── */}
      <aside
        className={cn(
          'hidden md:flex flex-col fixed inset-y-0 left-0 z-30',
          'bg-white border-r border-gray-200 transition-all duration-200',
          collapsed ? 'w-16' : 'w-60',
        )}
      >
        <SidebarContent />
      </aside>

      {/* Espaçador desktop para empurrar o conteúdo */}
      <div
        className={cn(
          'hidden md:block shrink-0 transition-all duration-200',
          collapsed ? 'w-16' : 'w-60',
        )}
      />

      {/* ── Mobile overlay ───────────────────── */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 md:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* ── Mobile sidebar (drawer) ──────────── */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-60 flex flex-col',
          'bg-white border-r border-gray-200 transition-transform duration-200 md:hidden',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <SidebarContent mobile />
      </aside>

      {/* ── Área principal ───────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* TopBar */}
        <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-4 md:px-6 sticky top-0 z-20 shrink-0">
          <div className="flex items-center gap-3">
            {/* Hambúrguer mobile */}
            <button
              onClick={() => setMobileOpen(true)}
              className="md:hidden p-1.5 rounded-md hover:bg-gray-100 text-gray-500 transition-colors"
              aria-label="Abrir menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <h1 className="text-sm font-semibold text-gray-900">{pageTitle}</h1>
          </div>

          {/* Nome do gabinete */}
          {tenantNome && (
            <span className="text-sm text-gray-500 truncate max-w-[180px] hidden sm:block">
              {tenantNome}
            </span>
          )}
        </header>

        {/* Conteúdo da página */}
        <main className="flex-1 px-4 md:px-8 py-6 md:py-8">
          <div className="max-w-5xl animate-fade-in">{children}</div>
        </main>
      </div>
    </div>
  );
}
