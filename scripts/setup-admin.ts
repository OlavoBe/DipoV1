/**
 * Script de setup inicial do admin e limpeza do banco.
 * Executa com: npx tsx scripts/setup-admin.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🗑️  Limpando banco de dados...');

  // Ordem respeitando FK
  await prisma.indicacao.deleteMany();
  await prisma.template.deleteMany();
  await prisma.session.deleteMany();
  await prisma.account.deleteMany();
  await prisma.verificationToken.deleteMany();
  await prisma.demoUso.deleteMany();
  await prisma.user.deleteMany();
  await prisma.tenant.deleteMany();

  console.log('✅ Banco limpo!');

  // Tenant do admin
  const tenant = await prisma.tenant.create({
    data: {
      nome: 'Dipo Admin',
      plano: 'PRO_ASSESSOR',
      nomeVereador: 'Admin',
      nomePartido: '',
      municipio: 'Admin',
      nomeAssessor: 'Olavo Bernardo',
    },
  });

  // Usuário admin
  await prisma.user.create({
    data: {
      email: 'olavobernardo@gmail.com',
      name: 'Olavo Bernardo',
      nome: 'Olavo Bernardo',
      isAdmin: true,
      onboardingComplete: true,
      tenantId: tenant.id,
    },
  });

  console.log('✅ Admin criado:');
  console.log('   Email: olavobernardo@gmail.com');
  console.log('   Plano: PRO_ASSESSOR');
  console.log('   isAdmin: true');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
