import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { auth } from '@/auth';

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status });
}

// ─────────────────────────────────────────────
// PATCH /api/tenant/setup
//
// Body (todos opcionais):
//   nomeVereador  — salva dados do passo 1 (obrigatório se enviado junto com nomeAssessor)
//   nomePartido
//   municipio
//   nomeAssessor
//   complete      — true → marca User.onboardingComplete = true
// ─────────────────────────────────────────────

export async function PATCH(req: NextRequest): Promise<NextResponse> {
  try {
    const session = await auth();
    if (!session?.user) return json({ error: 'Não autenticado.' }, 401);

    const userId = session.user.id;

    const body: {
      nomeVereador?: string;
      nomePartido?: string;
      municipio?: string;
      nomeAssessor?: string;
      complete?: boolean;
    } = await req.json();

    const { nomeVereador, nomePartido, municipio, nomeAssessor, complete } = body;

    // ── Passo 1: setup dos dados do gabinete ──
    if (nomeVereador !== undefined || nomeAssessor !== undefined) {
      const v = nomeVereador?.trim() ?? '';
      const a = nomeAssessor?.trim() ?? '';

      if (!v) return json({ error: 'Nome do vereador é obrigatório.' }, 400);
      if (!a) return json({ error: 'Nome do assessor é obrigatório.' }, 400);

      const tenantData = {
        nome:         `Gabinete do Vereador ${v}`,
        nomeVereador: v,
        nomePartido:  nomePartido?.trim() ?? '',
        municipio:    municipio?.trim() || 'Guarujá',
        nomeAssessor: a,
      };

      const existingTenantId = session.user.tenantId;

      if (existingTenantId) {
        // Atualiza tenant existente
        await prisma.tenant.update({
          where: { id: existingTenantId },
          data:  tenantData,
        });
      } else {
        // Cria novo tenant com plano TRIAL e vincula ao usuário
        const tenant = await prisma.tenant.create({
          data: { ...tenantData, plano: 'TRIAL' },
        });
        await prisma.user.update({
          where: { id: userId },
          data:  { tenantId: tenant.id },
        });
      }
    }

    // ── Passo 3: marca onboarding como concluído ──
    if (complete === true) {
      await prisma.user.update({
        where: { id: userId },
        data:  { onboardingComplete: true },
      });
    }

    return json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro interno';
    console.error('[API /tenant/setup] Erro:', err);
    return json({ error: message }, 500);
  }
}
