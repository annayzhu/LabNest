import { convertLegacyProtocol, onlyFor } from './protocol-conversion';
import { sectionFromHeading } from './protocol-docx';
import { habitTextToDocument } from './protocol-habit-text';

/**
 * AI 识别: a manual or a free-form Protocol laid out "by habit" by the model, then read by the same code as a
 * Word file. The model only rearranges the original's own sentences; every line it writes is checked against the
 * original (words from one place, every number present), and one repair round gets the problems back.
 */
export const RECOGNITION_PROMPT_VERSION = 'habit-v1';
const MAX_RECOGNITION_SOURCE_CHARS = 30_000;
type Complete = (system: string, user: string) => Promise<{ text: string; model?: string }>;

type LineCheck = { line: string; verified: boolean; problems: string[] };
export type RecognitionCheck = { lines: LineCheck[]; unverified: number; missing: string[]; ok: boolean };

/**
 * The model lays the original out; the check reads every line; when it fails, one repair round sends the problems back
 * and the better of the two answers is kept. The result is text in the habit layout, ready for `habitTextProtocol`.
 */
export async function recognizeProtocolText(source: string, complete: Complete) {
  const prompt = buildRecognitionPrompt(source);
  // Only what the model was given can be checked: a sentence after the cut was never its to keep.
  const sent = sentToModel(source);
  const first = await complete(prompt.system, prompt.user);
  let habitText = cleanModelText(first.text), check = checkRecognition(habitText, sent), model = first.model, attempts = 1;
  if (!check.ok) {
    const repair = buildRepairPrompt(source, habitText, check);
    const second = await complete(repair.system, repair.user);
    attempts = 2;
    const repaired = cleanModelText(second.text), recheck = checkRecognition(repaired, sent);
    if (weight(recheck) <= weight(check)) { habitText = repaired; check = recheck; model = second.model ?? model; }
  }
  return { habitText, check, attempts, model, truncated: prompt.truncated };
}

/** Text in the habit layout as a Protocol: read like a Word file, converted to step blocks, chips and result templates. */
export function habitTextProtocol(habitText: string, newId: (prefix: string) => string) {
  const { document, title } = habitTextToDocument(habitText);
  return { ...convertLegacyProtocol(document, newId), title };
}

/** The part of the original the model is given: a manual cut at the size the model reliably reads. Checks use the same part. */
export const sentToModel = (source: string) => source.slice(0, MAX_RECOGNITION_SOURCE_CHARS);

/**
 * Every line of the laid-out text checked against the original. Headings are structure; "体系：", "仅…：", "记录：",
 * material lines and step numbers are read for their content. `missing`: sentences of the original that carry an amount
 * and appear nowhere in the result, the operations the model most likely dropped.
 */
export function checkRecognition(habitText: string, source: string): RecognitionCheck {
  const sentences = splitSentences(source);
  const tokenSets = sentences.map(sentence => new Set(tokens(sentence)));
  const windows = tokenSets.map((set, index) => new Set([...set, ...(tokenSets[index + 1] ?? []), ...(tokenSets[index + 2] ?? [])]));
  const check = against({ windows: windows.length ? windows : [new Set()], numbers: new Set(numbersIn(source)) });
  const lines: LineCheck[] = [];
  for (const raw of habitText.split(/\r?\n/).map(line => line.trim()).filter(Boolean)) {
    if (sectionFromHeading(raw.replace(/[：:]\s*$/, '').trim())) continue;
    const inline = raw.match(/^([^：:]{1,8})\s*[：:]\s*(.*)$/);
    const label = inline?.[1].trim();
    let problems: string[];
    if (inline && label && /^(记录|每个样本|每个样品)$/.test(label)) {
      problems = inline[2].split(/[、，,；;]/).map(item => item.replace(/[*＊]$/, '').replace(/[（(][^）)]*[）)]$/, '').trim()).filter(Boolean)
        .flatMap(item => check(item).length ? [`记录项原文中找不到：${item}`] : []);
    } else if (inline && label && (label === '标题' || label === '体系' || sectionFromHeading(label))) {
      problems = check(inline[2]);
    } else {
      const material = raw.match(/^\s*[-•*·]\s*(.+)$/);
      let text = material ? material[1].split(/\s*[|｜\t]\s*/).join(' ') : raw.replace(stepNumber, '');
      const scope = text.match(onlyFor);
      problems = scope ? check(scope[1]).map(problem => `条件“${scope[1]}”${problem}`) : [];
      if (scope) text = text.slice(scope[0].length);
      problems.push(...check(text));
    }
    lines.push({ line: raw, verified: !problems.length, problems });
  }
  const resultWords = new Set(tokens(habitText)), resultNumbers = new Set(numbersIn(habitText));
  const candidates = sentences.filter(sentence => quantity.test(fold(sentence)));
  const missing = candidates.filter(sentence => {
    const words = [...new Set(tokens(sentence))];
    const shared = words.length ? words.filter(word => resultWords.has(word)).length / words.length : 1;
    return !(numbersIn(sentence).every(number => resultNumbers.has(number)) && shared >= 0.5);
  }).map(sentence => sentence.length > 80 ? `${sentence.slice(0, 80)}…` : sentence);
  const unverified = lines.filter(line => !line.verified).length;
  return { lines, unverified, missing, ok: unverified === 0 && missing.length <= Math.max(2, Math.ceil(candidates.length * 0.1)) };
}

/** The model's answer as text in the layout: code fences and lead-in chatter dropped. */
export function cleanModelText(text: string) {
  const lines = text.replace(/```[a-z]*\n?/gi, '').split(/\r?\n/);
  const start = lines.findIndex(line => /^\s*(标题|说明|材料|步骤|体系)\s*[：:]?|^\s*\d+\s*[.、]/.test(line));
  return (start > 0 ? lines.slice(start) : lines).join('\n').trim();
}

const format = [
  '标题：（照抄原文标题）',
  '说明：（一句，照抄原文）',
  '材料：',
  '- 名称 | 用量 | 说明',
  '步骤：',
  '体系：350 µL / 600 µL',
  '1. 第一步，照抄原文；不同体系的用量写成 350/600 µL',
  '本步的补充说明，照抄原文，不编号',
  '2. 仅富脂样本：只适用于部分样本的一步，照抄原文',
  '结果：',
  '记录：浓度 ng/µL、A260/280',
].join('\n');

/** The first request: the rules, the layout, and the original as sent. */
function buildRecognitionPrompt(source: string) {
  const truncated = source.length > MAX_RECOGNITION_SOURCE_CHARS;
  const text = sentToModel(source);
  const system = [
    '你是实验规程整理助手。把给出的原文（试剂说明书或实验规程）整理成下面的格式，供实验室软件读取。',
    '规则：',
    '1. 只用原文的句子和数值，逐句照抄原文措辞（原文是英文就保留英文）；不改写、不合并句子、不补充、不推算任何数值。',
    '2. 只保留做实验需要的内容：材料、操作步骤、要记录的结果。公司介绍、订购信息、产品规格、储存运输、常见问题、参考文献都不要。',
    '3. 每个操作一行，以“1.”“2.”编号；同一步的补充说明写在下一行，不编号。',
    '4. 原文对不同样本量或体积给出不同用量时，在第一步前写一行“体系：A / B”，A、B 照抄原文的条件；对应用量写成“a/b 单位”，顺序与体系一致。没有这种情况就不写体系行。',
    '5. 只适用于部分样本的步骤，开头写“仅<条件>：”，条件照抄原文。',
    '6. “记录：”只写原文要求记录或测定的项目，用顿号分隔；原文没有就不写。',
    '7. 只输出这个格式的纯文本，不要解释，不要代码块。',
    '格式：',
    format,
  ].join('\n');
  return { system, user: `${truncated ? `原文（只截取了前 ${MAX_RECOGNITION_SOURCE_CHARS} 字）` : '原文'}：\n${text}`, truncated };
}

/** The repair request: the same rules and original, the last answer, and what the check found wrong with it. */
function buildRepairPrompt(source: string, previous: string, check: RecognitionCheck) {
  const { system, user } = buildRecognitionPrompt(source);
  const problems = [
    ...check.lines.filter(line => !line.verified).map(line => `- “${line.line}”：${line.problems.join('；')}`),
    ...check.missing.map(sentence => `- 原文这句操作没有出现：“${sentence}”`),
  ];
  return { system, user: `${user}\n\n上一次的整理结果：\n${previous}\n\n核对发现的问题：\n${problems.join('\n')}\n\n请按规则改正：找不到出处的行改成原文原句或删去，数值只用原文的，漏掉的操作照抄补上。输出完整的整理结果。` };
}

const fold = (text: string) => text.normalize('NFKC').toLowerCase().replace(/×/g, 'x');
const numbersIn = (text: string) => (fold(text).match(/\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?/g) ?? []).map(number => number.replace(/,/g, ''));
/** The words of a text without its numbers or punctuation: Latin words whole, Chinese as overlapping pairs. */
function tokens(text: string) {
  const out: string[] = [];
  const skeleton = fold(text).replace(/\d+(?:[.,]\d+)*/g, ' ').replace(/[\s\p{P}\p{S}]+/gu, ' ');
  for (const run of skeleton.match(/[一-鿿]+|[^\s一-鿿]+/g) ?? []) {
    if (/^[一-鿿]+$/.test(run)) { if (run.length === 1) out.push(run); else for (let i = 0; i < run.length - 1; i += 1) out.push(run.slice(i, i + 2)); }
    else out.push(run);
  }
  return out;
}
const splitSentences = (text: string) => text.split(/[。；;！!？?\n]|\.(?=\s)/).map(sentence => sentence.trim()).filter(Boolean);

/** How a line or an item reads against the original: its words found together in one place, every number present. */
function against(source: { windows: Set<string>[]; numbers: Set<string> }) {
  return (text: string) => {
    const problems: string[] = [];
    const words = [...new Set(tokens(text))];
    if (words.length) {
      const best = Math.max(0, ...source.windows.map(window => words.filter(word => window.has(word)).length / words.length));
      if (best < 0.8) problems.push(`原文中找不到出处（最接近的一处只对上 ${Math.round(best * 100)}%）`);
    }
    const absent = numbersIn(text).filter(number => !source.numbers.has(number));
    if (absent.length) problems.push(`数值不在原文：${[...new Set(absent)].join('、')}`);
    return problems;
  };
}

const quantity = /\d+(?:\.\d+)?\s*(?:μl|ml|l\b|mg|μg|ng|g\b|min|s\b|h\b|°c|rpm|xg|x g|%|mm|μm|nm)/;
const stepNumber = /^\s*\d+\s*(?:[、)）．]|\.(?!\d))\s*/;

const weight = (check: RecognitionCheck) => check.unverified * 2 + check.missing.length;
