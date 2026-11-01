import { z } from 'zod';
import type { ProtocolSectionKey } from './protocol-document';
import type { SourcePage } from './protocol-anchors';

/**
 * 目录与范围, the first pass of AI 识别: the model reads only the headings and the first lines of every page and says
 * which parts of the source go to which section of the template, which parts to leave out, whether the source gives
 * alternative workflows ("培养细胞 / 组织") or systems chosen once per run ("Mini / Midi / Maxi"), and where it
 * contradicts itself. The author confirms the workflow, the systems, the language of the draft and what to leave out;
 * the second pass then reads only the chosen pages. With one workflow and no systems there is nothing to choose.
 */
export type OutlineUse = ProtocolSectionKey | 'drop' | 'unknown';
export type OutlinePart = { from: number; to: number; label: string; use: OutlineUse; workflow?: string; system?: string };
export type Outline = { parts: OutlinePart[]; workflows: string[]; systems?: { label: string; options: string[] }; conflicts: string[]; read: boolean };
export type RecognitionLanguage = 'zh' | 'source';
/** What the author chose: one workflow, the systems kept, the draft's language, and the parts left out (by index). */
export type ScopeChoice = { workflow?: string; systems?: string[]; language: RecognitionLanguage; dropped: number[] };
/** The choice and the pages the second pass read: what the check of an edited draft needs again. */
export type RecognitionScope = ScopeChoice & { pages: number[] };

/** The digest is the whole source when it is this short; longer sources give each page's headings and first lines. */
const WHOLE_SOURCE_CHARS = 6_000;
const DIGEST_CHARS = 14_000;

/** A line that reads like a heading: short, not a sentence, numbered like a section or a step, or named like one. */
function headingLike(line: string) {
  if (line.length > 70 || /[.。;；,，]$/.test(line)) return false;
  return /^(?:\d+(?:\.\d+)*[.、)]?\s+\S|[A-Z][.)]\s|(?:step|day|part|section|appendix|protocol|procedure)\s*\d*\b|第[一二三四五六七八九十\d]+[章节部分步]|[一二三四五六七八九十]+[、.])/i.test(line)
    || /^(?:[A-Z][A-Za-z-]*)(?:\s+(?:[A-Z][A-Za-z-]*|and|of|for|the|with|to|in|&|,))*\s*(?:\(.*\))?:?$/.test(line)
    || /^(?:materials?|reagents?|procedure|protocol|storage|safety|troubleshooting|references?|appendix|introduction|background|contents|kit contents|before starting|precautions?|notes?|results?)\b/i.test(line)
    || /^(?:产品|试剂盒|储存|保存|运输|注意|安全|原理|简介|概述|材料|试剂|仪器|设备|步骤|操作|实验|结果|常见问题|附录|参考文献|订购)/.test(line);
}

/** What the first pass reads: every page's first lines and headings, with their positions; a short source whole. */
export function outlineDigest(pages: SourcePage[]) {
  const all = pages.flatMap(page => page.lines.map((text, index) => `[p${page.page}:${index + 1}] ${text}`));
  if (all.join('\n').length <= WHOLE_SOURCE_CHARS) return { text: all.join('\n'), whole: true };
  for (const opening of [4, 3, 2, 1]) {
    const lines = pages.flatMap(page => {
      const kept = page.lines.map((text, index) => ({ text, index })).filter(({ text, index }) => index < opening || headingLike(text)).slice(0, opening + 8);
      return [`— 第 ${page.page} 页（${page.lines.length} 行）`, ...kept.map(({ text, index }) => `[p${page.page}:${index + 1}] ${text.length > 120 ? `${text.slice(0, 120)}…` : text}`)];
    });
    const text = lines.join('\n');
    if (text.length <= DIGEST_CHARS || opening === 1) return { text: text.slice(0, DIGEST_CHARS * 1.5), whole: false };
  }
  return { text: '', whole: false };
}

const uses = '说明 / 目的 / 背景 / 材料 / 步骤 / 结果 / 消耗规则 / 不要';

/** The first request: the digest, the Protocol's name and the author's goal; the answer is JSON. */
export function buildOutlinePrompt(input: { pages: SourcePage[]; fileName: string; title?: string; goal?: string }) {
  const digest = outlineDigest(input.pages);
  const system = [
    '你是实验规程整理助手。下面是一份试剂说明书或实验规程的目录：每页的标题和开头几行，行首是位置 [p页:行]。',
    '任务：只判断原文的结构，不整理内容。按下面的 JSON 输出，不要解释，不要代码块。',
    '{',
    `  "parts": [{ "pages": "4-6", "label": "原文这部分的标题", "use": "${uses} 之一", "workflow": "属于哪套流程（可省略）", "system": "只属于哪个体系（可省略）" }],`,
    '  "workflows": ["原文给出的几套互相替代的流程，例如 培养细胞 / 组织；只有一套就留空数组"],',
    '  "systems": { "label": "体系", "options": ["每次实验选一个的规模或体积，例如 Mini、Midi、Maxi；按原文顺序"] },',
    '  "conflicts": ["原文前后不一致的地方，写明两处的说法和页码"]',
    '}',
    '规则：',
    '1. parts 按页码顺序覆盖全部页；一部分可以是一页或连续几页。',
    '2. use：产品介绍、适用范围写“说明”；用途写“目的”；原理、储存运输、安全、厂家参考值写“背景”；试剂盒组分、需自备的材料和仪器写“材料”；操作流程、使用前的准备写“步骤”；要测定、记录的结果写“结果”；用量汇总写“消耗规则”。',
    '3. 订购信息、商标与法律声明、参考文献、联系方式、目录页写“不要”；与本规程无关的附录（另一种样本或另一种用途的流程）也写“不要”。常见问题和故障排除里如果有影响操作的注意事项，写“步骤”。',
    '4. 没有几套流程就写 "workflows": []；没有体系就写 "systems": null。体系是同一流程按不同规模换用量（如 Mini / Midi / Maxi、350 µL / 600 µL），不是不同的流程。',
    '5. 只根据目录判断，不要编造原文没有的部分。',
  ].join('\n');
  const user = [
    `文件：${input.fileName}`,
    input.title ? `规程名称：${input.title}` : '',
    input.goal ? `作者的目标：${input.goal}` : '',
    `共 ${input.pages.length} 页。${digest.whole ? '原文全文' : '目录（每页的标题和开头几行）'}：`,
    digest.text,
  ].filter(Boolean).join('\n');
  return { system, user, chars: digest.text.length };
}

// The page imports this file, so section names are read here rather than through the Word reader.
const useNames: Record<string, OutlineUse> = {
  说明: 'description', 简介: 'description', 目的: 'purpose', 背景: 'background', 原理: 'background', 材料: 'material', 步骤: 'steps', 操作步骤: 'steps',
  结果: 'result_templates', 消耗规则: 'consumption_rules', 不要: 'drop', 删除: 'drop', 舍弃: 'drop',
  description: 'description', purpose: 'purpose', background: 'background', material: 'material', materials: 'material', steps: 'steps',
  results: 'result_templates', result_templates: 'result_templates', consumption_rules: 'consumption_rules', drop: 'drop', none: 'drop',
};
const pageRange = z.union([z.string(), z.number(), z.array(z.union([z.number(), z.string()])), z.object({ from: z.coerce.number(), to: z.coerce.number() })]);
const outlineSchema = z.object({
  parts: z.array(z.object({ pages: pageRange, label: z.string().nullish(), use: z.string().nullish(), workflow: z.string().nullish(), system: z.string().nullish() })).default([]),
  workflows: z.array(z.union([z.string(), z.object({ label: z.string() })])).nullish(),
  systems: z.object({ label: z.string().nullish(), options: z.array(z.string()).default([]) }).nullish(),
  conflicts: z.array(z.string()).nullish(),
});

/** "4-6", "p4–p6", 4, [4, 6] or { from, to }: the pages a part covers, cut at the source's last page. */
function readPages(value: z.infer<typeof pageRange>, count: number): [number, number] | undefined {
  const numbers = typeof value === 'number' ? [value] : Array.isArray(value) ? value.map(Number)
    : typeof value === 'object' ? [value.from, value.to] : (value.match(/\d+/g) ?? []).map(Number);
  const valid = numbers.filter(number => Number.isFinite(number) && number >= 1);
  // A part that starts past the last page names pages the source does not have: it is left out, not moved onto the last one.
  if (!valid.length || valid[0] > count) return undefined;
  return [valid[0], Math.min(Math.max(valid.at(-1)!, valid[0]), count)];
}

/**
 * The model's outline, read leniently: the first JSON object in the answer; unknown sections are kept as "unknown" (read
 * by every batch), pages outside the source are clipped, and pages no part covers become an "unknown" part of their own.
 * An answer that cannot be read gives the whole source as one unknown part, and says so (`read: false`).
 */
export function parseOutline(answer: string, pages: SourcePage[]): Outline {
  const count = Math.max(1, ...pages.map(page => page.page));
  const whole: Outline = { parts: [{ from: 1, to: count, label: '全文', use: 'unknown' }], workflows: [], conflicts: [], read: false };
  const json = answer.replace(/```[a-z]*\n?/gi, '').match(/\{[\s\S]*\}/)?.[0];
  if (!json) return whole;
  let parsed: z.infer<typeof outlineSchema>;
  try { parsed = outlineSchema.parse(JSON.parse(json)); } catch { return whole; }
  const parts: OutlinePart[] = parsed.parts.flatMap(part => {
    const range = readPages(part.pages, count);
    if (!range) return [];
    const name = (part.use ?? '').trim();
    const use: OutlineUse = useNames[name] ?? useNames[name.toLowerCase()] ?? 'unknown';
    return [{ from: range[0], to: range[1], label: (part.label ?? '').trim().slice(0, 80) || `第 ${range[0]}–${range[1]} 页`, use,
      ...(part.workflow?.trim() ? { workflow: part.workflow.trim().slice(0, 40) } : {}), ...(part.system?.trim() ? { system: part.system.trim().slice(0, 40) } : {}) }];
  });
  const given = parts.length;
  const covered = new Set(parts.flatMap(part => Array.from({ length: part.to - part.from + 1 }, (_, index) => part.from + index)));
  for (const page of pages) if (!covered.has(page.page) && page.lines.length) parts.push({ from: page.page, to: page.page, label: `第 ${page.page} 页`, use: 'unknown' });
  parts.sort((a, b) => a.from - b.from);
  const workflows = [...new Set((parsed.workflows ?? []).map(item => (typeof item === 'string' ? item : item.label).trim()).filter(Boolean))].slice(0, 6);
  const options = [...new Set((parsed.systems?.options ?? []).map(option => option.trim()).filter(Boolean))].slice(0, 6);
  return {
    parts: parts.length ? parts : whole.parts, workflows: workflows.length >= 2 ? workflows : [],
    ...(options.length >= 2 ? { systems: { label: parsed.systems?.label?.trim() || '体系', options } } : {}),
    conflicts: (parsed.conflicts ?? []).map(item => item.trim()).filter(Boolean).slice(0, 12), read: given > 0,
  };
}

/** Only a choice between workflows or systems needs the author; otherwise the second pass starts at once. */
export const needsConfirmation = (outline: Outline) => outline.workflows.length >= 2 || (outline.systems?.options.length ?? 0) >= 2;

/** The choice before the author changes anything: the first workflow, every system, the parts the model left out. */
export const defaultChoice = (outline: Outline, language: RecognitionLanguage): ScopeChoice => ({
  ...(outline.workflows.length ? { workflow: outline.workflows[0] } : {}),
  ...(outline.systems ? { systems: outline.systems.options } : {}),
  language, dropped: outline.parts.flatMap((part, index) => part.use === 'drop' ? [index] : []),
});

/** Whether a part is read: not left out, of the chosen workflow (or of none), and of a kept system (or of none). */
export function partKept(part: OutlinePart, index: number, choice: ScopeChoice) {
  if (choice.dropped.includes(index)) return false;
  if (part.workflow && choice.workflow && part.workflow !== choice.workflow) return false;
  if (part.system && choice.systems && !choice.systems.includes(part.system)) return false;
  return true;
}

export type BatchKey = 'front' | 'material' | 'steps' | 'results';
/** The sections each batch of the second pass writes, and the parts it reads (by their use). */
export const batchSections: Record<BatchKey, { sections: ProtocolSectionKey[]; reads: OutlineUse[] }> = {
  front: { sections: ['description', 'purpose', 'background'], reads: ['description', 'purpose', 'background', 'unknown'] },
  material: { sections: ['material'], reads: ['material', 'steps', 'consumption_rules', 'unknown'] },
  steps: { sections: ['steps'], reads: ['steps', 'unknown'] },
  results: { sections: ['result_templates', 'consumption_rules'], reads: ['result_templates', 'consumption_rules', 'steps', 'unknown'] },
};

/**
 * The pages each batch reads: those of the kept parts whose use it reads. A batch with no page of its own (a manual
 * that never names its results) reads the steps' pages; with no steps either, every kept page.
 */
export function batchPages(outline: Outline, choice: ScopeChoice) {
  const kept = outline.parts.filter((part, index) => partKept(part, index, choice));
  const pagesOf = (parts: OutlinePart[]) => [...new Set(parts.flatMap(part => Array.from({ length: part.to - part.from + 1 }, (_, index) => part.from + index)))].sort((a, b) => a - b);
  const all = pagesOf(kept);
  const steps = pagesOf(kept.filter(part => part.use === 'steps' || part.use === 'unknown'));
  const read = (key: BatchKey) => {
    const own = pagesOf(kept.filter(part => batchSections[key].reads.includes(part.use)));
    return own.length ? own : steps.length ? steps : all;
  };
  return { all, front: read('front'), material: read('material'), steps: steps.length ? steps : all, results: read('results') };
}

const sectionUses = ['description', 'purpose', 'background', 'material', 'steps', 'result_templates', 'consumption_rules', 'drop', 'unknown'] as const;
/** An outline and a choice as the page sends them back: checked before they decide what is sent to the model. */
export const outlineInput = z.object({
  parts: z.array(z.object({ from: z.number().int().min(1), to: z.number().int().min(1), label: z.string().max(200), use: z.enum(sectionUses), workflow: z.string().max(80).optional(), system: z.string().max(80).optional() })).min(1).max(200),
  workflows: z.array(z.string().max(80)).max(6), systems: z.object({ label: z.string().max(40), options: z.array(z.string().max(80)).min(2).max(6) }).optional(),
  conflicts: z.array(z.string().max(500)).max(12), read: z.boolean(),
});
export const choiceInput = z.object({
  workflow: z.string().max(80).optional(), systems: z.array(z.string().max(80)).max(6).optional(), language: z.enum(['zh', 'source']), dropped: z.array(z.number().int().min(0)).max(200),
});
export const scopeInput = choiceInput.extend({ pages: z.array(z.number().int().min(1)).max(2000) });
