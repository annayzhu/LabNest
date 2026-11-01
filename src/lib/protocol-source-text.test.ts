import { describe, expect, it } from 'vitest';
import { readSourceFile } from './protocol-source-text.server';

/** A PDF with a page per list of lines, built by hand (pdf.js rebuilds the cross-reference table). */
function tinyPdf(...pages: string[][]) {
  const font = 3 + pages.length * 2;
  const objects = pages.flatMap((lines, index) => {
    const stream = `BT /F1 12 Tf 72 720 Td ${lines.map((line, at) => `${at ? '0 -20 Td ' : ''}(${line}) Tj`).join(' ')} ET`;
    const page = 3 + index * 2;
    return [
      `${page} 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents ${page + 1} 0 R /Resources << /Font << /F1 ${font} 0 R >> >> >> endobj`,
      `${page + 1} 0 obj << /Length ${stream.length} >> stream\n${stream}\nendstream endobj`,
    ];
  });
  const body = [
    '%PDF-1.4',
    '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj',
    `2 0 obj << /Type /Pages /Kids [${pages.map((_, index) => `${3 + index * 2} 0 R`).join(' ')}] /Count ${pages.length} >> endobj`,
    ...objects,
    `${font} 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj`,
    'trailer << /Root 1 0 R >>',
    '%%EOF',
  ].join('\n');
  return new TextEncoder().encode(body);
}

describe('Reading a source file', () => {
  it('reads the text of a PDF line by line', async () => {
    const source = await readSourceFile('manual.pdf', tinyPdf(['1. Add 350 uL Buffer RL.', '2. Centrifuge for 2 min.']));
    expect(source.sourcePages).toEqual([{ page: 1, lines: ['1. Add 350 uL Buffer RL.', '2. Centrifuge for 2 min.'] }]);
    expect(source.kind).toBe('pdf');
    expect(source.pages).toBe(1);
    expect(source.text.split('\n')).toEqual(['1. Add 350 uL Buffer RL.', '2. Centrifuge for 2 min.']);
    expect(source.warnings).toEqual(['This PDF has almost no readable text; it may be a scan. Convert it to text first, then paste it in.']);
  });

  it('keeps a PDF\'s pages and numbers their lines, leaving out running headers and page numbers', async () => {
    const source = await readSourceFile('manual.pdf', tinyPdf(
      ['Kit Manual Rev. 1', 'Store at 4 C.', '1'],
      ['Kit Manual Rev. 1', '1. Add 350 uL Buffer RL.', '2. Centrifuge for 2 min.', '2'],
      ['Kit Manual Rev. 1', 'Troubleshooting', '3'],
    ));
    expect(source.pages).toBe(3);
    expect(source.sourcePages).toEqual([
      { page: 1, lines: ['Store at 4 C.'] },
      { page: 2, lines: ['1. Add 350 uL Buffer RL.', '2. Centrifuge for 2 min.'] },
      { page: 3, lines: ['Troubleshooting'] },
    ]);
    expect(source.text).toBe('Store at 4 C.\n1. Add 350 uL Buffer RL.\n2. Centrifuge for 2 min.\nTroubleshooting');
  });

  it('pages plain text at form feeds, as photos read one by one are', async () => {
    const source = await readSourceFile('照片转写.txt', new TextEncoder().encode('第一页\n1. 加入 PBS 1 mL\f第二页\n2. 离心'));
    expect(source.pages).toBe(2);
    expect(source.sourcePages.map(page => [page.page, page.lines.length])).toEqual([[1, 2], [2, 2]]);
  });

  it('reads plain text and refuses other files', async () => {
    expect((await readSourceFile('steps.md', new TextEncoder().encode('1. 加入 PBS 1 mL'))).text).toBe('1. 加入 PBS 1 mL');
    await expect(readSourceFile('photo.png', new Uint8Array([1, 2]))).rejects.toThrow('Only PDF');
  });
});
