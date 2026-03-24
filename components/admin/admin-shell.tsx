'use client';

import { useState } from 'react';
import type React from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { LayoutDashboard, Users, Shield, Menu, X } from 'lucide-react';
import { cn } from '@/lib/utils';

const NAV_ITEMS: { href: string; label: string; icon: React.ComponentType<{ className?: string }>; exact?: boolean }[] = [
  { href: '/admin',          label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { href: '/admin/usuarios', label: 'Usuários',  icon: Users },
];

interface AdminShellProps {
  children: React.ReactNode;
  userEmail: string;
}

export function AdminShell({ children, userEmail }: AdminShellProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  function SidebarContent({ mobile = false }: { mobile?: boolean }) {
    return (
      <>
        {/* Brand */}
        <div className="flex items-center justify-between border-b border-gray-700 px-4 py-4">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-blue-400" />
            <span className="font-bold text-white text-lg tracking-tight">Dipo Admin</span>
          </div>
          {mobile && (
            <button
              onClick={() => setMobileOpen(false)}
              className="p-1.5 rounded-md hover:bg-gray-700 text-gray-400"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2 py-3 space-y-0.5">
          {NAV_ITEMS.map(({ href, label, icon: Icon, exact }) => {
            const isActive = exact ? pathname === href : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
                  isActive
                    ? 'bg-blue-600 text-white font-medium'
                    : 'text-gray-300 hover:bg-gray-700 hover:text-white',
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {label}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="border-t border-gray-700 p-3 space-y-1.5">
          <div className="text-xs text-gray-400 truncate px-1">{userEmail}</div>
          <Link
            href="/"
            className="block text-xs text-gray-400 hover:text-blue-400 transition-colors px-1"
          >
            ← Voltar ao app
          </Link>
          <a
            href="/api/auth/signout"
            className="block text-xs text-gray-400 hover:text-red-400 transition-colors px-1"
          >
            Sair da conta
          </a>
        </div>
      </>
    );
  }

  return (
    <div className="flex min-h-screen bg-gray-950">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col fixed inset-y-0 left-0 z-30 w-56 bg-gray-900 border-r border-gray-700">
        <SidebarContent />
      </aside>
      <div className="hidden md:block shrink-0 w-56" />

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-56 flex flex-col bg-gray-900 border-r border-gray-700 transition-transform duration-200 md:hidden',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <SidebarContent mobile />
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Topbar */}
        <header className="h-14 bg-gray-900 border-b border-gray-700 flex items-center px-4 gap-3 sticky top-0 z-20">
          <button
            onClick={() => setMobileOpen(true)}
            className="md:hidden p-1.5 rounded-md hover:bg-gray-700 text-gray-400"
          >
            <Menu className="h-5 w-5" />
          </button>
          <Shield className="h-4 w-4 text-blue-400 hidden md:block" />
          <span className="text-sm font-semibold text-white">Painel de Administrador</span>
        </header>

        <main className="flex-1 px-4 md:px-8 py-6 md:py-8 bg-gray-950">
          {children}
        </main>
      </div>
    </div>
  );
}
