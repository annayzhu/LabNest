import { z } from 'zod';
import { jsonObject } from './copilot/structured';
import { documentMediaFromMarkdown } from './document-media';
import { plateLayoutFromMarkdown } from './plate-layout';
import { toolOutputFromMarkdown } from './tool-workflow';
import { scientificTableFromMarkdown } from './scientific-document';

/**
 * 整理 a quick record (Q337–Q340, task spec entry.tidy). The author usually dictates with the keyboard's microphone;
 * the model lays the words out as a title and four kinds of lines (what was done, seen, measured, and comes next) and
 * adds nothing they did not say. The program then checks every number and record code in the draft against the
 * original words. Pictures, tables and plate layouts in the record are kept as they are, after the tidied text.
 */
const lines = z.array(z.string().trim().min(1).max(500)).max(30).default([]);
export const tidySchema = z.object({
  title: z.string().trim().min(1).max(80),
  done: lines, seen: lines, values: lines, next: lines,
  unclear: z.array(z.string().trim().min(1).max(200)).max(20).default([]),
  /** An experiment the words name, by code (EXP-…) or title; empty when they name none. */
  experiment: z.string().trim().max(160).default(''),
});
export type EntryTidy = z.infer<typeof tidySchema>;
export const parseTidy = (raw: string) => tidySchema.parse(jsonObject(raw));

/** A draft as the record page gets it. */
export type TidyDraft = {
  requestKey: string; title: string; markdown: string; unsupported: string[]; provider: string; model?: string;
  /** The experiment the words name, when the record is not filed anywhere yet. */
  experiment?: { id: string; label: string };
};

export const tidyHeadings = { done: '做了什么', seen: '看到什么', values: '数值', next: '下一步' } as const;

export function tidyPrompt(record: { title: string; words: string }) {
  return {
    system: [
      '你在整理一条实验室快速记录。它多半是口述转写的，可能有错别字、口头语和重复。',
      '整理成：title（不超过 30 个字）；done 做了什么；seen 看到了什么；values 测到或用到的数值；next 下一步。每项一行一句；原话里没有的项留空数组。',
      '数值和单位照原话写，不换算、不四舍五入、不补单位。原话没说的数值、样本、时间和结论一律不加。听不清、前后矛盾或缺关键信息的地方写进 unclear，一句话说明缺什么。',
      '可以改正明显的听写错字（同音字、术语），样本名、编号、试剂名、细胞系名保留原样。',
      '原话提到某个实验的编号（EXP-…）或明确的实验名称时，把它原样写进 experiment；没提到就留空字符串。',
      '只输出一个 JSON 对象，不要其他文字：{"title":"","done":[],"seen":[],"values":[],"next":[],"unclear":[],"experiment":""}',
    ].join('\n'),
    user: JSON.stringify({ title: record.title, words: record.words }),
  };
}

/** The tidied text as the record's markdown: a bold heading over each kind of line, then what is left to confirm. */
export function tidyMarkdown(tidy: EntryTidy) {
  const parts = (Object.keys(tidyHeadings) as (keyof typeof tidyHeadings)[]).filter(key => tidy[key].length)
    .map(key => [`**${tidyHeadings[key]}**`, ...tidy[key].map(line => `- ${line}`)].join('\n'));
  if (tidy.unclear.length) parts.push(['**待确认**', ...tidy.unclear.map(line => `- ${line}`)].join('\n'));
  return parts.join('\n\n');
}

/** The lines a tidy leaves alone: pictures, tables and plate layouts written into the record. */
export const keptLines = (markdown: string) => markdown.split('\n').filter(line => documentMediaFromMarkdown(line) || scientificTableFromMarkdown(line) || plateLayoutFromMarkdown(line) || toolOutputFromMarkdown(line));

/**
 * Numbers and record codes in the draft that the original words do not have (Q339: nothing added). Numbers count by
 * value, and Chinese numerals in the words count too, since dictation often writes "五十" where the draft has 50.
 */
export function unsupportedTokens(draft: string, words: string) {
  const known = new Set([...arabicNumbers(words), ...chineseNumbers(words)]);
  const codes = new Set((words.match(recordCode) ?? []).map(code => code.toUpperCase()));
  // A code is checked whole, so its digits are not counted again as a number.
  const numbers = [...new Set(draft.replace(recordCode, ' ').match(/\d+(?:\.\d+)?/g) ?? [])].filter(text => !known.has(Number(text)));
  return [...numbers, ...[...new Set(draft.match(recordCode) ?? [])].filter(code => !codes.has(code.toUpperCase()))];
}

const recordCode = /\b[A-Za-z]{2,5}-\d{2,}\b/g;
const arabicNumbers = (text: string) => (text.match(/\d+(?:\.\d+)?/g) ?? []).map(Number);

const digit: Record<string, number> = { 零: 0, 〇: 0, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
const unit: Record<string, number> = { 十: 10, 百: 100, 千: 1000, 万: 10000 };

/** The values of Chinese numerals in a text: 五十 → 50, 一万二 → 12000, 一点五 → 1.5, and a run of digits like 二四 → 24. */
export function chineseNumbers(text: string) {
  return (text.match(/[零〇一二两三四五六七八九十百千万]+(?:点[零〇一二三四五六七八九]+)?/g) ?? []).map(run => {
    const [whole, fraction] = run.split('点');
    const integer = [...whole].some(char => char in unit) ? withUnits(whole) : Number([...whole].map(char => digit[char]).join('') || 0);
    return fraction ? Number(`${integer}.${[...fraction].map(char => digit[char]).join('')}`) : integer;
  });
}

function withUnits(text: string) {
  let total = 0, section = 0, current = 0, last = 0;
  for (const char of text) {
    if (char in digit) current = digit[char];
    else if (char === '万') { total += (section + (current || (section ? 0 : 1))) * 10000; section = 0; current = 0; last = 10000; }
    else { section += (current || 1) * unit[char]; current = 0; last = unit[char]; }
  }
  // Spoken shorthand: a last digit right after 百, 千 or 万 counts in the unit below (一万二 is 12000, 两百五 is 250).
  if (current && last >= 100 && unit[text.at(-2) ?? '']) current *= last / 10;
  return total + section + current;
}
