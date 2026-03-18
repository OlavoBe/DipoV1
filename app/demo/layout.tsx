import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Dipo — Experimente grátis',
  description: 'Gere uma indicação legislativa agora, sem cadastro. 1 geração gratuita por dia.',
};

export default function DemoLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* ── Header ──────────────────────────────────── */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <span className="font-bold text-gray-900 text-lg tracking-tight">Dipo</span>
          <span className="text-sm text-gray-400">Software para gabinetes</span>
        </div>
      </header>

      {/* ── Content ─────────────────────────────────── */}
      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-12">
        {children}
      </main>

      {/* ── Footer ──────────────────────────────────── */}
      <footer className="border-t border-gray-100 py-5">
        <p className="text-center text-xs text-gray-400">
          © {new Date().getFullYear()} Dipo · Software para gabinetes legislativos
        </p>
      </footer>
    </div>
  );
}
