/**
 * 原文位置: every line of an organized draft ends with where it came from, "〔p3:12–14〕" (page 3, lines 12 to 14) or
 * "〔p16:5, p20:7–8〕". Pages are the source's own (a PDF's pages; Word and plain text are page 1 unless paged with form
 * feeds), lines are numbered from 1 within each page, after headers, footers and page numbers are left out.
 *
 * The rest of this file reads the amounts and names a line states the way a check compares them: "350 µL", "350 μl" and
 * "350 ul" are one amount; "12,000 ×g" and "12000 x g" one force; "37oC" (a degree sign lost in a PDF) is 37 °C.
 */
export type SourcePage = { page: number; lines: string[] };
export type AnchorRange = { page: number; from: number; to: number };
export type SourceLine = { page: number; line: number; text: string };

/** Text as pages: form feeds separate pages; lines are trimmed and empty ones left out. */
export function pagedLines(text: string): SourcePage[] {
  const pages = text.split('\f').map((page, index) => ({ page: index + 1, lines: page.split(/\r?\n/).map(line => line.replace(/\s+/g, ' ').trim()).filter(Boolean) }));
  const written = pages.filter(page => page.lines.length);
  return written.length ? written : [{ page: 1, lines: [] }];
}

const item = String.raw`p\s*\d+\s*[:：]\s*\d+(?:\s*[-–—~～]\s*(?:p\s*\d+\s*[:：]\s*)?\d+)?`;
const anchorBlock = new RegExp(String.raw`\s*[〔［\[【]\s*(${item}(?:\s*[,，;；、]\s*${item})*)\s*[〕］\]】]`, 'gi');
const anchorTest = new RegExp(anchorBlock.source, 'i');
const itemPattern = /p\s*(\d+)\s*[:：]\s*(\d+)(?:\s*[-–—~～]\s*(?:p\s*(\d+)\s*[:：]\s*)?(\d+))?/gi;
const pageEnd = Number.MAX_SAFE_INTEGER;

/** A line without its positions, and the positions it gives. A range across a page break runs to the end of the first page. */
export function readAnchors(line: string): { text: string; ranges: AnchorRange[] } {
  const ranges: AnchorRange[] = [];
  const text = line.replace(anchorBlock, (_, list: string) => {
    for (const [, page, from, toPage, to] of list.matchAll(itemPattern)) {
      const start = { page: Number(page), from: Number(from) };
      if (toPage && Number(toPage) !== start.page) {
        ranges.push({ ...start, to: pageEnd });
        for (let next = start.page + 1; next < Number(toPage); next += 1) ranges.push({ page: next, from: 1, to: pageEnd });
        ranges.push({ page: Number(toPage), from: 1, to: Number(to) });
      } else ranges.push({ ...start, to: to ? Math.max(Number(to), start.from) : start.from });
    }
    return ' ';
  }).replace(/\s+([，。；、,.;:：）)])/g, '$1').replace(/\s+/g, ' ').trim();
  return { text, ranges };
}

/** The text without any positions: what the Protocol, the Word template and the reader get. */
export const stripAnchors = (text: string) => text.split(/\r?\n/).map(line => anchorTest.test(line) ? readAnchors(line).text : line).join('\n');

export const formatRange = (range: AnchorRange) => `p${range.page}:${range.from}${range.to === pageEnd ? '–' : range.to !== range.from ? `–${range.to}` : ''}`;

/** The source lines a line's positions point at, in page order, and the positions that do not exist. */
export function resolveAnchors(ranges: AnchorRange[], pages: SourcePage[]) {
  const lines = new Map<string, SourceLine>(), absent: string[] = [];
  for (const range of ranges) {
    const page = pages.find(item => item.page === range.page);
    const last = range.to === pageEnd ? page?.lines.length ?? 0 : range.to;
    if (!page || range.from < 1 || range.from > page.lines.length || last > page.lines.length) { absent.push(formatRange(range)); continue; }
    for (let line = range.from; line <= last; line += 1) lines.set(`${range.page}:${line}`, { page: range.page, line, text: page.lines[line - 1] });
  }
  return { lines: [...lines.values()].sort((a, b) => a.page - b.page || a.line - b.line), absent };
}

/** The source as the model reads it: every line with its position. */
export const numberedLines = (pages: SourcePage[]) => pages.flatMap(page => page.lines.map((text, index) => `[p${page.page}:${index + 1}] ${text}`)).join('\n');

const superscripts: Record<string, string> = { '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9', '⁻': '-' };

/**
 * Text as amounts are compared: superscript powers kept as powers ("10⁵" is 10^5, not 105), full-width forms folded,
 * thousands separators dropped, "×10^5" written as a power, and what PDFs often garble mended: "1OX" is "10X", "300 μI"
 * is "300 μl", "37oC" and "65 C" are degrees.
 */
export function foldAmounts(text: string) {
  return text.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹⁻]+/g, run => `^${[...run].map(char => superscripts[char]).join('')}`)
    .normalize('NFKC')
    .replace(/[®™©]/g, '')
    .replace(/(\d)[Oo](?=\d|[Xx×](?![a-z]))/g, '$10')
    .replace(/(\d\s*[μu])I(?![A-Za-z])/g, '$1l')
    .replace(/(\d)\s*(?:[oº°˚]\s*C|℃)(?![A-Za-z])/g, '$1 °C')
    .replace(/(\d)\s+C(?![A-Za-z0-9+-])/g, '$1 °C')
    .replace(/(\d),(?=\d{3}(?!\d))/g, '$1')
    .replace(/(\d+(?:\.\d+)?)\s*[×xX*]\s*10\s*\^\s*(-?\d+)/g, '$1e$2')
    .replace(/(^|[^\d.e^])10\s*\^\s*(-?\d+)/g, '$11e$2');
}

const NUM = String.raw`\d+(?:\.\d+)?(?:e-?\d+)?`;
const RANGE = String.raw`${NUM}(?:\s*(?:[-–—~～]|to|至)\s*${NUM})?`;
const GROUP = String.raw`${RANGE}(?:\s*[/／]\s*${RANGE})*`;
// Longer names first; a Latin unit ends where letters end ("5 samples" has no unit).
const UNIT = String.raw`(?:[×xX]\s*g(?![A-Za-z])|rcf|RCF|rpm|RPM|minutes?|mins?|seconds?|secs?|hours?|hrs?|days?|weeks?|[μu][lL]|m[lL]|n[lL]|[μu]g|mg|ng|kg|[mμun]M|M|mmol|[μu]mol|nmol|mol|kDa|kb|bp|cm|mm|[μu]m|nm|°C|IU|mA|min|[lL]|g|s|h|d|U|W|V|%|[×xX](?=\s*[A-Za-z(（]|\s*$|\s*[，,。;；)）])|分钟|小时|秒|天|周)(?![A-Za-zμ])`;
const quantityPattern = new RegExp(String.raw`(?<![\w.^/])(${GROUP})\s*(${UNIT})?`, 'g');
const unitPattern = new RegExp(String.raw`(?<![A-Za-z0-9μ])${UNIT}`, 'g');

const unitNames: [RegExp, string][] = [
  [/^(?:[×xX]\s*g|rcf|RCF)$/, 'xg'], [/^(?:rpm|RPM)$/, 'rpm'], [/^(?:minutes?|mins?|min|分钟)$/, 'min'], [/^(?:seconds?|secs?|s|秒)$/, 's'],
  [/^(?:hours?|hrs?|h|小时)$/, 'h'], [/^(?:days?|d|天)$/, 'd'], [/^(?:weeks?|周)$/, 'week'], [/^[μu][lL]$/, 'μl'], [/^m[lL]$/, 'ml'], [/^n[lL]$/, 'nl'],
  [/^[lL]$/, 'l'], [/^[μu]g$/, 'μg'], [/^[μu]M$/, 'μM'], [/^[μu]mol$/, 'μmol'], [/^[μu]m$/, 'μm'], [/^[×xX]$/, 'x'],
];
const unitName = (unit: string) => unitNames.find(([pattern]) => pattern.test(unit))?.[1] ?? unit;
const unitShown: Record<string, string> = { μl: 'µL', ml: 'mL', nl: 'nL', l: 'L', μg: 'µg', xg: '×g', x: '×' };
/** An amount as a check reports it: "750 µL", "12000 ×g". */
export const amountText = (quantity: { value: string; unit: string }) => `${quantity.value}${quantity.unit ? ` ${unitShown[quantity.unit] ?? quantity.unit}` : ''}`;
const numberValue = (text: string) => String(Number(text));
/** Every number a text states, inside names too ("Opal520"): what a number with no unit is looked up in. */
export const numbersOf = (folded: string) => new Set((folded.match(/\d+(?:\.\d+)?(?:e-?\d+)?/g) ?? []).map(numberValue));
/** The units a text names anywhere, with or without a number: a table's "(mL)" header counts. */
export const unitsOf = (folded: string) => new Set([...folded.matchAll(unitPattern)].map(match => unitName(match[0].replace(/\s+/g, ''))));

export type Quantity = { value: string; unit: string; at: number };
/** A run of values written for the systems in order, "350/600 µL" or "1–3 / 15–25 mL": every number in it, range ends too. */
export type ValueRun = { values: string[]; unit: string; shown: string };

/**
 * The amounts in a text, each number with the unit written after it or after the range or run it belongs to
 * ("12–15 h" gives 12 h and 15 h). A number with no unit after it has the unit "". Positions are in the folded text.
 */
export function amountsIn(text: string, options: { flattenedPowers?: boolean } = {}): { quantities: Quantity[]; runs: ValueRun[]; folded: string } {
  const folded = foldAmounts(text);
  const quantities: Quantity[] = [], runs: ValueRun[] = [];
  for (const match of folded.matchAll(quantityPattern)) {
    const unit = match[2] ? unitName(match[2].replace(/\s+/g, '')) : '';
    const at = match.index ?? 0;
    const elements = match[1].split(/\s*[/／]\s*/);
    for (const number of match[1].matchAll(new RegExp(NUM, 'g'))) quantities.push({ value: numberValue(number[0]), unit, at: at + (number.index ?? 0) });
    if (elements.length >= 2) runs.push({ values: [...match[1].matchAll(new RegExp(NUM, 'g'))].map(number => numberValue(number[0])), unit, shown: amountText({ value: elements.map(element => element.replace(/\s+/g, '')).join('/'), unit }) });
  }
  // A PDF that lost a superscript writes 7×10^5 as "7×105" and ~10^9 cells as "~109 cells": read that way too, as well as literally.
  if (options.flattenedPowers) {
    for (const match of folded.matchAll(/(\d+(?:\.\d+)?)\s*[×xX]\s*10(\d)(?!\d)/g)) quantities.push({ value: numberValue(`${match[1]}e${match[2]}`), unit: '', at: match.index ?? 0 });
    for (const match of folded.matchAll(/(?<![\d.])10(\d)(?=\s*(?:cells|copies|cfu|CFU|particles|viral|TU|IU|个))/g)) quantities.push({ value: numberValue(`1e${match[1]}`), unit: '', at: match.index ?? 0 });
  }
  return { quantities, runs, folded };
}

const unitWords = new Set(['ul', 'μl', 'ml', 'nl', 'l', 'ug', 'μg', 'mg', 'ng', 'kg', 'g', 'mm', 'um', 'μm', 'nm', 'cm', 'min', 'mins', 'minute', 'minutes', 's', 'sec', 'secs', 'second', 'seconds',
  'h', 'hr', 'hrs', 'hour', 'hours', 'd', 'day', 'days', 'rpm', 'rcf', 'xg', 'x', 'kb', 'bp', 'kda', 'u', 'iu', 'w', 'v', 'ma', 'mol', 'mmol', 'umol', 'μmol', 'nmol', 'm', 'ph', 'c']);
const commonWords = new Set(['a', 'an', 'and', 'or', 'of', 'to', 'in', 'on', 'at', 'for', 'the', 'with', 'by', 'per', 'from', 'as', 'is', 'be', 'no', 'not', 'via', 'vs', 'e', 'g', 'i', 'ie', 'eg', 'etc', 'n', 'ok']);

const identifierPattern = /[A-Za-z0-9]+(?:[-.][A-Za-z0-9]+)*/g;
// A number with its unit run together ("10X", "5min", "1e5") is an amount, not a name.
const amountToken = /^\d+(?:\.\d+)?(?:e-?\d+|[μu]?[lL]|m[lL]|[μu]?g|mg|ng|kg|[mμu]?M|mins?|h|hrs?|s|secs?|d|x|X|bp|kb|rpm|nm|mm|cm|kDa|°C|%)?$/;

const isIdentifier = (token: string) => (/\d/.test(token) && /[A-Za-z]/.test(token) && !amountToken.test(token)) || /^\d{4,}(?:-\d+)+$/.test(token);

/** Catalog numbers and names with digits ("K2100-02", "AR6", "pLKO.1", "15140-122"): they must stand in the cited lines. */
export const identifiersIn = (text: string) => [...new Set((foldAmounts(text).match(identifierPattern) ?? []).filter(isIdentifier))];

const stepReference = /(?:步骤|第|[Ss]teps?)\s*\d+(?:\s*(?:[-–—~～至、,，和与]|to|and)\s*\d+)*\s*步?/g;
/** A line without its names with digits and its references to other steps ("按步骤 9–10"): what its amounts are read from. */
export const maskNames = (text: string) => foldAmounts(text).replace(identifierPattern, token => isIdentifier(token) ? ' ' : token).replace(stepReference, ' ');

/** Latin words of a line written in another language than its source: reagent names, kit and cell names, abbreviations. */
export function latinNamesIn(text: string) {
  const folded = foldAmounts(text).replace(identifierPattern, token => /\d/.test(token) ? ' ' : token);
  return [...new Set((folded.match(/[A-Za-z][A-Za-z+'’-]*[A-Za-z+]|[A-Za-z]/g) ?? [])
    .filter(word => word.length >= 2 && !unitWords.has(word.toLowerCase()) && !commonWords.has(word.toLowerCase())))];
}

/**
 * How names are compared: case, marks, spaces, hyphens and underscores do not count ("OPTI_MEM" is "Opti-MEM"), and
 * l and I read alike, as PDF text often confuses them ("TRIS-HCI").
 */
export const nameSkeleton = (text: string) => foldAmounts(text).toLowerCase().replace(/l/g, 'i').replace(/[^a-z0-9μ一-鿿+]/g, '');

/** Whether a name stands in a text: a short one as a word of it, a longer one anywhere in its skeleton. */
export function nameIn(name: string, text: string) {
  const skeleton = nameSkeleton(name);
  if (!skeleton) return true;
  if (skeleton.length > 4) return nameSkeleton(text).includes(skeleton);
  return (foldAmounts(text).match(/[A-Za-z0-9+]+/g) ?? []).some(word => nameSkeleton(word) === skeleton)
    || (foldAmounts(text).match(identifierPattern) ?? []).some(word => nameSkeleton(word) === skeleton);
}

/** Chinese more than Latin: decides whether a line and its source are written in the same language. */
export function isChinese(text: string) {
  const cjk = (text.match(/[一-鿿]/g) ?? []).length;
  const latin = (text.match(/[A-Za-z]{2,}/g) ?? []).length;
  return cjk >= 2 && cjk / (cjk + latin) >= 0.25;
}

/** The words of a text without its numbers or punctuation: Latin words whole, Chinese as overlapping pairs. */
export function wordsOf(text: string) {
  const out: string[] = [];
  const skeleton = text.normalize('NFKC').toLowerCase().replace(/×/g, 'x').replace(/\d+(?:[.,]\d+)*/g, ' ').replace(/[\s\p{P}\p{S}]+/gu, ' ');
  for (const run of skeleton.match(/[一-鿿]+|[^\s一-鿿]+/g) ?? []) {
    if (/^[一-鿿]+$/.test(run)) { if (run.length === 1) out.push(run); else for (let i = 0; i < run.length - 1; i += 1) out.push(run.slice(i, i + 2)); }
    else out.push(run);
  }
  return out;
}
