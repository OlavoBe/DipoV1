import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Indicações Legislativas – Câmara Municipal de Guarujá/SP',
  description: 'Sistema de geração de indicações legislativas para a Câmara Municipal de Guarujá',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen">
        <header className="bg-blue-800 text-white shadow">
          <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
            <div>
              <div className="font-bold text-base leading-tight">
                Sistema de Indicações Legislativas
              </div>
              <div className="text-blue-200 text-xs mt-0.5">
                Câmara Municipal de Guarujá / SP – Vereador Márcio Nabor Tardelli
              </div>
            </div>
            <nav className="flex gap-1">
              <a href="/" className="px-3 py-1.5 rounded text-sm hover:bg-blue-700 transition-colors">
                Gerar Indicação
              </a>
              <a href="/historico" className="px-3 py-1.5 rounded text-sm hover:bg-blue-700 transition-colors">
                Histórico
              </a>
              <a href="/editor.html" className="px-3 py-1.5 rounded text-sm hover:bg-blue-700 transition-colors">
                Editor de Template
              </a>
            </nav>
          </div>
        </header>
        <main className="max-w-5xl mx-auto px-4 py-8">
          {children}
        </main>
        <footer className="mt-12 border-t border-gray-200 bg-white">
          <div className="max-w-5xl mx-auto px-4 py-4 text-center text-xs text-gray-400">
            Sistema MVP – Indicações Legislativas – Câmara Municipal de Guarujá/SP
          </div>
        </footer>
      </body>
    </html>
  );
}
