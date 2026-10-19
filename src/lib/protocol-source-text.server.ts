import { extractText, getDocumentProxy } from 'unpdf';
import { parseProtocolDocxBytes } from './protocol-docx';
import { isUnfilledProtocolDocxTemplateTitle } from './protocol-docx-template';
import type { ProtocolDocument } from './protocol-document';
import { documentSourceText } from './protocol-habit-text';

export type SourceText = {
  kind: 'docx' | 'pdf' | 'text';
  /** The visible text, line by line: what the model reads and every recognised line is checked against. */
  text: string;
  pages?: number;
  warnings: string[];
  /** A Word file's own reading, kept for the rules path: its tables and lists are better than its text. */
  document?: ProtocolDocument;
  title?: string;
};

/** A source file as text: Word (with its own reading), PDF (text only), Markdown or plain text. */
export async function readSourceFile(name: string, bytes: Uint8Array): Promise<SourceText> {
  const extension = name.toLowerCase().split('.').pop();
  if (extension === 'docx') {
    const parsed = parseProtocolDocxBytes(bytes, name);
    const title = isUnfilledProtocolDocxTemplateTitle(parsed.canonicalTitle) ? undefined : parsed.canonicalTitle;
    return { kind: 'docx', text: documentSourceText(parsed.document, title), warnings: [], document: parsed.document, title };
  }
  if (extension === 'pdf') {
    const { text, pages } = await pdfText(bytes);
    const warnings = text.replace(/\s/g, '').length < 40 ? ['This PDF has almost no readable text; it may be a scan. Convert it to text first, then paste it in.'] : [];
    return { kind: 'pdf', text, pages, warnings };
  }
  if (extension === 'txt' || extension === 'md' || extension === 'markdown') return { kind: 'text', text: new TextDecoder().decode(bytes), warnings: [] };
  throw new Error('Only PDF, Word (.docx), TXT and Markdown files are supported');
}

const pageFurniture = /^(?:第\s*\d+\s*页(?:\s*[/，,]?\s*共\s*\d+\s*页)?|page\s*\d+(?:\s*(?:of|\/)\s*\d+)?|\d+\s*\/\s*\d+|\d+)$/i;

/**
 * The text of a PDF, page by page: lines that run on most pages (headers, footers) and bare page numbers are left out.
 * Only text is read; a scanned page has none, and says so.
 */
async function pdfText(bytes: Uint8Array) {
  const { totalPages, text } = await extractText(await getDocumentProxy(bytes), { mergePages: false });
  const pages = text.map(page => page.split(/\n/).map(line => line.replace(/\s+/g, ' ').trim()).filter(Boolean));
  const seen = new Map<string, number>();
  for (const lines of pages) for (const line of new Set(lines)) seen.set(line, (seen.get(line) ?? 0) + 1);
  const running = (line: string) => pages.length >= 3 && line.length <= 80 && (seen.get(line) ?? 0) >= Math.ceil(pages.length / 2);
  const body = pages.flatMap(lines => lines.filter(line => !running(line) && !pageFurniture.test(line))).join('\n');
  return { text: body, pages: totalPages };
}
