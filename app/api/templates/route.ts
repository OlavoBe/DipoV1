import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

/** Lista todos os templates salvos (sem o blob de settings para economizar payload). */
export async function GET() {
  try {
    const templates = await prisma.template.findMany({
      orderBy: { updatedAt: 'desc' },
      select: { id: true, name: true, isActive: true, createdAt: true, updatedAt: true },
    });
    return NextResponse.json({ templates });
  } catch (e) {
    return NextResponse.json({ templates: [] });
  }
}
