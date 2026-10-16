import { z } from 'zod';
import { extractJsonPayload } from './ai';

/** One statement the model makes about a method, with the words of the source it rests on. */
const field = z.object({ text: z.string().trim().min(1).max(500), quote: z.string().trim().max(600).default('') });
export const methodCardSchema = z.object({
  summary: z.string().trim().max(600).default(''),
  applicability: z.array(field).max(12).default([]),
  sampleRequirements: z.array(field).max(12).default([]),
  materials: z.array(field).max(40).default([]),
  keyParameters: z.array(field).max(40).default([]),
  differences: z.array(field).max(12).default([]),
  risks: z.array(field).max(12).default([]),
  duration: z.string().trim().max(120).default(''),
});
export type MethodCardRaw = z.infer<typeof methodCardSchema>;
export type CheckedField = { text: string; quote: string; verified: boolean };
export type MethodCard = {
  summary: string; duration: string;
  applicability: CheckedField[]; sampleRequirements: CheckedField[]; materials: CheckedField[]; keyParameters: CheckedField[]; differences: CheckedField[]; risks: CheckedField[];
  unverified: number; provider?: string; model?: string; madeAt: string; byHand?: boolean;
};
export const methodCardSections: Array<{ key: keyof Pick<MethodCard, 'applicability' | 'sampleRequirements' | 'materials' | 'keyParameters' | 'differences' | 'risks'>; label: string }> = [
  { key: 'applicability', label: '适用条件' }, { key: 'sampleRequirements', label: '样本要求' }, { key: 'materials', label: '材料与设备' },
  { key: 'keyParameters', label: '关键参数' }, { key: 'differences', label: '操作差异与要点' }, { key: 'risks', label: '风险与注意' },
];

export const MAX_METHOD_TEXT_CHARS = 24_000;
const fold = (text: string) => text.toLowerCase().replace(/\s+/g, ' ').replace(/[“”"'‘’`]/g, '').trim();

/** The prompt that fills a card for one method: strict JSON, every statement backed by a verbatim quote from the text. */
export function buildMethodCardPrompt(input: { goal: string; sampleType?: string; conditions?: string; title: string; text: string }) {
  const text = input.text.length > MAX_METHOD_TEXT_CHARS ? `${input.text.slice(0, MAX_METHOD_TEXT_CHARS)}\n[文本已截断]` : input.text;
  const system = [
    '你是实验方法整理助手。只根据给出的方法原文填写方法卡，不补充原文没有的内容，不猜测数值。',
    '输出必须是一个 JSON 对象，不要任何解释文字。字段：summary（一句话概括，中文）、duration（总用时，原文没有则留空）、',
    'applicability、sampleRequirements、materials、keyParameters、differences、risks 六个数组，每项为 {"text": "中文表述", "quote": "原文中逐字摘录的依据片段"}。',
    'quote 必须是原文中连续出现的原话（可短，30 字以内即可），不能改写；找不到依据的表述不要写。keyParameters 的 text 要写明数值和单位。',
    'differences 写与常规做法或与研究目标相关的差异和要点。',
  ].join('');
  const user = `研究目标：${input.goal}\n样本类型：${input.sampleType || '未说明'}\n实验条件：${input.conditions || '未说明'}\n\n方法标题：${input.title}\n方法原文：\n${text}`;
  return { system, user, truncated: input.text.length > MAX_METHOD_TEXT_CHARS };
}

export function parseMethodCard(raw: string): MethodCardRaw {
  const payload = extractJsonPayload(raw);
  const start = payload.indexOf('{'), end = payload.lastIndexOf('}');
  const parsed = JSON.parse(start >= 0 && end > start ? payload.slice(start, end + 1) : payload);
  return methodCardSchema.parse(parsed);
}

/**
 * Every statement is checked against the text it claims to rest on (the same idea as the extraction proposal check):
 * a quote that is not in the source leaves the statement marked 未核实, never dropped silently.
 */
export function checkMethodCard(raw: MethodCardRaw, sourceText: string, meta: { provider?: string; model?: string } = {}): MethodCard {
  const haystack = fold(sourceText);
  const check = (fields: Array<{ text: string; quote: string }>): CheckedField[] => fields.map(item => ({ text: item.text, quote: item.quote, verified: item.quote.length >= 4 && haystack.includes(fold(item.quote)) }));
  const card = { summary: raw.summary, duration: raw.duration, applicability: check(raw.applicability), sampleRequirements: check(raw.sampleRequirements), materials: check(raw.materials), keyParameters: check(raw.keyParameters), differences: check(raw.differences), risks: check(raw.risks) };
  const unverified = methodCardSections.reduce((count, section) => count + card[section.key].filter(item => !item.verified).length, 0);
  return { ...card, unverified, ...meta, madeAt: new Date().toISOString() };
}

/** A card written by hand (no model): every line counts as the author's own and is not marked unverified. */
export function manualMethodCard(summary: string, lines: Partial<Record<(typeof methodCardSections)[number]['key'], string[]>>): MethodCard {
  const own = (items: string[] | undefined): CheckedField[] => (items ?? []).map(text => text.trim()).filter(Boolean).map(text => ({ text, quote: '', verified: true }));
  return { summary: summary.trim(), duration: '', applicability: own(lines.applicability), sampleRequirements: own(lines.sampleRequirements), materials: own(lines.materials), keyParameters: own(lines.keyParameters), differences: own(lines.differences), risks: own(lines.risks), unverified: 0, madeAt: new Date().toISOString(), byHand: true };
}
