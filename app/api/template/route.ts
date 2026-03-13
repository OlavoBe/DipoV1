import { NextRequest, NextResponse } from 'next/server';
import { getActiveTemplate, getTemplateById, saveActiveTemplate } from '@/lib/template';
import { prisma } from '@/lib/db';
import { auth } from '@/auth';

/** Retorna o template ativo (ou defaults). Aceita ?id=... para template específico. */
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
    }
    const tenantId = session.user.tenantId ?? undefined;

    const id = req.nextUrl.searchParams.get('id');
    let name = 'Template Padrão';
    let settings;
    if (id) {
      settings = await getTemplateById(id, tenantId);
      const record = await prisma.template.findUnique({
        where: { id, ...(tenantId ? { tenantId } : {}) },
        select: { name: true },
      });
      if (record) name = record.name;
    } else {
      settings = await getActiveTemplate(tenantId);
      const record = await prisma.template.findFirst({
        where: { isActive: true, ...(tenantId ? { tenantId } : {}) },
        select: { name: true },
      });
      if (record) name = record.name;
    }
    return NextResponse.json({ settings, name });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro interno';
    console.error('[API /template GET]', err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/** Salva/atualiza o template.
 *  Body: { ...settings, _name?: string, _createNew?: boolean }
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
    }
    const tenantId = session.user.tenantId ?? undefined;

    const body = await req.json();
    const name = body._name as string | undefined;
    const createNew = body._createNew as boolean | undefined;
    const { _name, _createNew, ...settings } = body;
    const id = await saveActiveTemplate(settings, name, createNew, tenantId);
    return NextResponse.json({ ok: true, id });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro interno';
    console.error('[API /template POST]', err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
