/**
 * Coleta o corpus de indicações do SISCAM (guaruja.siscam.com.br).
 *
 * Node puro, sem dependências — roda antes de qualquer `npm install`:
 *
 *   node scripts/coleta-siscam.mjs --vereador=13878 --slug=marcio_pet
 *   node scripts/coleta-siscam.mjs --vereador=13878 --slug=marcio_pet --docs --anexos
 *
 * Três fases, independentes e retomáveis (cada uma pula o que já baixou):
 *
 *   1. lista   — 1 request. A página /Vereadores/Proposituras/{id} já traz
 *                número, ano, data e a EMENTA completa em texto de todas as
 *                indicações. É de onde sai o corpus de ementas.
 *   2. --docs  — 1 request por indicação. A página do documento acrescenta
 *                protocolo, situação e o id do arquivo anexo.
 *   3. --anexos— baixa o PDF anexo. São digitalizações (CCITTFaxDecode, ~200
 *                DPI, sem camada de texto): o corpo do texto só sai de OCR.
 *
 * Saída (padrão E:, disco de estoque — são centenas de MB de PDF):
 *
 *   <out>/<slug>/indicacoes.jsonl   uma indicação por linha
 *   <out>/<slug>/indicacoes.csv     mesma coisa, para abrir no Excel
 *   <out>/<slug>/anexos/<numero>-<ano>.pdf
 *
 * É um serviço público de uma câmara municipal, não uma API: há intervalo
 * entre requisições (--delay, padrão 300ms) e o script é sequencial de
 * propósito. As páginas de documento carregam hCaptcha; até aqui nenhum
 * desafio foi exigido para leitura, mas se passar a exigir, a coleta para.
 */
import { writeFileSync, appendFileSync, mkdirSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const BASE = 'https://guaruja.siscam.com.br';
const UA = 'Dipo/1.0 (coleta de indicacoes publicas; contato: olavobernardo@gmail.com)';

// ---------------------------------------------------------------- argumentos

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v === undefined ? true : v];
  })
);

const VEREADOR = args.vereador;
const SLUG = args.slug || `vereador_${VEREADOR}`;
const OUT = args.out || 'E:\\Dipo\\corpus-siscam';
const DELAY = Number(args.delay || 300);
const LIMITE = args.limite ? Number(args.limite) : Infinity;

if (!VEREADOR) {
  console.error('uso: node scripts/coleta-siscam.mjs --vereador=<id> --slug=<slug> [--docs] [--anexos] [--limite=N] [--delay=300] [--out=DIR]');
  process.exit(1);
}

const dir = join(OUT, SLUG);
const dirAnexos = join(dir, 'anexos');
const arqJsonl = join(dir, 'indicacoes.jsonl');
const arqCsv = join(dir, 'indicacoes.csv');
mkdirSync(dirAnexos, { recursive: true });

// -------------------------------------------------------------------- utils

const dorme = (ms) => new Promise((r) => setTimeout(r, ms));

/** O HTML do SISCAM usa entidades numéricas para todo acento. */
function decode(s) {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'");
}

const limpa = (s) => decode(s).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

async function pega(url, { binario = false, tentativas = 3 } = {}) {
  for (let i = 1; i <= tentativas; i++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': UA }, redirect: 'follow' });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return binario ? Buffer.from(await r.arrayBuffer()) : await r.text();
    } catch (e) {
      if (i === tentativas) throw e;
      console.warn(`  ! ${url} falhou (${e.message}); tentativa ${i + 1}/${tentativas}`);
      await dorme(DELAY * 4 * i);
    }
  }
}

function csvEscape(v) {
  const s = String(v ?? '');
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// --------------------------------------------------------------- fase 1: lista

/**
 * Cada indicação vem como:
 *   <a href="/Documentos/Documento/242923" ... title="Indicação Nº 9801/2026">…</a>
 *   - 09/06/2026 - Solicita do Executivo que determine à Secretaria competente, …
 */
function parseLista(html) {
  const re = /<a href="\/Documentos\/Documento\/(\d+)"[^>]*title="Indica(?:&#231;|ç)(?:&#227;|ã)o N(?:&#186;|º) (\d+)\/(\d{4})"[^>]*>[\s\S]*?<\/a>\s*-\s*(\d{2}\/\d{2}\/\d{4})\s*-\s*([\s\S]*?)<\/p>/g;
  const out = [];
  let m;
  while ((m = re.exec(html))) {
    const [, docId, numero, ano, data, ementaRaw] = m;
    out.push({
      docId: Number(docId),
      numero: Number(numero),
      ano: Number(ano),
      data,
      ementa: limpa(ementaRaw),
    });
  }
  return out;
}

// ---------------------------------------------------- fase 2: página do documento

function parseDocumento(html) {
  const campo = (rotulo) => {
    const m = html.match(new RegExp(`${rotulo}:\\s*<\\/[^>]+>?\\s*([^<]*)`, 'i'))
      || html.match(new RegExp(`${rotulo}:([^<]*)`, 'i'));
    return m ? limpa(m[1]) : null;
  };
  const anexo = html.match(/\/arquivo\?Id=(\d+)/);
  return {
    protocolo: campo('Protocolo'),
    situacao: campo('Situa(?:&#231;|ç)(?:&#227;|ã)o'),
    anexoId: anexo ? Number(anexo[1]) : null,
  };
}

// --------------------------------------------------------------------- main

const jaColetado = existsSync(arqJsonl)
  ? readFileSync(arqJsonl, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l))
  : [];

let indicacoes;

if (jaColetado.length && !args.refazer) {
  indicacoes = jaColetado;
  console.log(`fase 1: ${indicacoes.length} indicações já em ${arqJsonl} (use --refazer para rebaixar)`);
} else {
  console.log(`fase 1: baixando a lista de proposituras do vereador ${VEREADOR}…`);
  const html = await pega(`${BASE}/Vereadores/Proposituras/${VEREADOR}`);
  indicacoes = parseLista(html);
  writeFileSync(arqJsonl, indicacoes.map((i) => JSON.stringify(i)).join('\n') + '\n');
  console.log(`fase 1: ${indicacoes.length} indicações → ${arqJsonl}`);

  const porAno = {};
  for (const i of indicacoes) porAno[i.ano] = (porAno[i.ano] || 0) + 1;
  console.log('        por ano:', porAno);
}

if (args.docs) {
  const pendentes = indicacoes.filter((i) => i.protocolo === undefined).slice(0, LIMITE);
  console.log(`fase 2: ${pendentes.length} páginas de documento a consultar (${DELAY}ms entre elas)…`);
  let n = 0;
  for (const ind of pendentes) {
    try {
      const html = await pega(`${BASE}/Documentos/Documento/${ind.docId}`);
      Object.assign(ind, parseDocumento(html));
    } catch (e) {
      ind.erro = e.message;
    }
    if (++n % 50 === 0) {
      console.log(`        ${n}/${pendentes.length}`);
      writeFileSync(arqJsonl, indicacoes.map((i) => JSON.stringify(i)).join('\n') + '\n');
    }
    await dorme(DELAY);
  }
  writeFileSync(arqJsonl, indicacoes.map((i) => JSON.stringify(i)).join('\n') + '\n');
  const comAnexo = indicacoes.filter((i) => i.anexoId).length;
  console.log(`fase 2: pronto — ${comAnexo}/${indicacoes.length} têm arquivo anexo`);
}

if (args.anexos) {
  const comAnexo = indicacoes.filter((i) => i.anexoId);
  console.log(`fase 3: ${comAnexo.length} PDFs a baixar…`);
  let n = 0, baixados = 0, pulados = 0;
  for (const ind of comAnexo) {
    const destino = join(dirAnexos, `${ind.numero}-${ind.ano}.pdf`);
    if (existsSync(destino)) { pulados++; }
    else {
      try {
        const buf = await pega(`${BASE}/arquivo?Id=${ind.anexoId}`, { binario: true });
        writeFileSync(destino, buf);
        ind.arquivo = destino;
        ind.bytes = buf.length;
        baixados++;
      } catch (e) {
        ind.erroAnexo = e.message;
      }
      await dorme(DELAY);
    }
    if (++n % 50 === 0) console.log(`        ${n}/${comAnexo.length} (${baixados} baixados, ${pulados} já existiam)`);
  }
  writeFileSync(arqJsonl, indicacoes.map((i) => JSON.stringify(i)).join('\n') + '\n');
  console.log(`fase 3: pronto — ${baixados} baixados, ${pulados} já existiam`);
}

// CSV para inspeção manual (separador ';' — Excel pt-BR)
const colunas = ['numero', 'ano', 'data', 'protocolo', 'situacao', 'docId', 'anexoId', 'ementa'];
writeFileSync(
  arqCsv,
  '\uFEFF' + colunas.join(';') + '\n' +
    indicacoes.map((i) => colunas.map((c) => csvEscape(i[c])).join(';')).join('\n') + '\n'
);
console.log(`csv: ${arqCsv}`);
