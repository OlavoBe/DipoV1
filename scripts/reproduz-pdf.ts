/** Reproduz o que /api/pdf/[id] faz, com a ultima indicacao do banco. */
import { PrismaClient } from '@prisma/client';
import { generatePdf, buildFilename } from '../lib/pdf';

const prisma = new PrismaClient({ log: ['error'] });

async function main() {
  const r = await prisma.indicacao.findFirst({
    orderBy: { createdAt: 'desc' },
    select: { id: true, textoFinal: true, tipoServico: true, bairro: true, tenantId: true, createdAt: true },
  });
  if (!r) { console.error('nenhuma indicacao no banco'); process.exit(1); }

  console.log('ultima indicacao:');
  console.log(`  id       ${r.id}`);
  console.log(`  criada   ${r.createdAt.toISOString()}`);
  console.log(`  tenant   ${r.tenantId}`);
  console.log(`  inicio   "${r.textoFinal.slice(0, 70).replace(/\n/g, ' | ')}..."`);

  console.log('\ngerando PDF pelo mesmo caminho da rota...');
  const pdf = await generatePdf(r.textoFinal, undefined, r.tenantId);
  const nome = buildFilename(r.tipoServico, r.bairro);
  console.log(`  OK: ${(pdf.length / 1024).toFixed(0)}KB  ${nome}`);
}
main()
  .catch((e) => { console.error('\nERRO REPRODUZIDO:\n', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
