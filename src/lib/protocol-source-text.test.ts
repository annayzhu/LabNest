import { describe, expect, it } from 'vitest';
import { readSourceFile } from './protocol-source-text.server';

/** A one-page PDF with two lines of text, built by hand (pdf.js rebuilds the cross-reference table). */
function tinyPdf(lines: string[]) {
  const stream = `BT /F1 12 Tf 72 720 Td ${lines.map((line, index) => `${index ? '0 -20 Td ' : ''}(${line}) Tj`).join(' ')} ET`;
  const body = [
    '%PDF-1.4',
    '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj',
    '2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj',
    '3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj',
    `4 0 obj << /Length ${stream.length} >> stream\n${stream}\nendstream endobj`,
    '5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj',
    'trailer << /Root 1 0 R >>',
    '%%EOF',
  ].join('\n');
  return new TextEncoder().encode(body);
}

describe('Reading a source file', () => {
  it('reads the text of a PDF line by line', async () => {
    const source = await readSourceFile('manual.pdf', tinyPdf(['1. Add 350 uL Buffer RL.', '2. Centrifuge for 2 min.']));
    expect(source.kind).toBe('pdf');
    expect(source.pages).toBe(1);
    expect(source.text.split('\n')).toEqual(['1. Add 350 uL Buffer RL.', '2. Centrifuge for 2 min.']);
    expect(source.warnings).toEqual(['This PDF has almost no readable text; it may be a scan. Convert it to text first, then paste it in.']);
  });

  it('reads plain text and refuses other files', async () => {
    expect((await readSourceFile('steps.md', new TextEncoder().encode('1. 加入 PBS 1 mL'))).text).toBe('1. 加入 PBS 1 mL');
    await expect(readSourceFile('photo.png', new Uint8Array([1, 2]))).rejects.toThrow('Only PDF');
  });
});
