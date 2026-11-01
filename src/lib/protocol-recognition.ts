import { checkAnchoredRecognition, type RecognitionCheck } from './protocol-anchor-check';
import { numberedLines, readAnchors, stripAnchors, wordsOf, type SourcePage } from './protocol-anchors';
import { convertLegacyProtocol, onlyFor } from './protocol-conversion';
import { sectionFromHeading } from './protocol-docx';
import type { ProtocolSectionKey } from './protocol-document';
import { habitTextToDocument, sectionTitles } from './protocol-habit-text';
import { batchPages, batchSections, buildOutlinePrompt, parseOutline, type BatchKey, type Outline, type RecognitionScope, type ScopeChoice } from './protocol-recognition-scope';
import { numbersIn } from './source-numbers';

export type { LineCheck, RecognitionCheck } from './protocol-anchor-check';

/**
 * AI 识别 (template-v1): a manual or a free-form Protocol organized by the model into the full Word template, then read
 * by the same code as a Word file. Two passes: 目录与范围 (protocol-recognition-scope.ts) says which pages go where; the
 * author confirms; then each section is written from its own pages only, every line citing its source lines, and the
 * anchor check (protocol-anchor-check.ts) reads every line against the lines it cites. One repair round per batch gets
 * the problems back. Drafts organized by habit-v1 (one pass, verbatim, no positions) were saved as ordinary Protocols and
 * open as before.
 */
export const RECOGNITION_PROMPT_VERSION = 'template-v1';
type Complete = (system: string, user: string) => Promise<{ text: string; model?: string; truncated?: boolean }>;
export type RecognitionSource = { pages: SourcePage[]; fileName: string; title?: string; goal?: string };

/** Steps whose pages run longer than this are written in parts, each from its own pages; numbering is redone after. */
const STEP_PART_CHARS = 36_000;
/** Requests at once: two keeps a long manual quick without tripping a service's rate limit. */
const PARALLEL = 2;

/** The first pass: the outline of the source, read from its headings and page openings. */
export async function outlineSource(source: RecognitionSource, complete: Complete) {
  const prompt = buildOutlinePrompt(source);
  const answer = await complete(prompt.system, prompt.user);
  return { outline: parseOutline(answer.text, source.pages), model: answer.model, chars: prompt.chars };
}

type Batch = { key: BatchKey; pages: number[]; part?: { index: number; count: number } };
type Written = { batch: Batch; text: string; check: RecognitionCheck; model?: string; attempts: number; truncated: boolean };

/**
 * The second pass: every batch written from its own pages, checked, repaired once when the check finds problems (the
 * better of the two answers is kept), then put together in the template's order with the program's own 来源 and 范围
 * lines. The whole draft is checked again against everything that was read.
 */
export async function organizeSource(source: RecognitionSource, outline: Outline, choice: ScopeChoice, complete: Complete) {
  const read = batchPages(outline, choice);
  const scope: RecognitionScope = { ...choice, pages: read.all };
  const batches = splitSteps((['front', 'material', 'steps', 'results'] as const).map(key => ({ key, pages: read[key] })), source.pages);
  const run = async (batch: Batch): Promise<Written> => {
    const prompt = buildBatchPrompt(batch, source, outline, choice);
    const first = await complete(prompt.system, prompt.user);
    let text = cleanModelText(first.text), check = batchCheck(text, batch, source.pages, choice), model = first.model, attempts = 1, truncated = Boolean(first.truncated);
    if (!check.ok) {
      const second = await complete(prompt.system, repairRequest(prompt.user, text, check));
      attempts = 2;
      const repaired = cleanModelText(second.text), recheck = batchCheck(repaired, batch, source.pages, choice);
      if (weight(recheck) <= weight(check)) { text = repaired; check = recheck; model = second.model ?? model; truncated = Boolean(second.truncated); }
    }
    return { batch, text, check, model, attempts, truncated };
  };
  const written = await inTurns(batches, run);
  const habitText = composeDraft(source, outline, scope, written);
  return {
    habitText, scope, check: checkAnchoredRecognition(habitText, source.pages, { scopePages: read.all, verbatim: choice.language === 'source' }),
    model: written.find(item => item.model)?.model, calls: written.reduce((sum, item) => sum + item.attempts, 0),
    truncated: written.some(item => item.truncated), sentChars: batches.reduce((sum, batch) => sum + pageText(source.pages, batch.pages).length, 0),
  };
}

/** Text in the template layout as a Protocol: positions dropped, read like a Word file, converted to step blocks. */
export function habitTextProtocol(habitText: string, newId: (prefix: string) => string) {
  const { document, title } = habitTextToDocument(stripAnchors(habitText));
  return { ...convertLegacyProtocol(document, newId), title };
}

/** The model's answer as text in the layout: code fences and lead-in chatter dropped. */
export function cleanModelText(text: string) {
  const lines = text.replace(/```[a-z]*\n?/gi, '').split(/\r?\n/);
  const start = lines.findIndex(line => /^\s*(标题|说明|目的|背景|材料|步骤|体系|结果|消耗规则)\s*[：:]?|^\s*\d+\s*[.、]|^\s*[-•]\s*\S/.test(line));
  return (start > 0 ? lines.slice(start) : lines).join('\n').trim();
}

/** Steps over `STEP_PART_CHARS` become several batches of whole pages, in order. */
function splitSteps(batches: Batch[], pages: SourcePage[]): Batch[] {
  return batches.flatMap(batch => {
    if (batch.key !== 'steps' || pageText(pages, batch.pages).length <= STEP_PART_CHARS) return [batch];
    const groups: number[][] = [[]];
    for (const page of batch.pages) {
      const current = groups.at(-1)!;
      if (current.length && pageText(pages, [...current, page]).length > STEP_PART_CHARS) groups.push([page]); else current.push(page);
    }
    return groups.map((group, index) => ({ key: 'steps' as const, pages: group, part: { index: index + 1, count: groups.length } }));
  });
}

async function inTurns<T, R>(items: T[], work: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(PARALLEL, items.length) }, async () => {
    for (let index = next++; index < items.length; index = next++) results[index] = await work(items[index]);
  }));
  return results;
}

const pageText = (pages: SourcePage[], numbers: number[]) => numberedLines(pages.filter(page => numbers.includes(page.page)));
const weight = (check: RecognitionCheck) => check.unverified * 2 + check.missing.length;

/** A batch is checked by its own lines; only the steps are also asked for every amount line on their pages. */
function batchCheck(text: string, batch: Batch, pages: SourcePage[], choice: ScopeChoice) {
  const check = checkAnchoredRecognition(text, pages, { scopePages: batch.key === 'steps' ? batch.pages : [], verbatim: choice.language === 'source' });
  return batch.key === 'steps' ? check : { ...check, ok: check.unverified === 0 };
}

const languageRule: Record<ScopeChoice['language'], string> = {
  zh: '3. 其余文字写中文，可以翻译和精简：一句写清一个操作，不写原文的客套和重复；试剂名、货号、仪器型号保留原文写法。',
  source: '3. 逐句照抄原文措辞，原文是英文就保留英文；不改写、不合并句子。',
};

const formats: Record<BatchKey, string[]> = {
  front: [
    '只写“标题”“说明”“目的”“背景”四栏，格式：',
    '标题：规程名称（中文名，原文名称写在括号里）',
    '说明：',
    '体系对应：原文各体系的名称、货号或规格如何对应（没有体系就不写）〔…〕',
    '原文差异：原文前后不一致的一处，写明两种说法，结尾写“（待作者选定）”〔两处的位置〕',
    '目的：',
    '一句话：这个规程做什么、得到什么〔…〕',
    '背景：',
    '原理：…〔…〕',
    '储存：储存和运输条件、有效期、配好的溶液怎么保存〔…〕',
    '安全：危险化学品和防护要求〔…〕',
    '厂家参考值，不是验收标准：典型产量、柱容量、纯度、内毒素等厂家给出的参考值〔…〕',
    '说明栏不要写来源和范围，程序会写。原文没有的项目整行不写。',
  ],
  material: [
    '只写“材料”一栏，格式：',
    '材料：',
    '- 名称 | 用量 | 说明〔…〕',
    '用量写每次实验的用量：不同体系写成“a/b/c 单位”，顺序与体系一致；包装规格、配制量、货号、浓度和储存写在说明里。',
    '原文没有给每次用量的，用量写“按需”。试剂盒组分、需自备的试剂、耗材和仪器都列出，每样一行。',
  ],
  steps: [
    '只写“步骤”一栏，格式：',
    '步骤：',
    '体系：A / B / C〔…〕（作者确认的体系，原样照写；没有体系就不写这一行）',
    '1. 首次使用前：试剂的配制、复溶、加入 RNase 等准备工作〔…〕',
    '2. 一个操作一行，以“1.”“2.”编号，不同体系的用量写成“a/b/c 单位”〔…〕',
    '本步的补充说明、注意事项，单独一行，不编号〔…〕',
    '3. 仅<条件>：只适用于部分样本或部分情况的操作〔…〕',
    '储存条件、首次使用前的配制和安全注意不要丢：配制写成开头的准备步骤；常见问题里影响操作的注意事项写进对应步骤的补充说明。',
  ],
  results: [
    '只写“结果”和“消耗规则”两栏，格式：',
    '结果：',
    '结果模板的名称（一行，不带位置）',
    '记录：每次实验要记录的项目，用顿号分隔〔…〕',
    '每个样本：每个样本要记录或测定的项目，用顿号分隔〔…〕',
    '消耗规则：',
    '<试剂> 每次 a/b/c 单位（原文给出每次用量时才写；没有就整栏不写）〔…〕',
    '只写原文要求测定、观察或记录的项目；原文没有就不写“记录：”行。',
  ],
};

/** One batch's request: the shared rules, its own layout, what the author chose, and only its own pages, numbered. */
function buildBatchPrompt(batch: Batch, source: RecognitionSource, outline: Outline, choice: ScopeChoice) {
  const system = [
    '你是实验规程整理助手。把原文（试剂说明书或实验规程）整理成实验室软件导入用的规程模板的一部分。原文每行开头是它的位置 [p页:行]。',
    '规则：',
    '1. 每一行末尾写出它依据的原文位置：〔p3:12〕或〔p3:12–14〕，几处用逗号隔开〔p16:5, p20:7〕。只写真正依据的行，不要编造位置。',
    '2. 数值、单位、浓度、试剂名、货号照原文写，不换算、不推算，不补充原文没有的数值；单位可以统一写成 µL、mL、×g、°C。',
    languageRule[choice.language],
    '4. 只写原文有的内容。原文没有给出的（如抗生素浓度、验收标准）不要补写；需要提醒时写“原文未给出”。',
    '5. 只输出下面的格式的纯文本，不要解释，不要代码块。',
    ...formats[batch.key],
  ].join('\n');
  const kept = outline.parts.filter((_, index) => !choice.dropped.includes(index));
  const user = [
    `文件：${source.fileName}`,
    source.title ? `规程名称：${source.title}` : '',
    source.goal ? `作者的目标：${source.goal}` : '',
    choice.workflow ? `只整理这套流程：${choice.workflow}（其他流程的内容不要写）` : '',
    choice.systems?.length ? `体系：${choice.systems.join(' / ')}（作者已确认；用量按这个顺序写）` : '',
    choice.dropped.length ? `作者不要的部分：${choice.dropped.map(index => outline.parts[index]).filter(Boolean).map(part => `${part.label}（第 ${part.from}–${part.to} 页）`).join('；')}` : '',
    batch.key === 'front' && outline.conflicts.length ? `目录里看到的原文差异（核对后写进“原文差异”）：\n${outline.conflicts.map(item => `- ${item}`).join('\n')}` : '',
    batch.part ? `步骤较长，分 ${batch.part.count} 段整理，这是第 ${batch.part.index} 段：只写这几页里的步骤，编号从 1 开始${batch.part.index > 1 ? '，不写体系行' : ''}。` : '',
    kept.length > 1 ? `原文各部分：${kept.map(part => `${part.label}（第 ${part.from}–${part.to} 页）`).join('；')}` : '',
    `原文（第 ${pageRanges(batch.pages)} 页）：`,
    pageText(source.pages, batch.pages),
  ].filter(Boolean).join('\n');
  return { system, user };
}

/** The repair request: the same rules and pages, the last answer, and what the check found wrong with it. */
function repairRequest(user: string, previous: string, check: RecognitionCheck) {
  const problems = [
    ...check.lines.filter(line => !line.verified).map(line => `- “${line.line}”：${line.problems.join('；')}`),
    ...check.missing.map(line => `- 原文这一行有用量，没有任何一行指向它：${line}`),
  ];
  return `${user}\n\n上一次的整理结果：\n${previous}\n\n核对发现的问题：\n${problems.join('\n')}\n\n请按规则改正：位置写原文真正依据的行；数值、名称只用所指原文里的；漏掉的操作补上。输出这一部分的完整整理结果。`;
}

/** "1–3、5、7–9": pages as a reader writes them. */
export function pageRanges(pages: number[]) {
  const sorted = [...new Set(pages)].sort((a, b) => a - b), out: string[] = [];
  for (let index = 0; index < sorted.length; index += 1) {
    let end = index;
    while (sorted[end + 1] === sorted[end] + 1) end += 1;
    out.push(end > index ? `${sorted[index]}–${sorted[end]}` : `${sorted[index]}`);
    index = end;
  }
  return out.join('、');
}

/** A batch's answer by section: a heading line opens a section; lines under a section the batch does not write are dropped. */
function sectionsOf(text: string, key: BatchKey) {
  const own = batchSections[key].sections;
  const out = new Map<ProtocolSectionKey, string[]>();
  let current: ProtocolSectionKey | undefined = own[0], title: string | undefined;
  for (const line of text.split(/\r?\n/).map(item => item.trim()).filter(Boolean)) {
    const bare = readAnchors(line).text;
    const titled = bare.match(/^标题\s*[：:]\s*(.+)$/);
    if (titled) { title = titled[1].trim(); continue; }
    const heading = sectionFromHeading(bare.replace(/[：:]\s*$/, '').trim());
    if (heading) { current = heading; continue; }
    const inline = line.match(/^([^：:〔]{1,8})\s*[：:]\s*(.+)$/);
    const named = inline ? sectionFromHeading(inline[1].trim()) : undefined;
    if (named && own.includes(named)) { current = named; out.set(named, [...(out.get(named) ?? []), inline![2].trim()]); continue; }
    if (current && own.includes(current)) out.set(current, [...(out.get(current) ?? []), line]);
  }
  return { sections: out, title };
}

const languageNames: Record<ScopeChoice['language'], string> = { zh: '中文整理（数值、单位、试剂名、货号照原文）', source: '保留原文措辞' };

/**
 * The draft in the template's order. 来源 and 范围 are the program's: the file, the pages read, the workflow, the
 * systems, the language and the parts left out, as the author confirmed them. Steps from several parts are numbered
 * again from 1, and only the first "体系：" line is kept.
 */
function composeDraft(source: RecognitionSource, outline: Outline, scope: RecognitionScope, written: Written[]) {
  const parts = written.map(item => sectionsOf(item.text, item.batch.key));
  const lines = (key: ProtocolSectionKey) => parts.flatMap(part => part.sections.get(key) ?? []);
  const total = Math.max(0, ...source.pages.map(page => page.page));
  const dropped = scope.dropped.map(index => outline.parts[index]).filter(Boolean).map(part => `${part.label}（第 ${part.from === part.to ? part.from : `${part.from}–${part.to}`} 页）`);
  const range = [
    scope.workflow ? `只含“${scope.workflow}”流程` : '',
    scope.systems?.length ? `体系 ${scope.systems.join(' / ')}` : '',
    languageNames[scope.language],
    dropped.length ? `不含：${dropped.join('、')}` : '',
  ].filter(Boolean).join('；');
  let step = 0, systemsLine = false;
  const steps = lines('steps').flatMap(line => {
    if (/^\s*体系\s*[：:]/.test(line)) { if (systemsLine) return []; systemsLine = true; return [line]; }
    return [line.replace(/^\s*\d+\s*(?:[、)）．]|\.(?!\d))\s*/, () => `${++step}. `)];
  });
  const body: [ProtocolSectionKey, string[]][] = [
    ['description', [`来源：${source.fileName}${total > 1 ? `，读取第 ${pageRanges(scope.pages)} 页（共 ${total} 页）` : ''}`, ...(range ? [`范围：${range}`] : []), ...lines('description')]],
    ['purpose', lines('purpose')], ['background', lines('background')], ['material', lines('material')], ['steps', steps],
    ['result_templates', lines('result_templates')], ['consumption_rules', lines('consumption_rules')],
  ];
  const title = source.title?.trim() || parts.find(part => part.title)?.title;
  return [...(title ? [`标题：${title}`] : []), ...body.flatMap(([key, items]) => items.length ? [`${sectionTitles[key]}：`, ...items] : [])].join('\n');
}

/**
 * The check of a text written without positions (a source read as written, then edited by the author): every line
 * against the whole original, words from one place and every number present. `missing`: sentences of the original that
 * carry an amount and appear nowhere in the text. A text with positions is checked by `checkAnchoredRecognition`.
 */
export function checkRecognition(habitText: string, source: string): RecognitionCheck {
  const sentences = splitSentences(source);
  const tokenSets = sentences.map(sentence => new Set(wordsOf(sentence)));
  const windows = tokenSets.map((set, index) => new Set([...set, ...(tokenSets[index + 1] ?? []), ...(tokenSets[index + 2] ?? [])]));
  const check = against({ windows: windows.length ? windows : [new Set()], numbers: new Set(numbersIn(source)) });
  const lines: RecognitionCheck['lines'] = [];
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
  const resultWords = new Set(wordsOf(habitText)), resultNumbers = new Set(numbersIn(habitText));
  const candidates = sentences.filter(sentence => quantity.test(fold(sentence)));
  const missing = candidates.filter(sentence => {
    const words = [...new Set(wordsOf(sentence))];
    const shared = words.length ? words.filter(word => resultWords.has(word)).length / words.length : 1;
    return !(numbersIn(sentence).every(number => resultNumbers.has(number)) && shared >= 0.5);
  }).map(sentence => sentence.length > 80 ? `${sentence.slice(0, 80)}…` : sentence);
  const unverified = lines.filter(line => !line.verified).length;
  return { lines, unverified, missing, ok: unverified === 0 && missing.length <= Math.max(2, Math.ceil(candidates.length * 0.1)) };
}

const fold = (text: string) => text.normalize('NFKC').toLowerCase().replace(/×/g, 'x');
const splitSentences = (text: string) => text.split(/[。；;！!？?\n]|\.(?=\s)/).map(sentence => sentence.trim()).filter(Boolean);

/** How a line or an item reads against the original: its words found together in one place, every number present. */
function against(source: { windows: Set<string>[]; numbers: Set<string> }) {
  return (text: string) => {
    const problems: string[] = [];
    const words = [...new Set(wordsOf(text))];
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
