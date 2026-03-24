/**
 * Exporta pares (input → output) aceitos pelo usuário no formato JSONL
 * pronto para fine-tuning via API da OpenAI (gpt-4o-mini, gpt-3.5-turbo).
 *
 * Uso:
 *   npx tsx scripts/export-finetuning.ts
 *   npx tsx scripts/export-finetuning.ts --only-positive   (padrão: também inclui sem feedback)
 *   npx tsx scripts/export-finetuning.ts --min N           (mínimo N chars no textoFinal)
 *
 * Saída: finetuning_<timestamp>.jsonl em data/finetuning/
 *
 * Formato OpenAI fine-tuning (chat):
 *   {"messages": [
 *     {"role": "system",    "content": "<system prompt>"},
 *     {"role": "user",      "content": "<inputRaw>"},
 *     {"role": "assistant", "content": "<textoFinal aceito>"}
 *   ]}
 *
 * Referência: https://platform.openai.com/docs/guides/fine-tuning
 */

import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

const SYSTEM_PROMPT = `Você é um redator especializado em indicações legislativas para a Câmara Municipal de Guarujá/SP.

REGRAS ABSOLUTAS:
- Nunca use emojis
- Nunca use opinião pessoal
- Linguagem formal legislativa
- Texto enxuto — máximo 500 palavras
- Sempre mencionar o prefeito quando aplicável
- Nunca inclua nome ou assinatura do vereador no texto final
- Retorne APENAS o texto final da indicação, sem comentários adicionais

ESTRUTURA OBRIGATÓRIA:
SENHOR PRESIDENTE,
SENHORAS VEREADORAS,
SENHORES VEREADORES;

[Justificativa objetiva com endereço completo e descrição do problema]

INDICAÇÃO Nº ____ /[ANO]

Indico à Mesa, nos termos regimentais, que seja oficiado ao Excelentíssimo Senhor Prefeito Municipal de Guarujá, [nome do prefeito], para que determine ao setor competente:

[Lista numerada das providências]

[Local], [data por extenso].`;

interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface OpenAIExample {
  messages: OpenAIMessage[];
}

async function main() {
  const args = process.argv.slice(2);
  const onlyPositive = args.includes('--only-positive');
  const minIdx = args.indexOf('--min');
  const minChars = minIdx >= 0 ? parseInt(args[minIdx + 1] ?? '200') : 200;

  const outDir = path.join(process.cwd(), 'data', 'finetuning');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  console.log('🔍 Buscando indicações para fine-tuning...');
  console.log(`   Modo: ${onlyPositive ? 'apenas feedback positivo' : 'feedback positivo + sem feedback'}`);
  console.log(`   Mínimo de caracteres no texto: ${minChars}`);

  const where = onlyPositive
    ? { feedback: 1 as number }
    : undefined; // sem filtro = todos (feedback 1, -1 e null)

  const indicacoes = await prisma.indicacao.findMany({
    where: where ? { feedback: where.feedback } : { feedback: { not: -1 } },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      inputRaw: true,
      textoFinal: true,
      feedback: true,
      createdAt: true,
    },
  });

  console.log(`✅ ${indicacoes.length} indicações encontradas`);

  const exemplos: OpenAIExample[] = [];

  for (const ind of indicacoes) {
    // Filtra textos muito curtos (provavelmente incompletos ou com erro)
    if (ind.textoFinal.length < minChars) continue;
    // Filtra inputs muito curtos
    if (ind.inputRaw.trim().length < 20) continue;

    exemplos.push({
      messages: [
        { role: 'system',    content: SYSTEM_PROMPT },
        { role: 'user',      content: ind.inputRaw.trim() },
        { role: 'assistant', content: ind.textoFinal.trim() },
      ],
    });
  }

  if (exemplos.length === 0) {
    console.log('\n⚠️  Nenhum exemplo válido encontrado. Gere e avalie indicações primeiro.');
    return;
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const filename = `finetuning_${timestamp}.jsonl`;
  const filepath = path.join(outDir, filename);

  const jsonl = exemplos.map(e => JSON.stringify(e)).join('\n');
  fs.writeFileSync(filepath, jsonl, 'utf-8');

  // Estatísticas
  const positivoCount = indicacoes.filter(i => i.feedback === 1).length;
  const semFeedbackCount = indicacoes.filter(i => i.feedback === null).length;

  console.log(`\n📦 Resultado:`);
  console.log(`   Total de exemplos: ${exemplos.length}`);
  console.log(`   Com feedback positivo: ${positivoCount}`);
  console.log(`   Sem feedback (neutro): ${semFeedbackCount}`);
  console.log(`   Arquivo: ${filepath}`);
  console.log(`\n🚀 Para enviar para fine-tuning (OpenAI):`);
  console.log(`   openai api fine_tuning.jobs.create \\`);
  console.log(`     --training-file ${filepath} \\`);
  console.log(`     --model gpt-4o-mini`);
  console.log(`\n💡 Recomendação:`);
  console.log(`   - Mínimo 10 exemplos para fine-tuning básico`);
  console.log(`   - Mínimo 100 exemplos para resultados consistentes`);
  console.log(`   - Use --only-positive para dados de maior qualidade`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
