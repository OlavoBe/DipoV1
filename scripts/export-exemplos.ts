/**
 * Exporta indicações com feedback positivo como exemplos few-shot.
 *
 * Uso: npx tsx scripts/export-exemplos.ts [--min-feedback N]
 *
 * O que faz:
 *   1. Busca todas as indicações com feedback = 1 (positivo)
 *   2. Extrai: categoria, tipos_servico, descricao (do inputRaw), texto_gerado
 *   3. Salva em data/indicacoes_exemplo/<categoria>_<id>.json
 *   4. Esses arquivos são usados automaticamente como few-shot em generate.ts
 *
 * Execute periodicamente (ex: semanal) para manter os exemplos atualizados.
 */

import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

interface ExemploJson {
  categoria: string;
  tipos_servico: string[];
  descricao: string;
  texto_gerado: string;
}

async function main() {
  const dir = path.join(process.cwd(), 'data', 'indicacoes_exemplo');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  console.log('🔍 Buscando indicações com feedback positivo...');

  const indicacoes = await prisma.indicacao.findMany({
    where: { feedback: 1 },
    orderBy: { feedbackEm: 'desc' },
    select: {
      id: true,
      inputRaw: true,
      extractedJson: true,
      textoFinal: true,
      tipoServico: true,
      createdAt: true,
    },
  });

  console.log(`✅ ${indicacoes.length} indicações encontradas com feedback positivo`);

  let exportadas = 0;
  let ignoradas = 0;

  for (const ind of indicacoes) {
    let extracted: Record<string, unknown> = {};
    try {
      extracted = JSON.parse(ind.extractedJson);
    } catch {
      console.warn(`  ⚠️  extractedJson inválido para ${ind.id} — ignorando`);
      ignoradas++;
      continue;
    }

    const categoria = (extracted.categoria as string) || 'outros';
    const tiposServico = Array.isArray(extracted.tipos_servico)
      ? (extracted.tipos_servico as string[])
      : [];

    // Usa o tema extraído como descrição, senão a primeira linha do inputRaw
    const tema = (extracted.tema as string)?.trim() || '';
    const descricao = tema || ind.inputRaw.split('\n')[0].trim().slice(0, 150);

    const exemplo: ExemploJson = {
      categoria,
      tipos_servico: tiposServico,
      descricao,
      texto_gerado: ind.textoFinal,
    };

    // Nome do arquivo: categoria + primeiros 8 chars do id
    const filename = `${categoria}_${ind.id.slice(0, 8)}.json`;
    const filepath = path.join(dir, filename);

    fs.writeFileSync(filepath, JSON.stringify(exemplo, null, 2), 'utf-8');
    console.log(`  📄 ${filename} (${categoria})`);
    exportadas++;
  }

  console.log(`\n📦 Resultado:`);
  console.log(`   Exportadas: ${exportadas}`);
  console.log(`   Ignoradas:  ${ignoradas}`);
  console.log(`   Destino:    ${dir}`);
  console.log(`\n💡 Os arquivos serão usados automaticamente no próximo deploy.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
