import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { generatePdf, buildFilename } from '@/lib/pdf';
import { auth } from '@/auth';

/**
 * 60 e não 30 por causa do empacotamento, não do tempo de execução.
 *
 * A Vercel agrupa numa mesma lambda as rotas que declaram o mesmo
 * `maxDuration`. Com 30 aqui e 60 em `/api/demo` e `/api/health/pdf`, as rotas
 * que geram PDF caíam em dois grupos — e cada grupo levava a sua cópia dos 64MB
 * do `@sparticuz/chromium`. Eram 155MB dos 188MB de cada deployment, o que
 * estourou o limite de Functions Storage do plano com 62 deployments retidos.
 *
 * Com os três em 60, o Chromium viaja uma vez só: 188MB → 111MB por deployment.
 * Confira o agrupamento no deployment, não no build:
 *   /api/v1/deployments/<id>/builds → agrupe os outputs por `digest`
 *
 * O teto maior não muda o custo (a cobrança é pelo tempo real), só dá folga ao
 * cold start do Chromium.
 */
export const maxDuration = 60;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
    }
    // Sem tenant vinculado não há o que baixar. Antes o filtro de tenant era
    // omitido nesse caso, o que permitia baixar qualquer indicação por ID.
    const tenantId = session.user.tenantId;
    if (!tenantId) {
      return NextResponse.json({ error: 'Usuário sem tenant vinculado.' }, { status: 403 });
    }

    const { id } = await params;
    const templateId = req.nextUrl.searchParams.get('templateId') ?? undefined;
    // ?inline=1 abre no visualizador do navegador (botão Imprimir);
    // sem ele, baixa o arquivo.
    const inline = req.nextUrl.searchParams.get('inline') === '1';

    const record = await prisma.indicacao.findFirst({
      where: { id, tenantId },
      select: { textoFinal: true, tipoServico: true, bairro: true },
    });

    if (!record) {
      return NextResponse.json({ error: 'Indicação não encontrada' }, { status: 404 });
    }

    const pdfBuffer = await generatePdf(record.textoFinal, templateId, tenantId);
    const filename = buildFilename(record.tipoServico, record.bairro);

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename="${filename}"`,
        'Content-Length': pdfBuffer.length.toString(),
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro interno';
    console.error('[API /pdf/[id]] Erro:', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
