import { describe, expect, it } from 'vitest';
import { cleanTranscript, fitWithin, joinTranscripts, NO_TEXT, photoProblem, photoSourceName, unclearCount, UNCLEAR } from './protocol-photo';

describe('Photos of a manual as text', () => {
  it('shrinks a picture to its longest side and never enlarges one', () => {
    expect(fitWithin(4000, 3000)).toEqual({ width: 2000, height: 1500 });
    expect(fitWithin(3000, 4000)).toEqual({ width: 1500, height: 2000 });
    expect(fitWithin(1200, 800)).toEqual({ width: 1200, height: 800 });
  });

  it('keeps the pages in order, leaves out a page with nothing legible, and counts the marks to check', () => {
    const pages = [{ text: ' 1. 加入 50 µL ' }, { text: NO_TEXT }, { text: `2. 离心 ${UNCLEAR} min` }, { text: '' }];
    expect(joinTranscripts(pages)).toBe(`1. 加入 50 µL\n\n2. 离心 ${UNCLEAR} min`);
    expect(unclearCount(joinTranscripts(pages))).toBe(1);
  });

  it('drops a code fence or a lead-in line the model added', () => {
    expect(cleanTranscript('```\n1. 步骤\n```')).toBe('1. 步骤');
    expect(cleanTranscript('以下是转写结果：\n1. 步骤')).toBe('1. 步骤');
  });

  it('refuses what a model cannot read, and names the kept text after its source', () => {
    expect(photoProblem({ type: 'image/gif', size: 10 })).toMatch(/JPEG/);
    expect(photoProblem({ type: 'image/jpeg', size: 0 })).toBe('图片是空的');
    expect(photoProblem({ type: 'image/jpeg', size: 7 * 1024 * 1024 })).toMatch(/6 MB/);
    expect(photoProblem({ type: 'image/webp', size: 500_000 })).toBeUndefined();
    expect(photoSourceName(12)).toBe('照片转写（12 张，照片未存档）.txt');
  });
});
