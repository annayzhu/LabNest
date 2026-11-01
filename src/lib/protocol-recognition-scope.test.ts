import { describe, expect, it } from 'vitest';
import { batchPages, buildOutlinePrompt, defaultChoice, needsConfirmation, outlineDigest, parseOutline, partKept } from './protocol-recognition-scope';

const page = (number: number, lines: string[]) => ({ page: number, lines });
const filler = (count: number) => Array.from({ length: count }, (_, index) => `Detail sentence ${index + 1} about how the kit is handled, kept long enough to fill a page.`);

describe('目录与范围', () => {
  it('sends a short source whole, and of a long one only each page\'s first lines and headings', () => {
    expect(outlineDigest([page(1, ['Title', '1. Add 1 mL.'])])).toEqual({ text: '[p1:1] Title\n[p1:2] 1. Add 1 mL.', whole: true });
    const long = Array.from({ length: 20 }, (_, index) => page(index + 1, [`Section ${index + 1}`, ...filler(30), 'Step 3: Blocking', 'Troubleshooting']));
    const { text, whole } = outlineDigest(long);
    expect(whole).toBe(false);
    expect(text).toContain('— 第 20 页（33 行）');
    expect(text).toContain('[p7:32] Step 3: Blocking');
    expect(text).toContain('[p7:33] Troubleshooting');
    expect(text).not.toContain('Detail sentence 20 ');
    expect(buildOutlinePrompt({ pages: long, fileName: 'a.pdf', title: 'RNA 提取', goal: '提取细胞 RNA' }).user).toMatch(/^文件：a\.pdf\n规程名称：RNA 提取\n作者的目标：提取细胞 RNA\n共 20 页。目录/);
  });

  it('reads an answer leniently: fenced JSON, page ranges in any form, unknown sections, uncovered pages', () => {
    const pages = [1, 2, 3, 4, 5, 6].map(number => page(number, ['text']));
    const outline = parseOutline('好的：\n```json\n' + JSON.stringify({
      parts: [{ pages: 'p1–p2', label: '产品信息', use: '背景' }, { pages: [3, 4], label: 'Cells', use: '步骤', workflow: '培养细胞' }, { pages: 5, label: 'Tissue', use: 'steps', workflow: '组织' }, { pages: '9-12', label: '附录', use: '不要' }],
      workflows: ['培养细胞', { label: '组织' }], systems: null, conflicts: ['收菌 5–10 min（p3）与 10 min（p5）'],
    }) + '\n```', pages);
    // Pages 9–12 do not exist; page 6, which no part names, is kept as an unsorted part.
    expect(outline.parts.map(part => [part.from, part.to, part.use, part.workflow ?? ''])).toEqual([[1, 2, 'background', ''], [3, 4, 'steps', '培养细胞'], [5, 5, 'steps', '组织'], [6, 6, 'unknown', '']]);
    expect(outline).toMatchObject({ workflows: ['培养细胞', '组织'], conflicts: ['收菌 5–10 min（p3）与 10 min（p5）'], read: true });
    expect(needsConfirmation(outline)).toBe(true);
    expect(parseOutline('不是 JSON', pages)).toEqual({ parts: [{ from: 1, to: 6, label: '全文', use: 'unknown' }], workflows: [], conflicts: [], read: false });
  });

  it('reads only the chosen workflow, the kept systems and the parts not left out, batch by batch', () => {
    const pages = Array.from({ length: 8 }, (_, index) => page(index + 1, ['text']));
    const outline = parseOutline(JSON.stringify({ parts: [
      { pages: '1', label: 'Kit contents', use: '材料' }, { pages: '2', label: 'Storage', use: '背景' },
      { pages: '3', label: 'Mini', use: '步骤', system: 'Mini' }, { pages: '4', label: 'Maxi', use: '步骤', system: 'Maxi' },
      { pages: '5', label: 'Results', use: '结果' }, { pages: '6', label: 'FAQ', use: '步骤' }, { pages: '7-8', label: 'Ordering', use: '不要' },
    ], workflows: [], systems: { options: ['Mini', 'Maxi'] }, conflicts: [] }), pages);
    const choice = { ...defaultChoice(outline, 'zh' as const), systems: ['Maxi'], dropped: [5, 6] };
    expect(partKept(outline.parts[2], 2, choice)).toBe(false);
    expect(batchPages(outline, choice)).toEqual({ all: [1, 2, 4, 5], front: [2], material: [1, 4], steps: [4], results: [4, 5] });
    expect(outline.systems).toEqual({ label: '体系', options: ['Mini', 'Maxi'] });
  });
});
