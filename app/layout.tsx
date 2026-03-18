import type { Metadata } from 'next';
import './globals.css';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

export const metadata: Metadata = {
  title: 'Indicações Legislativas – Câmara Municipal de Guarujá/SP',
  description: 'Sistema de geração de indicações legislativas para a Câmara Municipal de Guarujá',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  let tenantNome: string | null = null;
  if (session?.user?.tenantId) {
    const tenant = await prisma.tenant.findUnique({
      where: { id: session.user.tenantId },
      select: { nome: true },
    });
    tenantNome = tenant?.nome ?? null;
  }

  return (
    <html lang="pt-BR" className={cn("font-sans", geist.variable)}>
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

            <div className="flex items-center gap-4">
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

              {session?.user && (
                <div className="flex items-center gap-2 border-l border-blue-600 pl-4">
                  <div className="text-right">
                    <div className="text-xs text-white font-medium">{session.user.email}</div>
                    {tenantNome && (
                      <div className="text-xs text-blue-300">{tenantNome}</div>
                    )}
                  </div>
                  <a
                    href="/api/auth/signout"
                    className="px-2 py-1 rounded text-xs bg-blue-700 hover:bg-blue-600 transition-colors whitespace-nowrap"
                  >
                    Sair
                  </a>
                </div>
              )}
            </div>
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
