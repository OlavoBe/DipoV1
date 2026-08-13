/**
 * Analisa o corpus coletado pelo coleta-siscam.mjs e emite um relatório em
 * Markdown comparando os gabinetes.
 *
 *   node scripts/analise-corpus.mjs marcio_pet adriana_machado
 *
 * O que interessa aqui é responder, com número em vez de impressão:
 *   - a fórmula da ementa é mesmo rígida? em que percentual?
 *   - o conector varia por gabinete ou por tipo de pedido?
 *   - o enum `tipos_servico` de lib/extract.ts cobre o que a Casa realmente pede?
 *   - Márcio e Adriana escrevem diferente, ou o padrão da Casa achata o estilo?
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const OUT = process.env.CORPUS_DIR || 'E:\\Dipo\\corpus-siscam';
const slugs = process.argv.slice(2);
if (!slugs.length) {
  console.error('uso: node scripts/analise-corpus.mjs <slug> [<slug>…]');
  process.exit(1);
}

const PREFIXO = 'Solicita do Executivo que determine à Secretaria competente, providências';

/** Categorias que o extract.ts conhece hoje, e como reconhecê-las no texto. */
const CATEGORIAS = {
  tapa_buraco: /tapa[- ]buraco|opera(ç|c)(ã|a)o tapa|recapeamento|pavimenta(ç|c)|asfalto|calcetaria|nivelamento de solo|recomposi(ç|c)(ã|a)o do cal(ç|c)amento/i,
  capinacao_rocada: /capina(ç|c)|ro(ç|c)ada|ro(ç|c)agem|poda de (á|a)rvore|poda de (á|a)rvores|supress(ã|a)o de (á|a)rvore/i,
  iluminacao_publica: /ilumina(ç|c)(ã|a)o|bra(ç|c)o de luz|luminária|luminaria|l(â|a)mpada|poste/i,
  drenagem_galerias: /drenagem|galeria|boca de lobo|bocas de lobo|desentupimento|infiltra(ç|c)|esgoto|(á|a)gua pluvial/i,
  limpeza_canal_desassoreamento: /desassoreamento|canal|limpeza de canal|dragagem/i,
  redutor_velocidade: /redutor de velocidade|lombada|quebra[- ]mola|faixa elevada|sem(á|a)foro|sinaliza(ç|c)(ã|a)o (de tr(â|a)nsito|hor)/i,
  retirada_lixo_entulho: /entulho|res(í|i)duo|lixo|descarte irregular|caçamba|ca(ç|c)amba/i,
  fiscalizacao_transito: /fiscaliza(ç|c)|estacionamento irregular|autua|guincho|GCM|Pol(í|i)cia Militar|seguran(ç|c)a/i,
  vulnerabilidade_social: /situa(ç|c)(ã|a)o de rua|vulnerabilidade|abordagem social|assist(ê|e)ncia social|acolhimento/i,
  estudo_tecnico: /estudo t(é|e)cnico|estudo de viabilidade|laudo|vistoria t(é|e)cnica/i,
  // candidatas a novas categorias — hoje caem em "outro"
  '(novo) calcada_acessibilidade': /cal(ç|c)ada|acessibilidade|rampa|guia rebaixada|passeio p(ú|u)blico/i,
  '(novo) praca_area_lazer': /pra(ç|c)a|(á|a)rea de lazer|playground|academia ao ar livre|quadra|parque/i,
  '(novo) manutencao_predial': /reforma|manuten(ç|c)(ã|a)o (predial|na escada|do pr(é|e)dio)|pintura|telhado|muro/i,
  '(novo) transporte_publico': /ponto de (ô|o)nibus|abrigo de (ô|o)nibus|transporte p(ú|u)blico|linha de (ô|o)nibus/i,
  '(novo) saude_educacao': /UBS|posto de sa(ú|u)de|hospital|escola|creche|CRAS|UPA/i,
  '(novo) agua_saneamento': /SABESP|abastecimento de (á|a)gua|saneamento|rede de (á|a)gua/i,
  '(novo) animais': /animai|castra(ç|c)|zoonose|c(ã|a)es|felin/i,
};

const STOP = new Set(('de da do das dos e a o as os em no na nos nas ao à às aos para por com que se um uma uns umas ou ' +
  'seu sua seus suas este esta isso bem como mais entre sobre até desde ser sendo the').split(' '));

function carrega(slug) {
  const arq = join(OUT, slug, 'indicacoes.jsonl');
  if (!existsSync(arq)) throw new Error(`não encontrei ${arq} — rode a coleta primeiro`);
  return readFileSync(arq, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l));
}

const pct = (n, t) => t ? `${((n / t) * 100).toFixed(1)}%` : '—';
const mediana = (a) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
const percentil = (a, p) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length * p)]; };

function analisa(slug) {
  const inds = carrega(slug);
  const r = { slug, total: inds.length, anos: {}, conector: {}, categorias: {}, semCategoria: [], palavras: new Map() };

  let comPrefixo = 0;
  const tamanhos = [];

  for (const i of inds) {
    const e = (i.ementa || '').replace(/\s+/g, ' ').trim();
    r.anos[i.ano] = (r.anos[i.ano] || 0) + 1;
    tamanhos.push(e.length);

    if (e.startsWith(PREFIXO)) comPrefixo++;

    const resto = e.startsWith(PREFIXO) ? e.slice(PREFIXO.length).trim() : e;
    const con = /^visando/i.test(resto) ? 'visando'
      : /^para que (realize|proceda|execute)/i.test(resto) ? 'para que realize'
      : /^no sentido/i.test(resto) ? 'no sentido de'
      : /^objetivando/i.test(resto) ? 'objetivando'
      : '(outro)';
    r.conector[con] = (r.conector[con] || 0) + 1;

    let achou = false;
    for (const [cat, re] of Object.entries(CATEGORIAS)) {
      if (re.test(e)) { r.categorias[cat] = (r.categorias[cat] || 0) + 1; achou = true; }
    }
    if (!achou) r.semCategoria.push(`${i.numero}/${i.ano}: ${e.slice(0, 160)}`);

    for (const p of resto.toLowerCase().replace(/[^a-zà-ú\s]/g, ' ').split(/\s+/)) {
      if (p.length > 3 && !STOP.has(p)) r.palavras.set(p, (r.palavras.get(p) || 0) + 1);
    }
  }

  r.comPrefixo = comPrefixo;
  r.tamMedio = Math.round(tamanhos.reduce((a, b) => a + b, 0) / tamanhos.length);
  r.tamMediana = mediana(tamanhos);
  r.tamP90 = percentil(tamanhos, 0.9);
  r.tamMax = Math.max(...tamanhos);
  r.temNumero = inds.filter((i) => /n(º|o\.?) ?\d+|n(ú|u)mero \d+/i.test(i.ementa || '')).length;
  r.temBairro = inds.filter((i) => /,\s*(jardim|vila|parque|bairro|morrinhos|enseada|astúrias|asturias|tombo|pitangueiras|perequê|pereque|santa cruz|vicente de carvalho)/i.test(i.ementa || '')).length;
  r.comAnexo = inds.filter((i) => i.anexoId).length;
  r.comDocs = inds.filter((i) => i.protocolo !== undefined).length;
  r.topPalavras = [...r.palavras.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25);
  return r;
}

const rs = slugs.map(analisa);

// ------------------------------------------------------------------ relatório

const L = [];
L.push('# Corpus SISCAM — análise comparativa', '');
L.push(`Gerado por \`scripts/analise-corpus.mjs\` a partir de \`${OUT}\`.`, '');

L.push('## Volume', '');
L.push('| Gabinete | Indicações | Anos | Com anexo | Metadados coletados |');
L.push('|---|---:|---|---:|---:|');
for (const r of rs) {
  const anos = Object.keys(r.anos).sort();
  L.push(`| \`${r.slug}\` | ${r.total} | ${anos[0]}–${anos.at(-1)} | ${r.comAnexo} (${pct(r.comAnexo, r.total)}) | ${r.comDocs} |`);
}
L.push('');

L.push('### Distribuição por ano', '');
const anosTodos = [...new Set(rs.flatMap((r) => Object.keys(r.anos)))].sort();
L.push(`| Gabinete | ${anosTodos.join(' | ')} |`);
L.push(`|---|${anosTodos.map(() => '---:').join('|')}|`);
for (const r of rs) L.push(`| \`${r.slug}\` | ${anosTodos.map((a) => r.anos[a] || '—').join(' | ')} |`);
L.push('');

L.push('## Aderência à fórmula da Casa', '');
L.push('Prefixo obrigatório: `' + PREFIXO + '`', '');
L.push('| Gabinete | Com o prefixo exato | Tamanho médio | Mediana | p90 | Máximo |');
L.push('|---|---:|---:|---:|---:|---:|');
for (const r of rs) {
  L.push(`| \`${r.slug}\` | ${r.comPrefixo} (${pct(r.comPrefixo, r.total)}) | ${r.tamMedio} | ${r.tamMediana} | ${r.tamP90} | ${r.tamMax} |`);
}
L.push('');

L.push('### Conector depois de "providências"', '');
const cons = [...new Set(rs.flatMap((r) => Object.keys(r.conector)))];
L.push(`| Gabinete | ${cons.join(' | ')} |`);
L.push(`|---|${cons.map(() => '---:').join('|')}|`);
for (const r of rs) L.push(`| \`${r.slug}\` | ${cons.map((c) => r.conector[c] ? `${r.conector[c]} (${pct(r.conector[c], r.total)})` : '—').join(' | ')} |`);
L.push('');

L.push('### Elementos de localização', '');
L.push('| Gabinete | Cita número (nº) | Cita bairro/logradouro nomeado |');
L.push('|---|---:|---:|');
for (const r of rs) L.push(`| \`${r.slug}\` | ${r.temNumero} (${pct(r.temNumero, r.total)}) | ${r.temBairro} (${pct(r.temBairro, r.total)}) |`);
L.push('');

L.push('## Cobertura do enum `tipos_servico` (lib/extract.ts)', '');
L.push('Uma ementa pode cair em mais de uma categoria. As marcadas `(novo)` **não existem**');
L.push('no enum atual — hoje o extractor as classifica como `outro`.', '');
const cats = [...new Set(rs.flatMap((r) => Object.keys(r.categorias)))]
  .sort((a, b) => rs.reduce((s, r) => s + (r.categorias[b] || 0), 0) - rs.reduce((s, r) => s + (r.categorias[a] || 0), 0));
L.push(`| Categoria | ${rs.map((r) => r.slug).join(' | ')} |`);
L.push(`|---|${rs.map(() => '---:').join('|')}|`);
for (const c of cats) L.push(`| \`${c}\` | ${rs.map((r) => r.categorias[c] ? `${r.categorias[c]} (${pct(r.categorias[c], r.total)})` : '—').join(' | ')} |`);
L.push('');
for (const r of rs) {
  L.push(`Sem nenhuma categoria em \`${r.slug}\`: **${r.semCategoria.length}** (${pct(r.semCategoria.length, r.total)})`);
}
L.push('');

L.push('## Vocabulário — 25 termos mais frequentes depois do conector', '');
L.push(`| # | ${rs.map((r) => r.slug).join(' | ')} |`);
L.push(`|---:|${rs.map(() => '---').join('|')}|`);
for (let i = 0; i < 25; i++) {
  L.push(`| ${i + 1} | ${rs.map((r) => r.topPalavras[i] ? `${r.topPalavras[i][0]} (${r.topPalavras[i][1]})` : '—').join(' | ')} |`);
}
L.push('');

for (const r of rs) {
  if (!r.semCategoria.length) continue;
  L.push(`## Amostra do que hoje vira \`outro\` — \`${r.slug}\``, '');
  for (const s of r.semCategoria.slice(0, 20)) L.push(`- ${s}`);
  L.push('');
}

const destino = join(OUT, 'analise-comparativa.md');
writeFileSync(destino, L.join('\n'));
console.log(L.join('\n'));
console.log(`\n→ ${destino}`);
