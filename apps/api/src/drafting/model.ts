// The document model every template builds, and its three renderings: plain
// text (preview and the matter document), DOCX and PDF. Format rules follow
// the rules of court: A4, numbered paragraphs, numbered pages, a court
// heading with the case number and parties (Uniform Rule 62; Magistrates'
// Courts Rule 63; divisional practice directives).
import {
  AlignmentType,
  Document,
  Footer,
  Packer,
  PageNumber,
  Paragraph,
  TabStopType,
  TextRun,
} from 'docx';
import PDFDocument from 'pdfkit';
import type { DraftFormat } from '@ahava88/shared';

export type Block =
  | { kind: 'heading'; text: string }
  | { kind: 'centred'; text: string; bold?: boolean }
  | { kind: 'text'; text: string; bold?: boolean }
  /** Numbered consecutively through the document. */
  | { kind: 'para'; text: string }
  | { kind: 'signature'; lines: string[] }
  | { kind: 'spacer' };

export interface CourtHeading {
  court: string[];
  caseNumber: string;
  parties: Array<{ name: string; role: string }>;
}

export interface DocModel {
  title: string;
  heading?: CourtHeading;
  /** Letters: the letterhead and addressee block. */
  letterhead?: string[];
  blocks: Block[];
}

const MM_TO_TWIP = 56.7;
const MM_TO_PT = 2.835;

/** Plain text: the preview, and the body stored with the matter document. */
export function renderText(model: DocModel, format?: DraftFormat): string {
  const numbered = format?.numberedParagraphs !== false;
  const lines: string[] = [];
  if (model.letterhead) lines.push(...model.letterhead, '');
  if (model.heading) {
    lines.push(...model.heading.court.map((line) => line.toUpperCase()));
    lines.push(`Case number: ${model.heading.caseNumber || '[case number]'}`, '');
    model.heading.parties.forEach((party, index) => {
      if (index > 0) lines.push('and', '');
      lines.push(party.name.toUpperCase(), party.role, '');
    });
  }
  // Letters carry their subject line instead of a title.
  if (!model.letterhead) lines.push(model.title.toUpperCase(), '');
  let n = 0;
  for (const block of model.blocks) {
    if (block.kind === 'para') lines.push(numbered ? `${(n += 1)}. ${block.text}` : block.text, '');
    else if (block.kind === 'signature')
      lines.push('', '________________________', ...block.lines, '');
    else if (block.kind === 'spacer') lines.push('');
    else lines.push(block.kind === 'heading' ? block.text.toUpperCase() : block.text, '');
  }
  return lines
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export async function renderDocx(model: DocModel, format: DraftFormat): Promise<Buffer> {
  const size = format.fontSizePt * 2;
  const spacing = { line: Math.round(240 * format.lineSpacing), after: 160 };
  const run = (text: string, bold = false) => new TextRun({ text, bold, size, font: 'Arial' });
  const children: Paragraph[] = [];
  for (const line of model.letterhead ?? [])
    children.push(new Paragraph({ children: [run(line)] }));
  if (model.heading) {
    for (const line of model.heading.court) {
      children.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [run(line.toUpperCase(), true)],
        }),
      );
    }
    children.push(
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        spacing,
        children: [run(`Case number: ${model.heading.caseNumber || '__________'}`)],
      }),
    );
    model.heading.parties.forEach((party, index) => {
      if (index > 0) children.push(new Paragraph({ spacing, children: [run('and')] }));
      children.push(
        new Paragraph({
          tabStops: [{ type: TabStopType.RIGHT, position: 9000 }],
          children: [run(party.name.toUpperCase(), true), run(`\t${party.role}`)],
        }),
      );
    });
  }
  if (!model.letterhead) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing,
        children: [run(model.title.toUpperCase(), true)],
      }),
    );
  }
  let n = 0;
  for (const block of model.blocks) {
    if (block.kind === 'para') {
      n += 1;
      children.push(
        new Paragraph({
          spacing,
          alignment: AlignmentType.JUSTIFIED,
          indent: format.numberedParagraphs ? { left: 720, hanging: 720 } : undefined,
          children: [run(format.numberedParagraphs ? `${n}.\t${block.text}` : block.text)],
        }),
      );
    } else if (block.kind === 'signature') {
      children.push(
        new Paragraph({ spacing: { before: 480 }, children: [run('________________________')] }),
      );
      for (const line of block.lines) children.push(new Paragraph({ children: [run(line)] }));
    } else if (block.kind === 'spacer') {
      children.push(new Paragraph({ children: [] }));
    } else {
      children.push(
        new Paragraph({
          spacing,
          alignment: block.kind === 'centred' ? AlignmentType.CENTER : AlignmentType.LEFT,
          children: [
            run(
              block.kind === 'heading' ? block.text.toUpperCase() : block.text,
              block.kind === 'heading' || Boolean('bold' in block && block.bold),
            ),
          ],
        }),
      );
    }
  }
  const [top, right, bottom, left] = format.marginsMm.map((mm) => Math.round(mm * MM_TO_TWIP));
  const doc = new Document({
    creator: 'Legal Practice Workspace',
    title: model.title,
    sections: [
      {
        properties: {
          page: { size: { width: 11906, height: 16838 }, margin: { top, right, bottom, left } },
        },
        footers: format.pageNumbers
          ? {
              default: new Footer({
                children: [
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [
                      new TextRun({ children: [PageNumber.CURRENT], size: 18, font: 'Arial' }),
                    ],
                  }),
                ],
              }),
            }
          : undefined,
        children,
      },
    ],
  });
  return Packer.toBuffer(doc);
}

export function renderPdf(model: DocModel, format: DraftFormat): Promise<Buffer> {
  const [top, right, bottom, left] = format.marginsMm.map((mm) => mm * MM_TO_PT);
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top, right, bottom, left },
      bufferPages: true,
      info: { Title: model.title },
    });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    const gap = (format.lineSpacing - 1) * format.fontSizePt;
    const body = (text: string, options: PDFKit.Mixins.TextOptions = {}) =>
      doc
        .font('Helvetica')
        .fontSize(format.fontSizePt)
        .text(text, { lineGap: gap, ...options })
        .moveDown(0.5);
    const bold = (text: string, options: PDFKit.Mixins.TextOptions = {}) =>
      doc
        .font('Helvetica-Bold')
        .fontSize(format.fontSizePt)
        .text(text, { lineGap: gap, ...options })
        .moveDown(0.5);
    for (const line of model.letterhead ?? [])
      doc.font('Helvetica').fontSize(format.fontSizePt).text(line);
    if (model.letterhead) doc.moveDown();
    if (model.heading) {
      for (const line of model.heading.court) bold(line.toUpperCase(), { align: 'center' });
      body(`Case number: ${model.heading.caseNumber || '__________'}`, { align: 'right' });
      model.heading.parties.forEach((party, index) => {
        if (index > 0) body('and');
        bold(party.name.toUpperCase(), { continued: false });
        body(party.role, { align: 'right' });
      });
    }
    if (!model.letterhead) bold(model.title.toUpperCase(), { align: 'center' });
    let n = 0;
    for (const block of model.blocks) {
      if (block.kind === 'para') {
        n += 1;
        body(format.numberedParagraphs ? `${n}.  ${block.text}` : block.text, { align: 'justify' });
      } else if (block.kind === 'signature') {
        doc.moveDown(1.5);
        body('________________________');
        for (const line of block.lines)
          doc.font('Helvetica').fontSize(format.fontSizePt).text(line);
        doc.moveDown();
      } else if (block.kind === 'spacer') {
        doc.moveDown();
      } else if (block.kind === 'heading') {
        bold(block.text.toUpperCase());
      } else if (block.kind === 'centred') {
        (block.bold ? bold : body)(block.text, { align: 'center' });
      } else {
        (block.bold ? bold : body)(block.text);
      }
    }
    if (format.pageNumbers) {
      const range = doc.bufferedPageRange();
      for (let i = range.start; i < range.start + range.count; i += 1) {
        doc.switchToPage(i);
        doc
          .font('Helvetica')
          .fontSize(9)
          .text(String(i + 1), 0, doc.page.height - bottom / 2, {
            align: 'center',
            width: doc.page.width,
          });
      }
    }
    doc.end();
  });
}
