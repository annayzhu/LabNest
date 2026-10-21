import { describe, expect, it } from 'vitest';
import { manualFileProblem } from './inventory-manuals';

describe('A manual kept on an inventory item', () => {
  it('accepts the files a manual comes as and says why it refuses another', () => {
    expect(manualFileProblem({ name: 'RNeasy_Handbook.PDF', size: 900_000 })).toBeUndefined();
    expect(manualFileProblem({ name: 'kit.docx', size: 10 })).toBeUndefined();
    expect(manualFileProblem({ name: 'kit.png', size: 10 })).toBe('A manual can be a PDF, Word, text or Markdown file');
    expect(manualFileProblem({ name: 'kit.pdf', size: 0 })).toBe('Choose the manual file');
    expect(manualFileProblem({ name: 'kit.pdf', size: 26 * 1024 * 1024 })).toBe('The file is larger than 25 MB');
  });
});
