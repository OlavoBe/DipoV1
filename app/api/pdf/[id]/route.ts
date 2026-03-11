import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { generatePdf, buildFilename } from '@/lib/pdf';

export const maxDuration = 30;

// Next.js 15+ usa params como Promise
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const { id } = await params;
    const templateId = req.nextUrl.searchParams.get('templateId') ?? undefined;

    const record = await prisma.indicacao.findUnique({
      where: { id },
      select: { textoFinal: true, tipoServico: true, bairro: true },
    });

    if (!record) {
      return NextResponse.json({ error: 'Indicação não encontrada' }, { status: 404 });
    }

    const pdfBuffer = await generatePdf(record.textoFinal, templateId);
    const filename = buildFilename(record.tipoServico, record.bairro);

    // Next.js 16 requer Uint8Array (não Buffer diretamente)
    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': pdfBuffer.length.toString(),
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro interno';
    console.error('[API /pdf/[id]] Erro:', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
