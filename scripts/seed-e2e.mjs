/**
 * Seed dos testes E2E — as contas que `tests/e2e/*.spec.ts` esperam encontrar.
 *
 *   node scripts/seed-e2e.mjs
 *
 * `.mjs` de propósito: roda com o Node do runner, sem `tsx`, logo depois do
 * `prisma generate`. É idempotente (upsert), então pode rodar de novo à vontade.
 *
 * Duas contas, dois papéis nos testes:
 *   teste-pro-assessor@dipo.local  plano PRO_ASSESSOR, onboarding completo
 *                                  → entra direto em /gerar
 *   teste-trial@dipo.local         plano TRIAL, onboarding completo
 *                                  → exercita o limite de 5 indicações / 3h
 *
 * `teste-onboarding-e2e@dipo.local` NÃO é criada aqui: o teste de onboarding
 * precisa justamente de um usuário novo, sem tenant.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const CONTAS = [
  {
    tenantId: 'e2e-tenant-pro',
    tenantNome: 'Gabinete E2E Pro',
    plano: 'PRO_ASSESSOR',
    email: 'teste-pro-assessor@dipo.local',
    nome: 'Assessor E2E Pro',
  },
  {
    tenantId: 'e2e-tenant-trial',
    tenantNome: 'Gabinete E2E Trial',
    plano: 'TRIAL',
    email: 'teste-trial@dipo.local',
    nome: 'Assessor E2E Trial',
  },
];

const dadosGabinete = {
  nomeVereador: 'Márcio Nabor Tardelli',
  nomePartido: 'PTB',
  municipio: 'Guarujá',
  vereadorSlug: 'marcio_pet',
};

for (const c of CONTAS) {
  await prisma.tenant.upsert({
    where: { id: c.tenantId },
    update: { plano: c.plano, ...dadosGabinete },
    create: {
      id: c.tenantId,
      nome: c.tenantNome,
      plano: c.plano,
      nomeAssessor: c.nome,
      ...dadosGabinete,
    },
  });

  await prisma.user.upsert({
    where: { email: c.email },
    update: { tenantId: c.tenantId, onboardingComplete: true },
    create: {
      email: c.email,
      name: c.nome,
      nome: c.nome,
      papel: 'ASSESSOR',
      tenantId: c.tenantId,
      onboardingComplete: true,
    },
  });

  console.log(`✅ ${c.email} → ${c.plano}`);
}

await prisma.$disconnect();
