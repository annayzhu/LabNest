import { extractText, getDocumentProxy } from 'unpdf';
import { parseProtocolDocxBytes } from './protocol-docx';
import { isUnfilledProtocolDocxTemplateTitle } from './protocol-docx-template';
import type { ProtocolDocument } from './protocol-document';
import { documentSourceText } from './protocol-habit-text';
import { pagedLines, type SourcePage } from './protocol-anchors';

export type SourceText = {
  kind: 'docx' | 'pdf' | 'text';
  /** The visible text, line by line: what the rules reading reads. */
  text: string;
  pages?: number;
  /**
   * The same text page by page, each page's lines numbered from 1: what the model reads and what "〔p3:12〕" points at.
   * A PDF keeps its own pages; Word and plain text are one page, unless the text is paged with form feeds.
   */
  sourcePages: SourcePage[];
  warnings: string[];
  /** A Word file's own reading, kept for the rules path: its tables and lists are better than its text. */
  document?: ProtocolDocument;
  title?: string;
};

/** A source file as text: Word (with its own reading), PDF (text only, page by page), Markdown or plain text. */
export async function readSourceFile(name: string, bytes: Uint8Array): Promise<SourceText> {
  const extension = name.toLowerCase().split('.').pop();
  if (extension === 'docx') {
    const parsed = parseProtocolDocxBytes(bytes, name);
    const title = isUnfilledProtocolDocxTemplateTitle(parsed.canonicalTitle) ? undefined : parsed.canonicalTitle;
    const text = documentSourceText(parsed.document, title);
    return { kind: 'docx', text, sourcePages: pagedLines(text), warnings: [], document: parsed.document, title };
  }
  if (extension === 'pdf') {
    const { text, pages, sourcePages } = await pdfText(bytes);
    const warnings = text.replace(/\s/g, '').length < 40 ? ['This PDF has almost no readable text; it may be a scan. Convert it to text first, then paste it in.'] : [];
    return { kind: 'pdf', text, pages, sourcePages, warnings };
  }
  if (extension === 'txt' || extension === 'md' || extension === 'markdown') {
    const text = new TextDecoder().decode(bytes);
    const sourcePages = pagedLines(text);
    return { kind: 'text', text, ...(sourcePages.length > 1 ? { pages: sourcePages.length } : {}), sourcePages, warnings: [] };
  }
  throw new Error('Only PDF, Word (.docx), TXT and Markdown files are supported');
}

const pageFurniture = /^(?:第\s*\d+\s*页(?:\s*[/，,]?\s*共\s*\d+\s*页)?|page\s*\d+(?:\s*(?:of|\/)\s*\d+)?|\d+\s*\/\s*\d+|\d+)$/i;

/**
 * The text of a PDF, page by page: lines that run on most pages (headers, footers) and bare page numbers are left out,
 * and every page keeps its number, even one left empty. Only text is read; a scanned page has none, and says so.
 */
async function pdfText(bytes: Uint8Array) {
  const { totalPages, text } = await extractText(await getDocumentProxy(bytes), { mergePages: false });
  const pages = text.map(page => page.split(/\n/).map(line => line.replace(/\s+/g, ' ').trim()).filter(Boolean));
  const seen = new Map<string, number>();
  for (const lines of pages) for (const line of new Set(lines)) seen.set(line, (seen.get(line) ?? 0) + 1);
  const running = (line: string) => pages.length >= 3 && line.length <= 80 && (seen.get(line) ?? 0) >= Math.ceil(pages.length / 2);
  const sourcePages = pages.map((lines, index) => ({ page: index + 1, lines: lines.filter(line => !running(line) && !pageFurniture.test(line)) }));
  return { text: sourcePages.flatMap(page => page.lines).join('\n'), pages: totalPages, sourcePages };
}
