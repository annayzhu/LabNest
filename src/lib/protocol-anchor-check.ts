import { recordLine } from './protocol-conversion';
import { sectionFromHeading } from './protocol-docx';
import type { ProtocolSectionKey } from './protocol-document';
import {
  amountText, amountsIn, identifiersIn, isChinese, latinNamesIn, maskNames, nameIn, nameSkeleton, numbersOf, readAnchors, resolveAnchors,
  unitsOf, wordsOf, type Quantity, type SourceLine, type SourcePage,
} from './protocol-anchors';

export type LineCheck = { line: string; verified: boolean; problems: string[] };
export type RecognitionCheck = { lines: LineCheck[]; unverified: number; missing: string[]; ok: boolean };

/**
 * 锚点核对 (template-v1): every line of an organized draft is checked against the source lines it cites, not the whole
 * source. A line passes when its position exists; every amount in it, with its unit, stands in the cited lines (a number
 * found elsewhere in the manual does not count); its catalog numbers and names with digits stand there too, and so do
 * its Latin names when the line is written in another language than its source; values written per system
 * ("350/600 µL") come in the source's order; and a line in the source's own language shares its words with the cited
 * lines: 80% when copied verbatim, as before, 60% when condensed (中文整理 of a Chinese source may reword). Lines with an
 * amount in the pages that were organized, cited by no line, are listed as possibly left out. Problems are worded in
 * Chinese: they go back to the model in the repair round.
 */
export function checkAnchoredRecognition(text: string, pages: SourcePage[], options: { scopePages?: number[]; verbatim?: boolean } = {}): RecognitionCheck {
  const lines: LineCheck[] = [];
  const cited = new Set<string>();
  let section: ProtocolSectionKey | undefined;
  for (const raw of text.split(/\r?\n/).map(line => line.trim()).filter(Boolean)) {
    const { text: written, ranges } = readAnchors(raw);
    const heading = sectionFromHeading(written.replace(/[：:]\s*$/, '').trim());
    if (heading) { section = heading; continue; }
    const inline = written.match(/^([^：:]{1,8})\s*[：:]\s*(.*)$/);
    const inlineSection = inline ? sectionFromHeading(inline[1].trim()) : undefined;
    if (inlineSection) section = inlineSection;
    const label = inline?.[1].trim();
    // The title and the program's own 来源 and 范围 lines describe the draft, not the Protocol.
    if (!ranges.length && (label === '标题' || ((label === '来源' || label === '范围') && section === 'description'))) continue;
    const content = contentOf(inlineSection ? inline![2] : written);
    if (!ranges.length) {
      // A result template's name ("RNA 质检") is structure, not a statement of the source.
      if (section === 'result_templates' && !recordLine.test(written) && content.length <= 30 && !/\d/.test(content)) continue;
      lines.push({ line: raw, verified: false, problems: ['没有原文位置'] });
      continue;
    }
    const { lines: source, absent } = resolveAnchors(ranges, pages);
    for (const line of source) cited.add(`${line.page}:${line.line}`);
    const problems = absent.length ? [`原文位置不存在：${absent.join('、')}`] : [];
    // A 原文差异 line sets two readings side by side ("30/50 mL"): they are not values per system.
    if (source.length) problems.push(...compare(content, source, pages, { systemsLine: label === '体系', checkOrder: label !== '原文差异', verbatim: options.verbatim }));
    lines.push({ line: raw, verified: !problems.length, problems });
  }
  const scope = new Set(options.scopePages ?? pages.map(page => page.page));
  const candidates = pages.filter(page => scope.has(page.page)).flatMap(page => page.lines.map((line, index) => ({ page: page.page, line: index + 1, text: line })))
    .filter(line => amountsIn(line.text).quantities.some(quantity => quantity.unit && quantity.unit !== 'x'));
  const missing = candidates.filter(line => !cited.has(`${line.page}:${line.line}`))
    .map(line => `〔p${line.page}:${line.line}〕 ${line.text.length > 80 ? `${line.text.slice(0, 80)}…` : line.text}`);
  const unverified = lines.filter(line => !line.verified).length;
  return { lines, unverified, missing, ok: unverified === 0 && missing.length <= Math.max(2, Math.ceil(candidates.length * 0.1)) };
}

/** Labels the template writes ahead of a line's content: they are layout, not words of the source. */
const layoutLabel = /^(?:体系|体系对应|记录|每个样本|每个样品|首次使用前|原文差异|原理|储存|安全|注意|说明|厂家参考值[^：:]{0,12})\s*[：:]\s*/;
const stepNumber = /^\s*\d+\s*(?:[、)）．]|\.(?!\d))\s*/;

/** What a line says: the step number, a material line's bullet and bars, and layout labels left out. */
function contentOf(text: string) {
  const material = text.match(/^\s*[-•*·]\s*(.+)$/);
  const body = material ? material[1].split(/\s*[|｜\t]\s*/).join(' ') : text.replace(stepNumber, '');
  return body.replace(layoutLabel, '').trim();
}

/** A source line's own numbering ("2. Wash the column") is not an amount: blanked, so positions stay where they were. */
const enumerator = (text: string) => text.replace(/^(\s*)(\d+)(\s*[.)、．]\s)/, (_, space: string, number: string, rest: string) => `${space}${' '.repeat(number.length)}${rest}`);

function compare(content: string, source: SourceLine[], pages: SourcePage[], { systemsLine, checkOrder, verbatim }: { systemsLine: boolean; checkOrder: boolean; verbatim?: boolean }): string[] {
  const problems: string[] = [];
  const cited = source.map(line => line.text).join('\n');
  const theirs = amountsIn(source.map(line => enumerator(line.text)).join('\n'), { flattenedPowers: true });
  const numbers = numbersOf(theirs.folded);
  for (const quantity of theirs.quantities) numbers.add(quantity.value);
  const units = unitsOf(theirs.folded);
  const mine = amountsIn(maskNames(content));
  const absent = mine.quantities.filter(quantity => quantity.unit
    ? !theirs.quantities.some(other => other.value === quantity.value && other.unit === quantity.unit) && !(numbers.has(quantity.value) && units.has(quantity.unit))
    : !numbers.has(quantity.value));
  if (absent.length) problems.push(`数值不在指向的原文：${[...new Set(absent.map(amountText))].join('、')}`);
  // Values per system follow the source's order: 600/350 for a source that says 350 first, then 600, is a swap.
  const rows = source.map(line => amountsIn(enumerator(line.text), { flattenedPowers: true }).quantities);
  for (const run of checkOrder ? mine.runs : []) {
    if (run.values.some(value => !numbers.has(value))) continue;
    // An occurrence with the run's unit, when the cited lines give the value with that unit at all.
    const fits = (value: string, quantities: Quantity[]) => {
      const same = quantities.filter(other => other.value === value && run.unit && other.unit === run.unit);
      return (same.length ? same : quantities.filter(other => other.value === value && (!other.unit || !run.unit))).sort((a, b) => a.at - b.at);
    };
    const distinct = [...new Set(run.values)];
    // A line that gives several of the values (a table row, one sentence) gives them in the run's order.
    const rowSwapped = rows.some(quantities => {
      const firsts = distinct.map(value => fits(value, quantities)[0]?.at).filter((at): at is number => at !== undefined);
      return firsts.some((at, index) => index > 0 && at < firsts[index - 1]);
    });
    let at = -1;
    const chained = run.values.every(value => {
      const next = fits(value, theirs.quantities).find(other => other.at > at);
      if (next) at = next.at;
      return Boolean(next);
    });
    if (rowSwapped || !chained) problems.push(`体系取值顺序与原文不一致：${run.shown}`);
  }
  const sameLanguage = isChinese(content) === isChinese(cited);
  const names = [...identifiersIn(content), ...(sameLanguage ? [] : latinNamesIn(content))].filter(name => !nameIn(name, cited));
  if (names.length) problems.push(`名称不在指向的原文：${[...new Set(names)].join('、')}`);
  if (systemsLine) {
    // "体系：Mini / Midi / Maxi": options named in the source come in its order.
    const skeleton = nameSkeleton(cited);
    const options = content.split(/\s*[/／]\s*/).map(option => nameSkeleton(option)).filter(Boolean);
    const found = options.map(option => skeleton.indexOf(option));
    if (found.every(index => index >= 0) && found.some((index, at) => at > 0 && index < found[at - 1])) problems.push(`体系顺序与原文不一致：${content}`);
  }
  if (sameLanguage) {
    // The cited lines and the lines around them: a sentence often runs over a line break.
    const around = new Set(source.flatMap(line => {
      const page = pages.find(item => item.page === line.page)!;
      return [page.lines[line.line - 2], line.text, page.lines[line.line]].filter(Boolean).flatMap(wordsOf);
    }));
    const words = [...new Set(wordsOf(content))];
    const share = words.length ? words.filter(word => around.has(word)).length / words.length : 1;
    if (share < (verbatim ? 0.8 : 0.6)) problems.push(`与指向的原文只对上 ${Math.round(share * 100)}%`);
  }
  return problems;
}
