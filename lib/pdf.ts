import { getTemplate, type TemplateSettings } from './template';
import { buildFontFaceCss, STACK_CORPO, STACK_CABECALHO } from './fonts';
import { getLayout } from './layouts';
import { parseTextoToDoc } from './doc-parser';
import type { Browser, BrowserContext } from 'playwright-core';

/**
 * Traduz a fonte configurada no template para uma pilha que prioriza a fonte
 * embarcada equivalente.
 *
 * Os templates guardam nomes de fontes do Windows ("Times New Roman",
 * "Bookman Old Style"), que não existem no Linux do ambiente serverless. Em vez
 * de reescrever os templates, mapeamos para a substituta livre correspondente e
 * mantemos o nome original como fallback — em dev local no Windows, a fonte
 * original continua sendo usada.
 */
function resolverStack(fontFamily: string): string {
  const f = fontFamily.toLowerCase();
  if (f.includes('bookman')) return STACK_CORPO;
  if (f.includes('times')) return STACK_CABECALHO;
  return fontFamily; // configuração customizada: respeita como está
}

// ─────────────────────────────────────────────
// Lança o browser correto por ambiente:
// • Vercel/produção → @sparticuz/chromium (serverless-safe)
// • Dev local       → playwright nativo (binário local)
// ─────────────────────────────────────────────

/**
 * Pack usado como reserva quando o binário embarcado não está disponível.
 *
 * A URL que estava fixada no código apontava para `v143.0.0` e sem sufixo de
 * arquitetura — dois erros: a versão instalada é 143.0.4, e os assets passaram
 * a ser publicados por arquitetura (`.x64` / `.arm64`). O download devolvia 404
 * e a geração de PDF quebrava em produção com "Unexpected status code: 404".
 */
const PACK_CHROMIUM_RESERVA =
  'https://github.com/Sparticuz/chromium/releases/download/v143.0.4/chromium-v143.0.4-pack.x64.tar';

export type OrigemChromium =
  | 'configurado'
  | 'embarcado'
  | 'pack-remoto'
  | 'playwright-local';

let origemChromium: OrigemChromium | null = null;

/**
 * De onde saiu o binário do Chromium nesta instância — `null` enquanto nenhum
 * browser foi lançado.
 *
 * `embarcado` é o único caminho saudável em produção: o binário veio dentro do
 * bundle da função. `pack-remoto` significa que o rastreamento de dependências
 * falhou e cada cold start está baixando 66MB de um domínio de terceiro — foi o
 * estado real da produção até o glob do `outputFileTracingIncludes` ser
 * corrigido, e é o que o smoke test pós-deploy vigia.
 */
export function getOrigemChromium(): OrigemChromium | null {
  return origemChromium;
}

/**
 * Resolve o executável do Chromium no ambiente serverless.
 *
 * Ordem: `CHROMIUM_EXECUTABLE_PATH` → binário embarcado no bundle → pack remoto.
 *
 * O `@sparticuz/chromium` traz o navegador em `bin/*.br`, arquivos que nenhum
 * `import` alcança. Quem os coloca no bundle é o `outputFileTracingIncludes` do
 * `next.config.js`; sem ele a função sobe sem o binário e o launch falha com
 * "The input directory .../bin does not exist".
 *
 * O download é só rede de segurança. Se ele disparar, o rastreamento quebrou e
 * cada cold start passa a pagar 66MB num domínio de terceiro.
 */
async function resolverChromium(
  chromium: { executablePath: (caminho?: string) => Promise<string> },
): Promise<string> {
  const configurado = process.env.CHROMIUM_EXECUTABLE_PATH;
  if (configurado) {
    origemChromium = 'configurado';
    return chromium.executablePath(configurado);
  }

  try {
    const caminho = await chromium.executablePath();
    origemChromium = 'embarcado';
    return caminho;
  } catch (err) {
    // `error` e não `warn`: o download nunca deveria acontecer, e como aviso
    // ele se escondeu entre os logs normais da produção.
    console.error(
      '[pdf] binário do Chromium não veio no bundle, baixando o pack remoto ' +
        '(66MB a cada cold start) — confira o outputFileTracingIncludes:',
      err instanceof Error ? err.message : err,
    );
    origemChromium = 'pack-remoto';
    return chromium.executablePath(PACK_CHROMIUM_RESERVA);
  }
}

async function launchBrowser(): Promise<Browser> {
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    const chromium = (await import('@sparticuz/chromium')).default;
    const { chromium: pw } = await import('playwright-core');

    const executablePath = await resolverChromium(chromium);
    return pw.launch({
      args: [...chromium.args, '--font-render-hinting=none'],
      executablePath,
      headless: true,
    });
  }
  // Em dev/testes o playwright completo é devDependency; import dinâmico para
  // que o bundle de produção nunca tente resolvê-lo.
  origemChromium = 'playwright-local';
  const { chromium: pw } = await import('playwright');
  // PDF_SIMULA_SERVERLESS=1 liga localmente as flags de processo que o
  // @sparticuz/chromium usa em produção — sem elas, a máquina local não
  // reproduz a queda do browser descrita em getContexto().
  const simulaServerless = process.env.PDF_SIMULA_SERVERLESS === '1'
    ? ['--single-process', '--no-zygote']
    : [];
  return pw.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--font-render-hinting=none', ...simulaServerless],
  });
}

// ─────────────────────────────────────────────
// Browser e contexto reaproveitados entre invocações da mesma instância quente.
// O cold start paga o launch uma vez; as gerações seguintes reusam.
// Em erro, descarta a instância para não herdar um browser quebrado.
// ─────────────────────────────────────────────

type Sessao = { browser: Browser; contexto: BrowserContext };

let sessaoPromise: Promise<Sessao> | null = null;

async function abrirSessao(): Promise<Sessao> {
  const browser = await launchBrowser();
  return { browser, contexto: await browser.newContext() };
}

/**
 * Contexto único onde todas as páginas são abertas.
 *
 * O `@sparticuz/chromium` roda com `--single-process`, e nesse modo descartar
 * um contexto derruba o browser inteiro. `browser.newPage()` cria um contexto
 * novo por página e o fecha junto com ela — então o primeiro PDF de cada
 * browser saía e o browser morria no `page.close()`. A geração seguinte
 * naquela instância quebrava com "Target page, context or browser has been
 * closed", no `newPage()` ou, se a queda ainda não tinha terminado, no
 * `setContent()`.
 *
 * Reproduzido com PDF_SIMULA_SERVERLESS=1: com `browser.newPage()`, 1 de 9
 * gerações passa; com um contexto fixo, 9 de 9, incluindo 3 simultâneas.
 */
async function getContexto(): Promise<BrowserContext> {
  if (sessaoPromise) {
    try {
      const s = await sessaoPromise;
      if (s.browser.isConnected()) return s.contexto;
    } catch {
      // cai no relaunch abaixo
    }
  }
  sessaoPromise = abrirSessao();
  return (await sessaoPromise).contexto;
}

/**
 * Abre uma página, relançando o browser quando o reaproveitado está morto.
 *
 * `isConnected()` mente: devolve `true` para um browser que já não aceita
 * `newPage()`. Medido em produção — metade das requisições voltava com
 * "Target page, context or browser has been closed", sempre alternando entre as
 * instâncias quentes. O `newPage()` ficava fora do `try`, então o browser morto
 * nunca era descartado e aquela instância respondia 500 até a Vercel reciclá-la.
 *
 * Quem decide é o `newPage()`, não o `isConnected()`. As dependências entram por
 * parâmetro para que a política de retentativa possa ser testada sem browser.
 */
export async function abrirPaginaResiliente<P>(
  obterBrowser: () => Promise<{ newPage: () => Promise<P> }>,
  descartar: () => void,
): Promise<P> {
  try {
    return await (await obterBrowser()).newPage();
  } catch (err) {
    // Cache podre: descarta e tenta uma vez com um browser novo, em vez de
    // devolver 500 para o assessor.
    descartar();
    console.warn(
      '[pdf] browser reaproveitado não abriu página, relançando:',
      err instanceof Error ? err.message : err,
    );

    try {
      return await (await obterBrowser()).newPage();
    } catch (erroComBrowserNovo) {
      // Falhou até com um browser recém-lançado — não deixa o novo em cache.
      descartar();
      throw erroComBrowserNovo;
    }
  }
}

function descartarBrowser(): void {
  const p = sessaoPromise;
  sessaoPromise = null;
  void p?.then((s) => s.browser.close()).catch(() => {});
}

/** Erro do Playwright quando o browser (ou a página) caiu no meio do uso. */
export function browserCaiu(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /has been closed|Target closed|Browser closed|crashed/i.test(msg);
}

// ─────────────────────────────────────────────
// Helpers de texto
// ─────────────────────────────────────────────

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function textToHtml(text: string): string {
  const escaped = escapeHtml(text);
  return escaped
    .split(/\n{2,}/)
    .map((block) => `<p>${block.replace(/\n/g, '<br>')}</p>`)
    .join('\n');
}

// ─────────────────────────────────────────────
// Template HTML — alimentado pelo TemplateSettings
// ─────────────────────────────────────────────

function buildHtml(textoFinal: string, t: TemplateSettings, fontSize: number, demo = false): string {
  const htmlContent = textToHtml(textoFinal);
  const r = Math.round;

  const ls = (base: number, pct?: number) => Math.round(base * ((pct ?? 100) / 100));

  const logoLeftTag = t.logos.left
    ? `<img src="${t.logos.left}" style="max-height:${ls(74,t.logos.leftSize)}px;max-width:${ls(78,t.logos.leftSize)}px;object-fit:contain">`
    : '';

  const logoRightTag = t.logos.right
    ? `<img src="${t.logos.right}" style="max-height:${ls(74,t.logos.rightSize)}px;max-width:${ls(78,t.logos.rightSize)}px;object-fit:contain">`
    : '';

  const partidoSrc = t.logos.partido || t.logos.right;
  const partidoTag = partidoSrc
    ? `<div style="text-align:center;margin-top:8px"><img src="${partidoSrc}" style="max-height:${ls(38,t.logos.partidoSize)}px;max-width:${ls(110,t.logos.partidoSize)}px;object-fit:contain"></div>`
    : '';

  const signatureTag = t.logos.signature
    ? `<img src="${t.logos.signature}" style="max-height:${ls(60,t.logos.signatureSize)}px;object-fit:contain;display:block;margin:0 auto 4px auto">`
    : '';

  const watermarkTag = t.logos.watermark
    ? `<div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);pointer-events:none;opacity:${t.logos.watermarkOpacity / 100};z-index:0"><img src="${t.logos.watermark}" style="max-height:400px;max-width:400px;object-fit:contain"></div>`
    : '';

  const demoWatermarkTag = demo
    ? `<div style="position:fixed;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-45deg);font-size:64pt;font-weight:bold;color:rgba(0,0,0,0.06);white-space:nowrap;pointer-events:none;z-index:999;letter-spacing:6pt;text-transform:uppercase;font-family:sans-serif">DEMONSTRAÇÃO</div>`
    : '';

  const demoFooterTag = demo
    ? `<div style="position:fixed;bottom:8mm;left:0;right:0;text-align:center;font-size:8pt;color:#999;font-family:sans-serif">Gerado com Dipo · dipo.com.br</div>`
    : '';

  const mLat = t.layout.marginLateral + 'mm';
  const mTb  = t.layout.marginTopBottom + 'mm';
  const font = resolverStack(t.typography.fontFamily);
  const fontCabecalho = resolverStack(t.typography.fontFamilyCabecalho ?? t.typography.fontFamily);
  const txtColor = t.colors.text;
  const hdrColor = t.colors.header;
  const bgColor  = t.colors.background;
  const divColor = t.colors.divider;
  const divW     = t.colors.dividerWidth;
  const lh       = t.typography.lineHeight;
  const pSpace   = t.typography.paragraphSpacing;
  const indent   = t.typography.paragraphIndent;
  const justify  = t.typography.textJustified ? 'justify' : 'left';
  const leftBorder = t.colors.leftBorder
    ? `border-left: 4px solid ${t.colors.leftBorderColor};`
    : '';
  const footerLine = t.colors.footerLine
    ? `<hr style="border:none;border-top:1px solid ${txtColor};margin:20px 0 6px 0">`
    : '';

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>${demo ? 'Indicação Legislativa (Demo)' : 'Indicação Legislativa'}</title>
  <style>
${buildFontFaceCss()}
    @page { size: A4; margin: ${mTb} ${mLat} ${mTb} ${mLat}; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: ${font};
      font-size: ${fontSize}pt;
      line-height: ${lh};
      color: ${txtColor};
      background: ${bgColor};
    }
    .page { position: relative; ${leftBorder} }
    .header {
      display: flex;
      align-items: flex-start;
      gap: 12pt;
      padding-bottom: 8pt;
      border-bottom: ${divW}px solid ${divColor};
      margin-bottom: 14pt;
      color: ${hdrColor};
      font-family: ${fontCabecalho};
    }
    .header-logo { flex-shrink: 0; display: flex; align-items: center; }
    .header-info { flex: 1; text-align: center; }
    .inst-nome { font-size: ${r(fontSize * 1.15)}pt; font-weight: bold; text-transform: uppercase; letter-spacing: .3pt; }
    .inst-estado { font-size: ${r(fontSize * 0.82)}pt; text-transform: uppercase; margin-top: 1pt; }
    .ver-nome { font-size: ${r(fontSize * 1.05)}pt; margin-top: 5pt; }
    .ver-gab { font-size: ${r(fontSize * 0.80)}pt; margin-top: 1pt; }
    .ver-email { font-size: ${r(fontSize * 0.80)}pt; margin-top: 1pt; color: #444; }
    .conteudo p {
      margin-bottom: ${pSpace}pt;
      text-align: ${justify};
      text-indent: ${indent}mm;
      hyphens: auto;
    }
    .assinatura { margin-top: 24pt; text-align: center; }
    .assinatura .nome {
      font-weight: bold; text-transform: uppercase;
      border-top: 1px solid ${txtColor};
      display: inline-block; padding-top: 6pt; min-width: 200pt;
    }
    .assinatura .cargo { font-size: ${r(fontSize * 0.9)}pt; margin-top: 2pt; }
  </style>
</head>
<body>
  <div class="page">
    ${watermarkTag}
    ${demoWatermarkTag}
    ${demoFooterTag}
    <div class="header">
      <div class="header-logo">${logoLeftTag}</div>
      <div class="header-info">
        <div class="inst-nome">${escapeHtml(t.institution.name)}</div>
        <div class="inst-estado">${escapeHtml(t.institution.title)}</div>
        <div class="ver-nome">${escapeHtml(t.institution.subtitle)}</div>
        <div class="ver-gab">${escapeHtml(t.institution.gabinete)}</div>
        <div class="ver-email">${escapeHtml(t.institution.email)}</div>
      </div>
      <div class="header-logo">${logoRightTag}</div>
    </div>
    <div class="conteudo">
      ${htmlContent}
    </div>
    ${footerLine}
    ${partidoTag}
  </div>
</body>
</html>`;
}

// ─────────────────────────────────────────────
// Geração do PDF
// ─────────────────────────────────────────────

type TemplateResolvido = ReturnType<typeof getTemplate> extends Promise<infer R> ? R : never;

/**
 * Gera o PDF e, se o browser cair no meio da renderização, tenta uma vez com um
 * browser novo. O `abrirPaginaResiliente` só cobre a queda no `newPage()`; um
 * browser que ainda aceita abrir página pode morrer no `setContent()`, e sem
 * esta segunda chance o assessor recebia o erro cru na tela.
 */
async function generatePdfInternal(textoFinal: string, t: TemplateResolvido, demo: boolean): Promise<Buffer> {
  try {
    return await renderizarPdf(textoFinal, t, demo);
  } catch (err) {
    if (!browserCaiu(err)) throw err;
    console.warn(
      '[pdf] browser caiu durante a renderização, tentando com um novo:',
      err instanceof Error ? err.message : err,
    );
    return renderizarPdf(textoFinal, t, demo);
  }
}

async function renderizarPdf(textoFinal: string, t: TemplateResolvido, demo: boolean): Promise<Buffer> {
  const page = await abrirPaginaResiliente(getContexto, descartarBrowser);

  try {
    let pdfBuffer: Buffer | null = null;
    const baseFontSize = t.typography.fontSize || 12;
    const fontSizes = [baseFontSize, baseFontSize - 1, baseFontSize - 2, baseFontSize - 3]
      .filter((s) => s >= 9);

    for (const fontSize of fontSizes) {
      // Template com layoutId usa o layout estruturado; sem ele, segue o HTML
      // legado — assim nenhum gabinete muda de aparencia sem ser configurado.
      const html = t.layoutId
        ? getLayout(t.layoutId)(parseTextoToDoc(textoFinal, t), t, {
            demo,
            fatorCompressao: fontSize / (t.typography.fontSize || 12),
          })
        : buildHtml(textoFinal, t, fontSize, demo);
      await page.setContent(html, { waitUntil: 'networkidle' });

      // Garante que as fontes terminaram de carregar antes de medir e imprimir.
      // Sem isso, o Chromium pode paginar com métricas da fonte de fallback.
      await page.evaluate(() => document.fonts.ready);

      const pageCount = await page.evaluate(() => {
        const totalHeight = document.body.scrollHeight;
        const a4UsableHeightPx = 932;
        return Math.ceil(totalHeight / a4UsableHeightPx);
      });

      // As margens vêm do `@page` do CSS (montado a partir do template).
      // Medido: quando `@page { margin }` está declarado, o Chromium ignora o
      // `margin` passado aqui — declarar nos dois lugares só confunde.
      const pdfBytes = await page.pdf({
        format: 'A4',
        printBackground: true,
      });

      pdfBuffer = Buffer.from(pdfBytes);

      if (pageCount <= 1) break;
      if (fontSize === fontSizes[fontSizes.length - 1]) break;
    }

    return pdfBuffer!;
  } catch (err) {
    descartarBrowser();
    throw err;
  } finally {
    await page.close().catch(() => {});
  }
}

export async function generatePdf(
  textoFinal: string,
  templateId?: string,
  tenantId?: string,
): Promise<Buffer> {
  const t = await getTemplate(templateId, tenantId);
  return generatePdfInternal(textoFinal, t, false);
}

/**
 * Gera o PDF a partir de um TemplateSettings já montado, sem consultar o banco.
 * Usado para preview e calibração de layout (scripts/preview-layout.ts).
 */
export async function generatePdfComTemplate(
  textoFinal: string,
  t: TemplateSettings,
  demo = false,
): Promise<Buffer> {
  return generatePdfInternal(textoFinal, t, demo);
}

/** Demo pública: sem tenant, usa os defaults neutros. */
export async function generatePdfDemo(textoFinal: string): Promise<Buffer> {
  const t = await getTemplate();
  return generatePdfInternal(textoFinal, t, true);
}

// ─────────────────────────────────────────────
// Nome do arquivo para download
// ─────────────────────────────────────────────

export function buildFilename(
  tipoServico: string,
  bairro: string,
  ext: 'pdf' | 'docx' = 'pdf',
): string {
  const data = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const tipo = tipoServico
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '_')
    .slice(0, 20);
  const bairroClean = bairro
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z0-9]/g, '_')
    .slice(0, 20);

  return `INDICACAO_${data}_${tipo}_${bairroClean}.${ext}`;
}
