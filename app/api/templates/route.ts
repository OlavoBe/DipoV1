import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { auth } from '@/auth';

/** Lista todos os templates salvos do tenant (sem o blob de settings). */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
    }
    const tenantId = session.user.tenantId ?? undefined;

    const templates = await prisma.template.findMany({
      where: { ...(tenantId ? { tenantId } : {}) },
      orderBy: { updatedAt: 'desc' },
      select: { id: true, name: true, isActive: true, createdAt: true, updatedAt: true },
    });
    return NextResponse.json({ templates });
  } catch {
    return NextResponse.json({ templates: [] });
  }
}
