/**
 * The evaluation set for 整理说明书或非模板规程: real manuals and Protocols with hand-checked expectations,
 * scored the same way every time a prompt or a model changes.
 *
 *   DATABASE_URL=postgresql://…/<test database> LABNEST_AI_ENCRYPTION_KEY=… \
 *     npx tsx scripts/eval-protocol-recognition.ts [--provider <AI 设置里的服务名称>] [--case <name>] [--language zh|source] [--rescore]
 *
 * Cases live outside the repository, in .local-runtime/protocol-recognition-eval/cases/<name>/: one source file
 * (source.pdf, source.docx, source.txt or source.md), expected.json, and optionally hand.docx, the same manual organized
 * by hand into the Word template. Without --provider nothing is sent anywhere: the rules reading is scored, and the
 * anchor check is run on the hand conversion (each line given the source lines that best support it) to show how often
 * it would flag a careful draft, and whether it catches swapped per-system values. With --provider the two-pass AI
 * reading (template-v1) is scored too, against Q299's thresholds; AI must be switched on in AI 设置 (this script obeys
 * the same switch), and the manuals are sent to that service. `--rescore` scores that service's saved drafts in outputs/
 * again without calling it: use it after changing the expectations or the scoring, so the manuals are sent only once.
 */
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { resolveAdapterForProvider } from '../src/lib/ai-server';
import { prisma } from '../src/lib/db';
import { checkAnchoredRecognition, type RecognitionCheck } from '../src/lib/protocol-anchor-check';
import { amountsIn, foldAmounts, identifiersIn, latinNamesIn, nameIn, readAnchors, wordsOf, type SourcePage } from '../src/lib/protocol-anchors';
import type { ConversionSummary } from '../src/lib/protocol-conversion';
import { chipSymbolGlyphs, protocolChipText } from '../src/lib/protocol-chips';
import { parseProtocolDocxBytes } from '../src/lib/protocol-docx';
import { projectProtocolDocument, type ProtocolContentBlock, type ProtocolDocument } from '../src/lib/protocol-document';
import { sectionTitles } from '../src/lib/protocol-habit-text';
import { habitTextProtocol, organizeSource, outlineSource, RECOGNITION_PROMPT_VERSION } from '../src/lib/protocol-recognition';
import { batchPages, defaultChoice, outlineDigest } from '../src/lib/protocol-recognition-scope';
import { readAsWritten } from '../src/lib/protocol-recognition.server';
import { readSourceFile } from '../src/lib/protocol-source-text.server';

type Expected = {
  /** How many steps a careful reader counts. */
  steps: number;
  /** One phrase per step, in order: the step's text should contain it. */
  stepKeywords?: string[];
  /** Per step of the hand conversion, the words that name it; `a|b` accepts either wording. Step recall counts these. */
  stepKeys?: string[][];
  /** Amounts that should become chips, as they read: "350/600 µL", "12000 ×g", "2 min". */
  parameters?: string[];
  /** Key amounts of the hand conversion ("0.4/4/10 mL", "4000 ×g"): how many a reading states anywhere. */
  keyNumbers?: string[];
  /** Names of the choices the Protocol depends on ("体系"), conditions ("富脂"), and what to record ("A260/280"). */
  systems?: string[];
  conditions?: string[];
  record?: string[];
};
type Reading = { document: ProtocolDocument; summary: ConversionSummary };

/** Q299: per service, key amounts with positions 100% right, step recall ≥ 90%, unverified lines ≤ 10%. */
const thresholds = { anchoredAmounts: 1, stepRecall: 0.9, unverifiedShare: 0.1 };
/** habit-v1 cut a manual at this length; the two passes read every chosen page. */
const OLD_CUT = 30_000;

const root = '.local-runtime/protocol-recognition-eval';
const argument = (name: string) => { const index = process.argv.indexOf(`--${name}`); return index > 0 ? process.argv[index + 1] : undefined; };
let n = 0;
const newId = (prefix: string) => `${prefix}-eval-${++n}`;
const glyphs = new RegExp(`[${Object.values(chipSymbolGlyphs).join('')}]`, 'g');
// A chip reads with the mark of its system ("▲ 50 / ■ 200 µL"): the marks are presentation, not part of the amount.
const fold = (text: string) => foldAmounts(text).toLowerCase().replace(/×/g, 'x').replace(/[–—~～]/g, '-').replace(glyphs, '').replace(/\s+/g, '');
/** An expected word or amount, with alternatives written "a|b": a Chinese reading and an English one both count. */
const holds = (text: string, key: string) => key.split('|').some(option => text.includes(fold(option)));
const percent = (value: number | undefined) => value === undefined ? '—' : `${(value * 100).toFixed(0)}%`;

/** Each part of the score is a fraction from 0 to 1; a part without an expectation is left out of the mean. */
function score(reading: Reading, expected: Expected) {
  const projection = projectProtocolDocument(reading.document);
  // Amounts are chips by now ("{{p-64}}"): put their values back, or no expected amount is ever found.
  const read = (text: string) => fold(text.replace(/\{\{([\w-]+)\}\}/g, (_, id: string) => protocolChipText(id, reading.document.systems)));
  const stepTexts = projection.steps.map(step => read(`${step.title} ${step.description ?? ''}`));
  const chips = new Set(reading.summary.chips.map(fold));
  const systems = (reading.document.systems?.dimensions ?? []).map(dimension => fold(dimension.label));
  const conditions = reading.summary.conditions.map(fold);
  const record = projection.resultTemplates.flatMap(template => [...template.fields.map(field => field.label ?? field.name ?? ''), ...(template.artifacts ?? []).map(artifact => artifact.label)]).map(fold);
  const everything = read(JSON.stringify(reading.document));
  const share = (wanted: string[] | undefined, found: (item: string, index: number) => boolean) => wanted?.length ? wanted.filter(found).length / wanted.length : undefined;
  const keys = expected.stepKeys ?? expected.stepKeywords?.map(keyword => [keyword]);
  const parts = {
    steps: Math.max(0, 1 - Math.abs(projection.steps.length - expected.steps) / Math.max(1, expected.steps)),
    stepKeywords: share(expected.stepKeywords, (keyword, index) => [index - 1, index, index + 1].some(at => stepTexts[at] !== undefined && holds(stepTexts[at], keyword))),
    parameters: share(expected.parameters, parameter => parameter.split('|').some(option => chips.has(fold(option)))),
    systems: share(expected.systems, label => systems.some(system => holds(system, label))),
    conditions: share(expected.conditions, label => conditions.some(condition => holds(condition, label))),
    record: share(expected.record, label => record.some(item => holds(item, label))),
  };
  const present = Object.values(parts).filter((value): value is number => value !== undefined);
  return {
    ...parts, overall: present.reduce((sum, value) => sum + value, 0) / present.length, foundSteps: projection.steps.length, chips: reading.summary.chips.length,
    // A reading may write one operation of the hand conversion as two steps, so a step and the one after it count together.
    stepRecall: share(keys?.map(key => key.join('\u0000')), key => stepTexts.some((text, index) => {
      const window = `${text}${stepTexts[index + 1] ?? ''}`;
      return key.split('\u0000').every(word => holds(window, word));
    })),
    keyNumbers: share(expected.keyNumbers, amount => holds(everything, amount)),
  };
}

/** Of the amounts in lines that cite the source, the share the anchor check found there, in the source's order. */
function anchoredAmounts(check: RecognitionCheck) {
  let total = 0, wrong = 0;
  for (const line of check.lines) {
    if (!readAnchors(line.line).ranges.length) continue;
    total += amountsIn(readAnchors(line.line).text).quantities.length;
    for (const problem of line.problems) {
      const absent = problem.match(/^数值不在指向的原文：(.+)$/);
      if (absent) wrong += absent[1].split('、').length;
      if (problem.startsWith('体系取值顺序与原文不一致')) wrong += 1;
    }
  }
  return { total, wrong, share: total ? (total - wrong) / total : 1 };
}

/** A Word file in the template as the text a draft is written in: section headings, lines, "- 名称 | 用量 | 说明". */
function templateText(document: ProtocolDocument, title: string) {
  const lines = [`标题：${title}`];
  const blockLines = (block: ProtocolContentBlock, material: boolean): string[] => {
    if (block.type === 'heading' || block.type === 'text' || block.type === 'callout') return block.text.split('\n');
    if (block.type === 'checklist') return block.items;
    if (block.type === 'table') return block.rows.slice(1).map(row => material ? `- ${row.join(' | ')}` : row.filter(Boolean).join(' | '));
    return [];
  };
  for (const section of document.sections) {
    const body = section.blocks.flatMap(block => blockLines(block, section.key === 'material')).map(line => line.trim()).filter(Boolean);
    if (body.length && !(section.key === 'consumption_rules' && body.every(line => /^not recorded\.?$/i.test(line)))) lines.push(`${sectionTitles[section.key]}：`, ...body);
  }
  return lines.join('\n');
}

/**
 * Each line of a hand conversion given the source lines that best support it, as a careful model would cite them: for
 * values per system the lines that give them in order, then the lines that hold most of its other amounts and names, at
 * most ten. A line with nothing to find (the author's own note) gets none, and the check calls it unverified.
 */
function citeByHand(text: string, pages: SourcePage[]) {
  const lines = pages.flatMap(page => page.lines.map((line, index) => ({ page: page.page, line: index + 1, text: line, words: new Set(wordsOf(line)) })));
  return text.split('\n').map(line => {
    if (/^(?:标题|说明|目的|背景|材料|步骤|结果|消耗规则)\s*[：:]\s*$/.test(line) || /^(?:标题|来源)\s*[：:]/.test(line)) return line;
    const amounts = amountsIn(line).quantities.map(quantity => `${quantity.value}${quantity.unit}`);
    const names = [...identifiersIn(line), ...latinNamesIn(line)];
    const words = wordsOf(line);
    const left = new Set([...amounts.map(amount => `a:${amount}`), ...names.map(name => `n:${name}`)]);
    const supports = (candidate: typeof lines[number]) => {
      const theirs = new Set(amountsIn(candidate.text, { flattenedPowers: true }).quantities.map(quantity => `${quantity.value}${quantity.unit}`));
      return [...left].filter(item => item.startsWith('a:') ? theirs.has(item.slice(2)) : nameIn(item.slice(2), candidate.text));
    };
    const chosen: typeof lines = [];
    // Values per system first: the lines that give them in order, as a careful reader cites them.
    for (const run of amountsIn(line).runs) {
      let after = -1;
      for (const value of run.values) {
        const next = lines.findIndex((candidate, index) => index > after && amountsIn(candidate.text, { flattenedPowers: true }).quantities.some(quantity => quantity.value === value && (!run.unit || quantity.unit === run.unit)));
        if (next < 0) break;
        after = next;
        if (!chosen.includes(lines[next])) chosen.push(lines[next]);
        left.delete(`a:${value}${run.unit}`);
      }
    }
    while (left.size && chosen.length < 10) {
      const ranked = lines.map(candidate => ({ candidate, covered: supports(candidate), overlap: words.filter(word => candidate.words.has(word)).length }))
        .filter(item => item.covered.length).sort((a, b) => b.covered.length - a.covered.length || b.overlap - a.overlap);
      if (!ranked.length) break;
      chosen.push(ranked[0].candidate);
      for (const item of ranked[0].covered) left.delete(item);
    }
    if (!chosen.length) {
      const best = lines.map(candidate => ({ candidate, overlap: words.filter(word => candidate.words.has(word)).length / Math.max(1, words.length) })).sort((a, b) => b.overlap - a.overlap)[0];
      if (best && best.overlap >= 0.5) chosen.push(best.candidate);
    }
    if (!chosen.length) return line;
    return `${line}〔${chosen.sort((a, b) => a.page - b.page || a.line - b.line).map(item => `p${item.page}:${item.line}`).join(', ')}〕`;
  }).join('\n');
}

/** Lines with values per system, the first two swapped: how many of them the check catches. */
function swapTest(cited: string, pages: SourcePage[]) {
  let tried = 0, caught = 0;
  for (const line of cited.split('\n')) {
    const run = amountsIn(readAnchors(line).text).runs.find(item => new Set(item.values).size >= 2);
    // A 原文差异 line sets two readings side by side; it has no values per system to swap.
    if (!run || !readAnchors(line).ranges.length || /^原文差异\s*[：:]/.test(line)) continue;
    const before = checkAnchoredRecognition(`步骤：\n${line}`, pages).lines[0];
    if (!before?.verified) continue;
    const swapped = line.replace(/(\d+(?:\.\d+)?)(\s*[/／]\s*)(\d+(?:\.\d+)?)/, (_, a: string, slash: string, b: string) => `${b}${slash}${a}`);
    if (swapped === line) continue;
    tried += 1;
    if (!checkAnchoredRecognition(`步骤：\n${swapped}`, pages).lines[0]?.verified) caught += 1;
  }
  return { tried, caught };
}

async function main() {
  const database = new URL(process.env.DATABASE_URL ?? 'postgresql://unset/unset');
  if (database.pathname === '/labnest') throw new Error('Use a test database, never the formal one.');
  const providerName = argument('provider');
  const only = argument('case');
  const language = argument('language') === 'source' ? 'source' as const : 'zh' as const;
  const rescore = process.argv.includes('--rescore');
  if (rescore && !providerName) throw new Error('--rescore 需要 --provider：要重新评分的是哪个服务存下的整理稿');
  const resolved = providerName && !rescore ? await (async () => {
    const provider = await prisma.aIProvider.findFirst({ where: { name: providerName } });
    if (!provider) throw new Error(`AI 设置里没有名为“${providerName}”的服务`);
    const result = await resolveAdapterForProvider(provider.id, undefined, { timeoutMs: 240_000 });
    if (!result.ok) throw new Error(result.error);
    if (!result.adapter.complete) throw new Error('这个服务不支持整理文本');
    return result;
  })() : undefined;
  const names = (await readdir(`${root}/cases`, { withFileTypes: true }).catch(() => [])).filter(entry => entry.isDirectory()).map(entry => entry.name).filter(name => !only || name === only).sort();
  if (!names.length) throw new Error(`没有评测样本：在 ${root}/cases/<名称>/ 下放 source 文件和 expected.json`);
  const rows = [];
  for (const name of names) {
    const folder = path.join(root, 'cases', name);
    const files = await readdir(folder);
    const sourceName = files.find(file => /^source\.(pdf|docx|txt|md)$/i.test(file));
    if (!sourceName) throw new Error(`${name}：缺少 source.pdf/.docx/.txt/.md`);
    const expected = JSON.parse(await readFile(path.join(folder, 'expected.json'), 'utf8')) as Expected;
    const source = await readSourceFile(sourceName, new Uint8Array(await readFile(path.join(folder, sourceName))));
    const rules: Reading = readAsWritten(source, newId);
    const row: Record<string, unknown> = {
      case: name, kind: source.kind, pages: source.sourcePages.length, chars: source.text.length,
      oldCutChars: Math.min(source.text.length, OLD_CUT), outlineChars: outlineDigest(source.sourcePages).text.length, rules: score(rules, expected),
    };
    console.log(`${name}：${source.sourcePages.length} 页、${source.text.length} 字（habit-v1 只发前 ${Math.min(source.text.length, OLD_CUT)} 字；目录与范围读 ${row.outlineChars} 字）`);
    console.log(`  不用 AI：${(score(rules, expected).overall * 100).toFixed(0)}%（步骤 ${score(rules, expected).foundSteps}/${expected.steps}，步骤召回 ${percent(score(rules, expected).stepRecall)}）`);
    if (files.includes('hand.docx')) {
      const hand = parseProtocolDocxBytes(new Uint8Array(await readFile(path.join(folder, 'hand.docx'))), 'hand.docx');
      const cited = citeByHand(templateText(hand.document, hand.canonicalTitle), source.sourcePages);
      const check = checkAnchoredRecognition(cited, source.sourcePages);
      const swaps = swapTest(cited, source.sourcePages);
      row.hand = { lines: check.lines.length, unverified: check.unverified, unverifiedShare: check.unverified / Math.max(1, check.lines.length), anchoredAmounts: anchoredAmounts(check), swaps, score: score(habitTextProtocol(cited, newId), expected),
        unverifiedLines: check.lines.filter(line => !line.verified).map(line => ({ line: line.line, problems: line.problems })) };
      await mkdir(path.join(root, 'outputs'), { recursive: true });
      await writeFile(path.join(root, 'outputs', `${name}.hand-cited.txt`), cited);
      console.log(`  手工稿过锚点核对：${check.lines.length - check.unverified}/${check.lines.length} 行通过（未核实 ${percent(check.unverified / Math.max(1, check.lines.length))}）；体系取值互换 ${swaps.caught}/${swaps.tried} 行被抓到`);
    }
    const saved = rescore ? await readFile(path.join(root, 'outputs', `${name}.${providerName}.${RECOGNITION_PROMPT_VERSION}.txt`), 'utf8').catch(() => undefined) : undefined;
    if (saved) {
      const scored = score(habitTextProtocol(saved, newId), expected);
      const check = checkAnchoredRecognition(saved, source.sourcePages);
      const amounts = anchoredAmounts(check);
      const unverifiedShare = check.unverified / Math.max(1, check.lines.length);
      row.ai = { ...scored, model: null, promptVersion: RECOGNITION_PROMPT_VERSION, language, rescored: true, lines: check.lines.length, unverified: check.unverified, unverifiedShare, missing: check.missing.length, anchoredAmounts: amounts,
        passes: { anchoredAmounts: amounts.share >= thresholds.anchoredAmounts, stepRecall: (scored.stepRecall ?? 0) >= thresholds.stepRecall, unverifiedShare: unverifiedShare <= thresholds.unverifiedShare } };
      console.log(`  AI（${providerName}，重新评分）：有位置的数值正确 ${percent(amounts.share)}（${amounts.total - amounts.wrong}/${amounts.total}），步骤召回 ${percent(scored.stepRecall)}，关键数值 ${percent(scored.keyNumbers)}，未核实 ${percent(unverifiedShare)}`);
    }
    if (resolved) {
      const started = Date.now();
      let calls = 0;
      const complete = async (system: string, user: string) => { calls += 1; return resolved.adapter.complete!(system, user); };
      const recognitionSource = { pages: source.sourcePages, fileName: sourceName };
      const { outline } = await outlineSource(recognitionSource, complete);
      const choice = defaultChoice(outline, language);
      const result = await organizeSource(recognitionSource, outline, choice, complete);
      await resolved.gate.assertAllowed();
      const scored = score(habitTextProtocol(result.habitText, newId), expected);
      const amounts = anchoredAmounts(result.check);
      const unverifiedShare = result.check.unverified / Math.max(1, result.check.lines.length);
      row.ai = {
        ...scored, model: result.model ?? resolved.config.defaultModel, promptVersion: RECOGNITION_PROMPT_VERSION, language, calls, seconds: Math.round((Date.now() - started) / 1000),
        sentChars: result.sentChars, pagesRead: batchPages(outline, choice).all.length, outline, lines: result.check.lines.length, unverified: result.check.unverified, unverifiedShare,
        missing: result.check.missing.length, anchoredAmounts: amounts, truncated: result.truncated, keyNumbers: scored.keyNumbers,
        passes: { anchoredAmounts: amounts.share >= thresholds.anchoredAmounts, stepRecall: (scored.stepRecall ?? 0) >= thresholds.stepRecall, unverifiedShare: unverifiedShare <= thresholds.unverifiedShare },
      };
      await mkdir(path.join(root, 'outputs'), { recursive: true });
      await writeFile(path.join(root, 'outputs', `${name}.${providerName}.${RECOGNITION_PROMPT_VERSION}.txt`), result.habitText);
      console.log(`  AI（${providerName}）：有位置的数值正确 ${percent(amounts.share)}（${amounts.total - amounts.wrong}/${amounts.total}），步骤召回 ${percent(scored.stepRecall)}，未核实 ${percent(unverifiedShare)}，调用 ${calls} 次，${Math.round((Date.now() - started) / 1000)} 秒`);
    }
    rows.push(row);
  }
  await mkdir(path.join(root, 'reports'), { recursive: true });
  const file = path.join(root, 'reports', `${new Date().toISOString().replace(/[:.]/g, '-')}-${providerName ?? 'rules'}.json`);
  await writeFile(file, JSON.stringify({ provider: providerName ?? null, promptVersion: RECOGNITION_PROMPT_VERSION, language, thresholds, at: new Date().toISOString(), cases: rows }, null, 2));
  console.log(`报告：${file}`);
}

main().catch(error => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
