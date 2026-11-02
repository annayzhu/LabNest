import { describe, expect, it } from 'vitest';
import { chineseNumbers, keptLines, parseTidy, tidyMarkdown, unsupportedTokens } from './entry-tidy';

describe('整理 a quick record', () => {
  it('reads Chinese numerals the way they are spoken', () => {
    expect(chineseNumbers('五十纳摩尔，四十八小时，一万二还是一万三转，两百五，一千五，两百零五，十五，一点五毫升，四度')).toEqual([50, 48, 12000, 13000, 250, 1500, 205, 15, 1.5, 4]);
  });

  it('flags numbers and record codes the words do not have', () => {
    const words = '转染 si-SRGN 五十纳摩尔，EXP-0012，24孔板';
    expect(unsupportedTokens('si-SRGN 50 nM，24 孔板，EXP-0012', words)).toEqual([]);
    expect(unsupportedTokens('si-SRGN 50 nM，48 h，EXP-0013', words)).toEqual(['48', 'EXP-0013']);
  });

  it('lays the draft out under the four headings, then what to confirm', () => {
    const tidy = parseTidy('```json\n{"title":"转染","done":["转染两条 si-SRGN"],"seen":[],"values":["50 nM"],"next":["48 h 收 RNA"],"unclear":["孔板规格没说"]}\n```');
    expect(tidyMarkdown(tidy)).toBe('**做了什么**\n- 转染两条 si-SRGN\n\n**数值**\n- 50 nM\n\n**下一步**\n- 48 h 收 RNA\n\n**待确认**\n- 孔板规格没说');
    expect(tidy.experiment).toBe('');
  });

  it('keeps pictures, tables and plate layouts out of the words and in the record', () => {
    const picture = '![细胞](/api/attachments/a1 "media:{\\"attachmentId\\":\\"a1\\",\\"mediaType\\":\\"image\\",\\"filename\\":\\"cells.png\\"}")';
    expect(keptLines(`今天拍了照\n${picture}\n明天换液`).length).toBeLessThanOrEqual(1);
    expect(keptLines('今天拍了照\n明天换液')).toEqual([]);
  });
});
