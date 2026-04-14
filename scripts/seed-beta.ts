/**
 * seed-beta.ts — Prepara os 4 tenants beta no banco.
 *
 * Idempotente: se o tenant já existe para um slug, apenas atualiza o plano.
 * NÃO cria users — o assessor se cadastra sozinho via magic link e o onboarding
 * detecta o tenant existente para o slug selecionado.
 *
 * Uso: npx ts-node scripts/seed-beta.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ─────────────────────────────────────────────
// Dados dos 4 gabinetes beta
// (inline para não depender de path aliases do tsconfig)
// ─────────────────────────────────────────────

const BETA_TENANTS = [
  {
    slug:         'juninho_eroso',
    nomeVereador: 'EDMAR LIMA DOS SANTOS',
    nomePartido:  '',
    municipio:    'Guarujá',
    nome:         'Gabinete do Vereador EDMAR LIMA DOS SANTOS',
  },
  {
    slug:         'ariani_paz',
    nomeVereador: 'ARIANI DA SILVA PAZ',
    nomePartido:  '',
    municipio:    'Guarujá',
    nome:         'Gabinete da Vereadora ARIANI DA SILVA PAZ',
  },
  {
    slug:         'marcio_pet',
    nomeVereador: 'MÁRCIO NABOR TARDELLI',
    nomePartido:  '',
    municipio:    'Guarujá',
    nome:         'Gabinete do Vereador MÁRCIO NABOR TARDELLI',
  },
  {
    slug:         'valdemir',
    nomeVereador: 'VALDEMIR BATISTA SANTANA',
    nomePartido:  'Podemos',
    municipio:    'Guarujá',
    nome:         'Gabinete do Vereador VALDEMIR BATISTA SANTANA',
  },
] as const;

// ─────────────────────────────────────────────

async function main() {
  console.log('🌱 Iniciando seed dos tenants beta...\n');

  const ids: Record<string, string> = {};

  for (const vereador of BETA_TENANTS) {
    const existing = await prisma.tenant.findFirst({
      where: { vereadorSlug: vereador.slug },
      select: { id: true, plano: true },
    });

    if (existing) {
      // Idempotente: garante que o plano está em BETA
      await prisma.tenant.update({
        where: { id: existing.id },
        data:  { plano: 'BETA' },
      });
      ids[vereador.slug] = existing.id;
      console.log(`↺  Tenant atualizado: ${vereador.nome}`);
      console.log(`   ID: ${existing.id}\n`);
    } else {
      const tenant = await prisma.tenant.create({
        data: {
          nome:         vereador.nome,
          plano:        'BETA',
          vereadorSlug: vereador.slug,
          nomeVereador: vereador.nomeVereador,
          nomePartido:  vereador.nomePartido,
          municipio:    vereador.municipio,
          nomeAssessor: '',       // preenchido no onboarding pelo assessor
        },
      });
      ids[vereador.slug] = tenant.id;
      console.log(`✅ Tenant criado: ${tenant.nome}`);
      console.log(`   ID: ${tenant.id}\n`);
    }
  }

  console.log('─'.repeat(60));
  console.log('✅ Tenants beta prontos. Quando o assessor se cadastrar via magic link:');
  console.log('');
  console.log('   1. Acesse /onboarding após o primeiro login');
  console.log('   2. No dropdown, selecione o vereador correspondente');
  console.log('      → O sistema detecta o tenant existente e vincula automaticamente');
  console.log('   3. Complete o onboarding normalmente');
  console.log('');
  console.log('   OU vincule manualmente via Prisma Studio:');
  console.log('   npx prisma studio  →  User.tenantId = ID do tenant acima');
  console.log('');
  console.log('   IDs dos tenants criados:');
  for (const [slug, id] of Object.entries(ids)) {
    console.log(`   ${slug.padEnd(20)} ${id}`);
  }
}

main()
  .catch((err) => {
    console.error('❌ Erro no seed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
