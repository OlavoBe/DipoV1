import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { generateDocx } from '@/lib/docx';
import { buildFilename } from '@/lib/pdf';

export const maxDuration = 30;

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

    const docxBuffer = await generateDocx(record.textoFinal, templateId);
    const filename = buildFilename(record.tipoServico, record.bairro, 'docx');

    return new NextResponse(new Uint8Array(docxBuffer), {
      status: 200,
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': docxBuffer.length.toString(),
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro interno';
    console.error('[API /docx/[id]] Erro:', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
