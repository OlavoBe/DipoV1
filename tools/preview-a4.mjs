/**
 * Renderiza um HTML de layout como folha A4, simulando o que o PDF faz:
 * aplica as margens declaradas na @page e RECORTA o que ultrapassa a area
 * imprimivel. Sem o recorte o preview mente — foi assim que um brasao
 * posicionado fora da margem passou despercebido.
 *
 * Uso: node tools/preview-a4.mjs entrada.html saida.png
 */
import { createRequire } from 'module';
import { readFileSync } from 'fs';
const require = createRequire('C:/Dipo/DipoV1/package.json');
const { chromium } = require('playwright');

const [, , htmlPath, out] = process.argv;

const b = await chromium.launch({ headless: true });
const p = await b.newPage({ viewportSize: { width: 900, height: 1250 }, deviceScaleFactor: 2 });
await p.setContent(readFileSync(htmlPath, 'utf8'), { waitUntil: 'networkidle' });
await p.evaluate(() => document.fonts.ready);

const margens = await p.evaluate(() => {
  for (const folha of Array.from(document.styleSheets)) {
    let regras;
    try { regras = Array.from(folha.cssRules); } catch { continue; }
    for (const r of regras) {
      const txt = r.cssText || '';
      if (/@page/.test(txt)) {
        const m = txt.match(/margin:\s*([^;]+);/);
        if (m) return m[1].trim();
      }
    }
  }
  return null;
});

// A folha vai no <html> para nao sobrescrever o padding que o proprio layout
// aplica no <body> — senao o preview mostra o conteudo 7mm mais a esquerda
// do que ele realmente sai no papel.
await p.addStyleTag({ content:
  'html {' +
  '  width:210mm; min-height:297mm; background:#fff; margin:12px auto;' +
  '  box-shadow:0 0 0 1px #333;' +
  '  padding:' + (margens || '13mm 24.7mm 25.4mm') + ';' +
  '  overflow:hidden;' +
  '}' +
  'body { min-height:0; }',
});
await p.waitForTimeout(300);

const info = await p.evaluate(() => {
  const d = document.createElement('div');
  d.style.height = '297mm';
  document.body.appendChild(d);
  const a4 = d.offsetHeight;
  d.remove();
  const folha = document.documentElement.getBoundingClientRect();
  const br = document.querySelector('.brasao');
  const cx = br ? br.getBoundingClientRect() : null;
  return {
    altura: document.body.scrollHeight,
    a4,
    brasaoRelFolha: cx ? Math.round(cx.left - folha.left) : null,
    brasaoLarg: cx ? Math.round(cx.width) : null,
  };
});

await p.screenshot({ path: out, fullPage: true });
console.log('shot:', out);
console.log('@page margin:', margens);
console.log(`conteudo ${info.altura}px / A4 ${info.a4}px -> ${info.altura <= info.a4 ? 'CABE' : 'PASSA'} em 1 pagina`);
if (info.brasaoRelFolha !== null) {
  const mm = (info.brasaoRelFolha / (info.a4 / 297)).toFixed(1);
  console.log(`brasao: ${mm}mm da borda esquerda, ${info.brasaoLarg}px de largura -> ` +
    (info.brasaoRelFolha >= 0 ? 'inteiro' : 'CORTADO'));
}
await b.close();
