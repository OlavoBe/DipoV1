import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { auth } from '@/auth';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
    }

    const tenantId = session.user.tenantId;
    if (!tenantId) {
      return NextResponse.json({ error: 'Usuário sem tenant vinculado.' }, { status: 403 });
    }

    const items = await prisma.indicacao.findMany({
      where: { tenantId },
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
        // Autor. `null` nas indicações anteriores ao campo — o histórico
        // precisa saber a diferença entre "não registrado" e "sem autor".
        user: { select: { nome: true, name: true, email: true } },
      },
    });

    // Achata o autor num rótulo só, com precedência nome do sistema → nome do
    // provedor → e-mail. Sem inventar nada quando não há autor registrado.
    const comAutor = items.map(({ user, ...item }) => ({
      ...item,
      autor: user ? (user.nome ?? user.name ?? user.email) : null,
    }));

    return NextResponse.json({ items: comAutor });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro interno';
    console.error('[API /historico] Erro:', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
