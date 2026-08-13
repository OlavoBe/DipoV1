/**
 * Remove tenants e todos os dados vinculados a eles.
 *
 * Escrito para limpar os gabinetes do beta que não chegaram a usar o produto,
 * mas serve para qualquer tenant.
 *
 *   node scripts/limpar-tenants.mjs                      # dry-run (padrão)
 *   node scripts/limpar-tenants.mjs --backup             # dry-run + exporta
 *   node scripts/limpar-tenants.mjs --backup --confirmar # exporta e APAGA
 *
 * Seleção (combináveis; sem nenhuma, seleciona `--plano=BETA`):
 *   --plano=BETA          todos os tenants desse plano
 *   --slug=a,b,c          tenants com esses `vereadorSlug`
 *   --id=abc,def          tenants por id
 *
 * ─── Três resguardos, porque isto apaga dado de produção ────────────────────
 *
 * 1. **Dry-run é o padrão.** Sem `--confirmar` nada é escrito nem apagado.
 * 2. **Backup é obrigatório.** `--confirmar` sem `--backup` é recusado. O
 *    despejo vai para `E:\Dipo\_Quarentena\` em JSON — um arquivo por tenant,
 *    com tudo que foi apagado, suficiente para recriar à mão.
 * 3. **Admin nunca é apagado.** Usuário com `isAdmin` é desvinculado do tenant
 *    (`tenantId = null`) em vez de removido, para não perder o acesso ao painel.
 *
 * ─── Ordem de exclusão ──────────────────────────────────────────────────────
 *
 * O schema NÃO tem `onDelete: Cascade` nas relações do Tenant — apagar o
 * tenant primeiro falha por chave estrangeira. A ordem abaixo é obrigatória:
 *
 *   UsageLog → Indicacao → Template → User → Tenant
 *
 * (Account e Session têm cascade a partir de User, então somem junto.)
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v === undefined ? true : v];
  })
);

const DIR_QUARENTENA = args.out || 'E:\\Dipo\\_Quarentena';
const APAGAR = args.confirmar === true;
const BACKUP = args.backup === true;

if (APAGAR && !BACKUP) {
  console.error('✋ --confirmar exige --backup. Não apago nada sem despejo em disco.');
  process.exit(1);
}

// ───────────────────────────────────────────────────────── seleção

const lista = (v) => (typeof v === 'string' ? v.split(',').map((s) => s.trim()).filter(Boolean) : []);

const where = { OR: [] };
if (args.plano) where.OR.push({ plano: String(args.plano) });
if (args.slug) where.OR.push({ vereadorSlug: { in: lista(args.slug) } });
if (args.id) where.OR.push({ id: { in: lista(args.id) } });
if (!where.OR.length) where.OR.push({ plano: 'BETA' });

const tenants = await prisma.tenant.findMany({
  where,
  include: { users: true, _count: { select: { indicacoes: true, templates: true, users: true } } },
});

if (!tenants.length) {
  console.log('Nenhum tenant bate com o filtro. Nada a fazer.');
  await prisma.$disconnect();
  process.exit(0);
}

// ───────────────────────────────────────────────────────── inventário

console.log(`\n${APAGAR ? '🔴 MODO EXCLUSÃO' : '🔍 DRY-RUN (nada será alterado)'}\n`);
console.log(`${tenants.length} tenant(s) selecionado(s):\n`);

let totalIndicacoes = 0;
let totalUsuarios = 0;
const ids = [];

for (const t of tenants) {
  const usageLogs = await prisma.usageLog.count({ where: { tenantId: t.id } });
  const admins = t.users.filter((u) => u.isAdmin);

  console.log(`  ${t.nome}`);
  console.log(`    id            ${t.id}`);
  console.log(`    plano         ${t.plano}   slug: ${t.vereadorSlug}`);
  console.log(`    indicações    ${t._count.indicacoes}`);
  console.log(`    templates     ${t._count.templates}`);
  console.log(`    usage logs    ${usageLogs}`);
  console.log(`    usuários      ${t._count.users}${admins.length ? `  (${admins.length} admin → será desvinculado, não apagado)` : ''}`);
  for (const u of t.users) console.log(`      - ${u.email}${u.isAdmin ? '  [admin]' : ''}`);
  console.log('');

  totalIndicacoes += t._count.indicacoes;
  totalUsuarios += t._count.users;
  ids.push(t.id);
}

console.log(`TOTAL: ${tenants.length} tenants, ${totalIndicacoes} indicações, ${totalUsuarios} usuários\n`);

// ───────────────────────────────────────────────────────── backup

if (BACKUP) {
  // Sem Date.now() em nome de arquivo seria impossível distinguir duas rodadas.
  const carimbo = new Date().toISOString().replace(/[:.]/g, '-');
  const destino = join(DIR_QUARENTENA, `dipo-tenants-${carimbo}`);
  mkdirSync(destino, { recursive: true });

  for (const t of tenants) {
    const despejo = {
      exportadoEm: new Date().toISOString(),
      tenant: t,
      indicacoes: await prisma.indicacao.findMany({ where: { tenantId: t.id } }),
      templates: await prisma.template.findMany({ where: { tenantId: t.id } }),
      usageLogs: await prisma.usageLog.findMany({ where: { tenantId: t.id } }),
      usuarios: t.users,
    };
    const arq = join(destino, `${t.vereadorSlug || t.id}.json`);
    writeFileSync(arq, JSON.stringify(despejo, null, 2));
    console.log(`💾 ${arq}`);
  }
  console.log(`\nBackup completo em ${destino}\n`);
}

// ───────────────────────────────────────────────────────── exclusão

if (!APAGAR) {
  console.log('Dry-run: nada foi alterado.');
  console.log('Para apagar de verdade:  node scripts/limpar-tenants.mjs --backup --confirmar\n');
  await prisma.$disconnect();
  process.exit(0);
}

console.log('Apagando na ordem exigida pelas chaves estrangeiras…\n');

const usage = await prisma.usageLog.deleteMany({ where: { tenantId: { in: ids } } });
console.log(`  usage logs   -${usage.count}`);

const inds = await prisma.indicacao.deleteMany({ where: { tenantId: { in: ids } } });
console.log(`  indicações   -${inds.count}`);

const tpls = await prisma.template.deleteMany({ where: { tenantId: { in: ids } } });
console.log(`  templates    -${tpls.count}`);

// Admin é desvinculado, não removido — perder o admin trancaria o painel.
const desvinculados = await prisma.user.updateMany({
  where: { tenantId: { in: ids }, isAdmin: true },
  data: { tenantId: null, onboardingComplete: false },
});
if (desvinculados.count) console.log(`  admins       ~${desvinculados.count} desvinculado(s), preservado(s)`);

const users = await prisma.user.deleteMany({ where: { tenantId: { in: ids }, isAdmin: false } });
console.log(`  usuários     -${users.count}`);

const tens = await prisma.tenant.deleteMany({ where: { id: { in: ids } } });
console.log(`  tenants      -${tens.count}`);

console.log('\n✅ Limpeza concluída. O backup em _Quarentena é a única cópia — não apague sem conferir.\n');

await prisma.$disconnect();
