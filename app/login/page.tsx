import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import LoginClient from './client';

export default async function LoginPage() {
  const session = await auth();

  // Já autenticado → painel
  if (session?.user) redirect('/gerar');

  return <LoginClient />;
}
