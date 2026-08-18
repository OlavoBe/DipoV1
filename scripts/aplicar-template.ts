/**
 * Aplica o template oficial de um gabinete a um ou mais tenants.
 *
 * Escreve em produção, então roda em dry-run por padrão: mostra exatamente o
 * que faria e só executa com --executar.
 *
 * Uso:
 *   npx tsx scripts/aplicar-template.ts <tenantId> [<tenantId>...]            # dry-run
 *   npx tsx scripts/aplicar-template.ts <tenantId> [...] --executar           # aplica
 *   npx tsx scripts/aplicar-template.ts <tenantId> [...] --executar --sem-slug
 *
 * O que faz em cada tenant:
 *   1. grava o template do preset como o template ATIVO (cria ou atualiza)
 *   2. define vereadorSlug, o que ativa o prompt e os few-shot do gabinete
 *      (pule com --sem-slug)
 */
import { PrismaClient } from '@prisma/client';
import { TEMPLATE_MARCIO } from './preset-marcio';

const VEREADOR_SLUG = 'marcio_pet';
const NOME_TEMPLATE = 'Oficial — Gabinete Márcio do Pet Shop';

const prisma = new PrismaClient({ log: ['error'] });

async function main() {
  const args = process.argv.slice(2);
  const executar = args.includes('--executar');
  const semSlug = args.includes('--sem-slug');
  const tenantIds = args.filter((a) => !a.startsWith('--'));

  if (tenantIds.length === 0) {
    console.error('Informe ao menos um tenantId.');
    process.exit(1);
  }

  const settings = JSON.stringify(TEMPLATE_MARCIO);
  console.log(`Template: "${NOME_TEMPLATE}"`);
  console.log(`  layoutId ${TEMPLATE_MARCIO.layoutId} · ${(settings.length / 1024).toFixed(0)}KB (logos embutidos)`);
  console.log(`  slug     ${semSlug ? '(nao alterar)' : VEREADOR_SLUG}`);
  console.log(executar ? '\nMODO: aplicando\n' : '\nMODO: dry-run (use --executar para valer)\n');

  for (const id of tenantIds) {
    const tenant = await prisma.tenant.findUnique({
      where: { id },
      select: {
        nome: true, vereadorSlug: true,
        templates: { select: { id: true, name: true, isActive: true } },
      },
    });

    if (!tenant) {
      console.error(`  [!] tenant ${id} nao encontrado — pulando`);
      continue;
    }

    console.log(`  ${tenant.nome}`);
    console.log(`     templates hoje : ${tenant.templates.length === 0 ? 'nenhum' : tenant.templates.map((t) => `${t.name}${t.isActive ? ' (ativo)' : ''}`).join(', ')}`);
    console.log(`     vereadorSlug   : ${tenant.vereadorSlug} ${semSlug ? '' : `-> ${VEREADOR_SLUG}`}`);

    if (!executar) {
      const ativo = tenant.templates.find((t) => t.isActive);
      console.log(`     acao           : ${ativo ? 'atualizar o template ativo' : 'criar template ativo'}`);
      console.log('');
      continue;
    }

    const ativo = tenant.templates.find((t) => t.isActive);
    if (ativo) {
      await prisma.template.update({
        where: { id: ativo.id },
        data: { settings, name: NOME_TEMPLATE },
      });
      console.log(`     -> template ${ativo.id} atualizado`);
    } else {
      const novo = await prisma.template.create({
        data: { settings, name: NOME_TEMPLATE, isActive: true, tenantId: id },
      });
      console.log(`     -> template ${novo.id} criado`);
    }

    if (!semSlug) {
      await prisma.tenant.update({ where: { id }, data: { vereadorSlug: VEREADOR_SLUG } });
      console.log(`     -> vereadorSlug = ${VEREADOR_SLUG}`);
    }
    console.log('');
  }

  if (!executar) console.log('Nada foi alterado.');
}

main()
  .catch((e) => { console.error('FALHOU:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
