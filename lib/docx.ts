import {
  AlignmentType,
  BorderStyle,
  Document,
  HeightRule,
  ImageRun,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
} from 'docx';
import { getTemplate, type TemplateSettings } from './template';

// ─────────────────────────────────────────────
// Constantes & helpers
// ─────────────────────────────────────────────

const noBorder  = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' } as const;
const noBorders = { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder };

/** Converte base64 data URL em Buffer, retorna null se inválido */
function dataUrlToBuffer(dataUrl: string | null): { buffer: Buffer; type: 'png' | 'jpg' } | null {
  if (!dataUrl || !dataUrl.startsWith('data:image/')) return null;
  const match = dataUrl.match(/^data:image\/(png|jpe?g);base64,(.+)$/);
  if (!match) return null;
  const type = match[1].startsWith('j') ? 'jpg' as const : 'png' as const;
  return { buffer: Buffer.from(match[2], 'base64'), type };
}

function img(data: { buffer: Buffer; type: 'png' | 'jpg' }, w: number, h: number): ImageRun {
  return new ImageRun({ data: data.buffer, type: data.type, transformation: { width: w, height: h } });
}

// ─────────────────────────────────────────────
// Cabeçalho
// ─────────────────────────────────────────────

function buildHeaderTable(t: TemplateSettings): Table {
  const logoLeft  = dataUrlToBuffer(t.logos.left);
  const logoRight = dataUrlToBuffer(t.logos.right);
  const FONT = t.typography.fontFamily.split(',')[0].replace(/'/g, '').trim();

  const leftCell = new TableCell({
    width: { size: 15, type: WidthType.PERCENTAGE },
    borders: noBorders,
    verticalAlign: VerticalAlign.CENTER,
    children: [
      new Paragraph({
        children: logoLeft ? [img(logoLeft, 90, 90)] : [],
        alignment: AlignmentType.CENTER,
        spacing: { after: 0 },
      }),
    ],
  });

  const centerCell = new TableCell({
    width: { size: 70, type: WidthType.PERCENTAGE },
    borders: noBorders,
    verticalAlign: VerticalAlign.CENTER,
    children: [
      new Paragraph({
        children: [new TextRun({ text: t.institution.name.toUpperCase(), bold: true, font: FONT, size: 28 })],
        alignment: AlignmentType.CENTER,
        spacing: { after: 40 },
      }),
      new Paragraph({
        children: [new TextRun({ text: t.institution.title, font: FONT, size: 18 })],
        alignment: AlignmentType.CENTER,
        spacing: { after: 80 },
      }),
      new Paragraph({
        children: [new TextRun({ text: t.institution.subtitle, font: FONT, size: 22, italics: true })],
        alignment: AlignmentType.CENTER,
        spacing: { after: 40 },
      }),
      new Paragraph({
        children: [new TextRun({ text: t.institution.gabinete, font: FONT, size: 18 })],
        alignment: AlignmentType.CENTER,
        spacing: { after: 40 },
      }),
      new Paragraph({
        children: [new TextRun({ text: t.institution.email, font: FONT, size: 18 })],
        alignment: AlignmentType.CENTER,
        spacing: { after: 0 },
      }),
    ],
  });

  const rightCell = new TableCell({
    width: { size: 15, type: WidthType.PERCENTAGE },
    borders: noBorders,
    verticalAlign: VerticalAlign.CENTER,
    children: [
      new Paragraph({
        children: logoRight ? [img(logoRight, 90, 90)] : [],
        alignment: AlignmentType.CENTER,
        spacing: { after: 0 },
      }),
    ],
  });

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: noBorder, bottom: noBorder, left: noBorder, right: noBorder,
      insideHorizontal: noBorder, insideVertical: noBorder,
    },
    rows: [
      new TableRow({
        height: { value: 1050, rule: HeightRule.ATLEAST },
        children: [leftCell, centerCell, rightCell],
      }),
    ],
  });
}

// ─────────────────────────────────────────────
// Parser de texto → parágrafos DOCX
// ─────────────────────────────────────────────

type LineKind =
  | 'title' | 'greeting' | 'numero' | 'request-intro'
  | 'list-item' | 'location-date' | 'signer-name' | 'signer-title'
  | 'body' | 'empty';

function classifyLine(t: string): LineKind {
  if (!t) return 'empty';
  if (t.startsWith('INDICAÇÃO –') || t.startsWith('INDICACAO -')) return 'title';
  // Captura todas as variações da saudação: SENHOR, SENHORA, SENHORAS, SENHORES
  if (/^SENHOR(ES|AS|A)?/.test(t)) return 'greeting';
  if (/^INDICAÇÃO\s+N[ºo°]/i.test(t) || /^INDICACAO\s+N/i.test(t)) return 'numero';
  if (/^indico\s+à\s+mesa/i.test(t)) return 'request-intro';
  if (/^\d+\./.test(t)) return 'list-item';
  if (/^Sala\s/i.test(t)) return 'location-date';
  if (/^Vereador[a]?$/i.test(t)) return 'signer-title';

  const isUpper = /^[A-ZÁÉÍÓÚÀÃÕÂÊÎÔÛÇ\s]+$/.test(t);
  if (isUpper && t.length > 6 && t.split(' ').length >= 2
    && !t.includes('–')
    && !/^(INDICAÇÃO|SENHOR|CÂMARA|SALA|INDICO)/.test(t)) {
    return 'signer-name';
  }
  return 'body';
}

function lineToParagraph(line: string, FONT: string, BODY_HP: number, justified: boolean, indent: number): Paragraph {
  const t = line.trim();
  const kind = classifyLine(t);
  const tx = (text: string, bold = false, size = BODY_HP, italic = false) =>
    new TextRun({ text, font: FONT, size, bold, italics: italic });
  const align = justified ? AlignmentType.JUSTIFIED : AlignmentType.LEFT;

  switch (kind) {
    case 'empty':
      return new Paragraph({ children: [], spacing: { after: 100 } });
    case 'title':
      return new Paragraph({ children: [tx(t, true, 28)], alignment: AlignmentType.CENTER, spacing: { after: 240 } });
    case 'greeting': {
      // Última linha da saudação termina com ';' → espaço maior após o bloco
      const isLastGreeting = t.endsWith(';');
      return new Paragraph({
        children: [tx(t, true)],
        alignment: AlignmentType.CENTER,
        spacing: { after: isLastGreeting ? 280 : 20 },
      });
    }
    case 'numero':
      return new Paragraph({ children: [tx(t)], alignment: AlignmentType.CENTER, spacing: { after: 240 } });
    case 'list-item':
      return new Paragraph({ children: [tx(t)], alignment: align, indent: { left: 360 }, spacing: { after: 80 } });
    case 'location-date':
      return new Paragraph({ children: [tx(t)], alignment: AlignmentType.CENTER, spacing: { before: 320, after: 240 } });
    case 'signer-name':
      return new Paragraph({
        children: [tx(t, true)],
        alignment: AlignmentType.CENTER,
        spacing: { before: 480, after: 60 },
        border: { top: { color: '000000', space: 8, style: BorderStyle.SINGLE, size: 6 } },
      });
    case 'signer-title':
      return new Paragraph({ children: [tx(t)], alignment: AlignmentType.CENTER, spacing: { after: 60 } });
    default:
      return new Paragraph({
        children: [tx(t)],
        alignment: align,
        indent: indent > 0 ? { firstLine: Math.round(indent * 56.7) } : undefined, // mm → twips
        spacing: { after: Math.round((BODY_HP / 2) * 6.67) }, // ~paragraphSpacing
      });
  }
}

// ─────────────────────────────────────────────
// Exportação principal
// ─────────────────────────────────────────────

export async function generateDocx(textoFinal: string, templateId?: string): Promise<Buffer> {
  const t = await getTemplate(templateId);

  const FONT    = t.typography.fontFamily.split(',')[0].replace(/'/g, '').trim();
  const BODY_HP = t.typography.fontSize * 2;
  const marginTw = Math.round(t.layout.marginLateral * 56.7); // mm → twips
  const marginTbTw = Math.round(t.layout.marginTopBottom * 56.7);

  const headerTable = buildHeaderTable(t);

  const divider = new Paragraph({
    children: [],
    border: {
      bottom: { color: t.colors.divider.replace('#', ''), space: 4, style: BorderStyle.SINGLE, size: Math.round(t.colors.dividerWidth * 6) },
    },
    spacing: { after: 280 },
  });

  const textParagraphs = textoFinal.split('\n')
    .map(line => lineToParagraph(line, FONT, BODY_HP, t.typography.textJustified, t.typography.paragraphIndent));

  // Logo do partido no rodapé (usa logos.partido; cai em logos.right como fallback)
  const partidoSrc = t.logos.partido || t.logos.right;
  const partidoLogo = dataUrlToBuffer(partidoSrc);
  const ls = (base: number, pct?: number) => Math.round(base * ((pct ?? 100) / 100));
  const pW = ls(110, t.logos.partidoSize);
  const pH = ls(42,  t.logos.partidoSize);
  const partidoParagraph = new Paragraph({
    children: partidoLogo ? [img(partidoLogo, pW, pH)] : [],
    alignment: AlignmentType.CENTER,
    spacing: { before: 120, after: 0 },
  });

  const doc = new Document({
    creator: 'Sistema de Indicações – ' + t.institution.name,
    title: 'Indicação Legislativa',
    sections: [{
      properties: {
        page: {
          margin: { top: marginTbTw, bottom: marginTbTw, left: marginTw, right: marginTw },
        },
      },
      children: [
        headerTable,
        divider,
        ...textParagraphs,
        partidoParagraph,
      ],
    }],
  });

  return Buffer.from(await Packer.toBuffer(doc));
}
