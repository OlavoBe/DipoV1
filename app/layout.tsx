import type { Metadata } from 'next';
import './globals.css';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster } from 'sonner';
import { Geist } from 'next/font/google';
import { cn } from '@/lib/utils';

const geist = Geist({ subsets: ['latin'], variable: '--font-sans' });

export const metadata: Metadata = {
  title: 'Dipo — Indicações Legislativas',
  description: 'Sistema de geração de indicações legislativas',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={cn('font-sans', geist.variable)}>
      <body className="min-h-screen bg-gray-50">
        <TooltipProvider>
          {children}
          <Toaster richColors position="top-right" visibleToasts={3} duration={4000} />
        </TooltipProvider>
      </body>
    </html>
  );
}
