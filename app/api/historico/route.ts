import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET() {
  try {
    const items = await prisma.indicacao.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        createdAt: true,
        tipoServico: true,
        bairro: true,
        logradouro: true,
        numero: true,
        cep: true,
        textoFinal: true,
      },
    });

    return NextResponse.json({ items });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro interno';
    console.error('[API /historico] Erro:', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
