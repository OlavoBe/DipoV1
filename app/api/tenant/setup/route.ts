import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { auth } from '@/auth';
import { getVereadorOption } from '@/lib/vereadores-options';
import { isVereadorBeta } from '@/lib/vereadores';

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
      vereadorSlug?: string;
      nomeVereador?: string;
      nomePartido?: string;
      municipio?: string;
      nomeAssessor?: string;
      complete?: boolean;
    } = await req.json();

    const { vereadorSlug, nomeVereador, nomePartido, municipio, nomeAssessor, complete } = body;

    // ── Passo 1: setup dos dados do gabinete ──
    if (nomeVereador !== undefined || nomeAssessor !== undefined) {
      const v = nomeVereador?.trim() ?? '';
      const a = nomeAssessor?.trim() ?? '';

      if (!v) return json({ error: 'Nome do vereador é obrigatório.' }, 400);
      if (!a) return json({ error: 'Nome do assessor é obrigatório.' }, 400);

      const slug = vereadorSlug?.trim() || 'outro';

      // Se for um vereador beta, usa os dados do perfil para nome e partido
      const betaPerfil = getVereadorOption(slug);
      const nomeVereadorFinal = betaPerfil?.nomeCompleto ?? v;
      const nomePartidoFinal  = betaPerfil?.partido      ?? (nomePartido?.trim() ?? '');

      const tenantData = {
        nome:         `Gabinete do Vereador ${nomeVereadorFinal}`,
        vereadorSlug: slug,
        nomeVereador: nomeVereadorFinal,
        nomePartido:  nomePartidoFinal,
        municipio:    municipio?.trim() || 'Guarujá',
        nomeAssessor: a,
      };

      const existingTenantId = session.user.tenantId;

      if (existingTenantId) {
        // Usuário já tem tenant — apenas atualiza os dados
        await prisma.tenant.update({
          where: { id: existingTenantId },
          data:  tenantData,
        });
      } else if (isVereadorBeta(slug)) {
        // Slug beta sem tenant próprio: tenta vincular ao tenant beta pré-criado
        // (apenas se ele ainda não tiver assessores vinculados)
        const betaTenant = await prisma.tenant.findFirst({
          where: { vereadorSlug: slug },
          include: { _count: { select: { users: true } } },
        });

        if (betaTenant && betaTenant._count.users === 0) {
          // Tenant beta vazio → vincula o assessor a ele e atualiza dados do onboarding
          await prisma.tenant.update({
            where: { id: betaTenant.id },
            data:  { ...tenantData, plano: 'BETA' },
          });
          await prisma.user.update({
            where: { id: userId },
            data:  { tenantId: betaTenant.id },
          });
        } else {
          // Tenant beta já tem assessores (ou não existe) → cria novo com plano BETA
          const tenant = await prisma.tenant.create({
            data: { ...tenantData, plano: 'BETA' },
          });
          await prisma.user.update({
            where: { id: userId },
            data:  { tenantId: tenant.id },
          });
        }
      } else {
        // Slug genérico → cria novo tenant com plano TRIAL
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
