import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando seed...');

  // Cria ou reutiliza o Tenant
  const tenant = await prisma.tenant.upsert({
    where: { id: 'seed-tenant-gabinete' },
    update: {},
    create: {
      id: 'seed-tenant-gabinete',
      nome: 'Gabinete Teste',
      plano: 'TRIAL',
    },
  });
  console.log(`✅ Tenant: ${tenant.nome} (${tenant.id})`);

  // Cria ou reutiliza o User
  const user = await prisma.user.upsert({
    where: { email: 'olavobernardo@gmail.com' },
    update: { tenantId: tenant.id, papel: 'ADMIN' },
    create: {
      email: 'olavobernardo@gmail.com',
      name: 'Olavo Bernardo',
      nome: 'Olavo Bernardo',
      papel: 'ADMIN',
      tenantId: tenant.id,
    },
  });
  console.log(`✅ User: ${user.email} — papel: ${user.papel} — tenant: ${user.tenantId}`);

  console.log('\n✔ Seed concluído com sucesso!');
}

main()
  .catch((err) => {
    console.error('❌ Erro no seed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
