import { getTemplate, type TemplateSettings } from './template';
import type { Browser } from 'playwright-core';

// ─────────────────────────────────────────────
// Lança o browser correto por ambiente:
// • Vercel/produção → @sparticuz/chromium (serverless-safe)
// • Dev local       → playwright nativo (binário local)
// ─────────────────────────────────────────────

async function launchBrowser(): Promise<Browser> {
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    const chromium = (await import('@sparticuz/chromium')).default;
    const { chromium: pw } = await import('playwright-core');
    return pw.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: true,
    });
  }
  const { chromium: pw } = await import('playwright');
  return pw.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
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
  const font = t.typography.fontFamily;
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

async function generatePdfInternal(textoFinal: string, t: ReturnType<typeof getTemplate> extends Promise<infer R> ? R : never, demo: boolean): Promise<Buffer> {
  const browser = await launchBrowser();

  try {
    const page = await browser.newPage();

    let pdfBuffer: Buffer | null = null;
    const baseFontSize = t.typography.fontSize || 12;
    const fontSizes = [baseFontSize, baseFontSize - 1, baseFontSize - 2, baseFontSize - 3]
      .filter((s) => s >= 9);

    const mLat = t.layout.marginLateral + 'mm';
    const mTb  = t.layout.marginTopBottom + 'mm';

    for (const fontSize of fontSizes) {
      const html = buildHtml(textoFinal, t, fontSize, demo);
      await page.setContent(html, { waitUntil: 'networkidle' });

      const pageCount = await page.evaluate(() => {
        const totalHeight = document.body.scrollHeight;
        const a4UsableHeightPx = 932;
        return Math.ceil(totalHeight / a4UsableHeightPx);
      });

      const pdfBytes = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: mTb, right: mLat, bottom: mTb, left: mLat },
      });

      pdfBuffer = Buffer.from(pdfBytes);

      if (pageCount <= 1) break;
      if (fontSize === fontSizes[fontSizes.length - 1]) break;
    }

    return pdfBuffer!;
  } finally {
    await browser.close();
  }
}

export async function generatePdf(textoFinal: string, templateId?: string): Promise<Buffer> {
  const t = await getTemplate(templateId);
  return generatePdfInternal(textoFinal, t, false);
}

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
