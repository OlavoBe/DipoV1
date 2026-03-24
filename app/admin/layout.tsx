import { requireAdmin } from '@/lib/admin';
import { AdminShell } from '@/components/admin/admin-shell';

export const metadata = { title: 'Admin — Dipo' };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await requireAdmin();

  return (
    <AdminShell userEmail={session.user.email ?? ''}>
      {children}
    </AdminShell>
  );
}
