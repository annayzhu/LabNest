import {
  checkedDna,
  readCodonStart,
  SequenceParseError,
  type ParseIssue,
  type ParsedSequenceFile,
  type Segment,
  type SequenceFeature,
  type SequenceRecord,
  type Strand,
  type Topology,
} from "./model";

type StrandedSegment = Segment & { strand: Strand };

const integerQualifiers = new Set(["codon_start", "transl_table", "number", "estimated_length"]);
// Feature keys start in column 6; qualifiers and continued locations in column 22.
const qualifierColumn = 21;

function locationError(raw: string, detail: string) {
  return new SequenceParseError("genbank.location", `Unsupported location ${raw}: ${detail}`);
}

/**
 * Parses a GenBank location into segments in biological order. On a circular record
 * `a..b` with a > b wraps the origin, as some editors write it instead of `join`.
 */
export function parseGenbankLocation(raw: string, length: number, topology: Topology): { strand: Strand; segments: Segment[] } {
  const text = raw.replace(/\s+/g, "");
  let at = 0;

  const expect = (token: string) => {
    if (!text.startsWith(token, at)) throw locationError(raw, `expected "${token}" at ${at + 1}`);
    at += token.length;
  };

  const position = () => {
    const match = /^([<>]?)(\d+)/.exec(text.slice(at));
    if (!match) throw locationError(raw, `expected a position at ${at + 1}`);
    at += match[0].length;
    return { value: Number(match[2]), open: match[1] !== "" };
  };

  const range = (): StrandedSegment[] => {
    if (/^[A-Za-z_][\w.]*:/.test(text.slice(at))) throw locationError(raw, "it refers to another record");
    const first = position();
    if (text.startsWith("..", at)) {
      at += 2;
      const second = position();
      const start = first.value - 1;
      const end = second.value;
      const head = { start, ...(first.open ? { openStart: true } : {}), strand: 1 as Strand };
      const tail = second.open ? { openEnd: true } : {};
      if (start < end) return [{ ...head, end, ...tail }];
      if (topology === "circular") return [{ ...head, end: length }, { start: 0, end, ...tail, strand: 1 }];
      throw locationError(raw, "the start lies after the end on a linear record");
    }
    if (text[at] === "^") {
      at += 1;
      position();
      return [{ start: first.value, end: first.value, strand: 1 }];
    }
    if (text[at] === ".") throw locationError(raw, "single-base choices (a.b) are not supported");
    return [{ start: first.value - 1, end: first.value, ...(first.open ? { openStart: true } : {}), strand: 1 }];
  };

  const node = (): StrandedSegment[] => {
    if (text.startsWith("complement(", at)) {
      at += "complement(".length;
      const inner = node();
      expect(")");
      return inner.reverse().map((segment) => ({ ...segment, strand: segment.strand === 1 ? -1 : 1 }));
    }
    for (const keyword of ["join(", "order("]) {
      if (!text.startsWith(keyword, at)) continue;
      at += keyword.length;
      const parts = node();
      while (text[at] === ",") {
        at += 1;
        parts.push(...node());
      }
      expect(")");
      return parts;
    }
    return range();
  };

  const segments = node();
  if (at !== text.length) throw locationError(raw, `unexpected "${text.slice(at)}"`);
  const strands = new Set(segments.map((segment) => segment.strand));
  if (strands.size > 1) throw locationError(raw, "segments lie on both strands");
  for (const segment of segments) {
    if (segment.start < 0 || segment.end > length || segment.start > segment.end) throw locationError(raw, `it lies outside 1..${length}`);
  }
  return {
    strand: segments[0].strand,
    segments: segments.map((segment) => {
      const copy: Segment & { strand?: Strand } = { ...segment };
      delete copy.strand;
      return copy;
    }),
  };
}

function closingQuote(value: string) {
  for (let at = 1; at < value.length; at += 1) {
    if (value[at] !== "\"") continue;
    if (value[at + 1] === "\"") {
      at += 1;
      continue;
    }
    return at;
  }
  return -1;
}

type RawFeature = { key: string; location: string; line: number; qualifiers: Array<{ name: string; value: string }> };

/** A quoted value runs across lines until its closing quote; `""` inside it is a literal quote. */
function readFeatureLines(lines: Array<{ text: string; number: number }>) {
  const features: RawFeature[] = [];
  let current: RawFeature | undefined;
  let open: { name: string; text: string } | undefined;

  const addQualifier = (name: string, value: string) => {
    if (!current) return;
    if (!value.startsWith("\"")) {
      current.qualifiers.push({ name, value });
      return;
    }
    const close = closingQuote(value);
    const inner = value.slice(1, close < 0 ? value.length : close).replace(/""/g, "\"");
    current.qualifiers.push({ name, value: name === "translation" ? inner.replace(/\s+/g, "") : inner });
  };

  for (const { text, number } of lines) {
    const content = text.trim();
    if (!content) continue;
    if (open) {
      open.text += ` ${content}`;
      if (closingQuote(open.text) >= 0) {
        addQualifier(open.name, open.text);
        open = undefined;
      }
      continue;
    }
    const indent = text.length - text.trimStart().length;
    if (indent < qualifierColumn) {
      const [key, ...rest] = content.split(/\s+/);
      current = { key, location: rest.join(""), line: number, qualifiers: [] };
      features.push(current);
      continue;
    }
    if (!current) continue;
    if (content.startsWith("/")) {
      const equals = content.indexOf("=");
      const name = (equals < 0 ? content.slice(1) : content.slice(1, equals)).trim();
      const value = equals < 0 ? "" : content.slice(equals + 1).trim();
      if (value.startsWith("\"") && closingQuote(value) < 0) open = { name, text: value };
      else addQualifier(name, value);
      continue;
    }
    if (!current.qualifiers.length) current.location += content;
    else current.qualifiers[current.qualifiers.length - 1].value += ` ${content}`;
  }
  if (open) addQualifier(open.name, `${open.text}"`);
  return features;
}

function featureName(type: string, qualifiers: Record<string, string[]>) {
  for (const key of ["label", "gene", "product", "locus_tag", "note"]) {
    const value = qualifiers[key]?.[0]?.trim();
    if (value) return value;
  }
  return type;
}

function toFeature(raw: RawFeature, length: number, topology: Topology): SequenceFeature {
  const { strand, segments } = parseGenbankLocation(raw.location, length, topology);
  const qualifiers: Record<string, string[]> = {};
  for (const { name, value } of raw.qualifiers) (qualifiers[name] ??= []).push(value);
  const color = qualifiers.color?.[0] ?? qualifiers.ApEinfo_fwdcolor?.[0];
  return {
    name: featureName(raw.key, qualifiers),
    type: raw.key,
    strand,
    segments,
    ...readCodonStart(qualifiers),
    ...(color ? { color } : {}),
    qualifiers,
    evidence: "file",
  };
}

function parseLocus(line: string) {
  const tokens = line.slice(5).trim().split(/\s+/);
  const unit = tokens.findIndex((token, index) => index > 0 && /^(bp|aa)$/i.test(token));
  const length = unit > 0 ? Number(tokens[unit - 1]) : Number.NaN;
  const lower = tokens.map((token) => token.toLowerCase());
  const topology: Topology = lower.includes("circular") ? "circular" : lower.includes("linear") ? "linear" : "unknown";
  return {
    name: tokens[0] ?? "",
    length,
    isProtein: unit > 0 && tokens[unit].toLowerCase() === "aa",
    moleculeType: unit > 0 ? tokens[unit + 1] : undefined,
    topology,
  };
}

/**
 * Reads one LOCUS block. A length mismatch goes to `warnings`; a feature whose location
 * cannot be read goes to `unsupported`, and the record still loads.
 */
function parseRecord(lines: Array<{ text: string; number: number }>, warnings: ParseIssue[], unsupported: ParseIssue[]): SequenceRecord {
  const locus = parseLocus(lines[0].text);
  if (locus.isProtein) throw new SequenceParseError("genbank.protein", `${locus.name}: protein GenBank records are not supported.`);
  const sections = new Map<string, Array<{ text: string; number: number }>>();
  let section = "LOCUS";
  for (const line of lines.slice(1)) {
    const keyword = /^([A-Z][A-Z ]*?)(?:\s{2,}|\s*$)/.exec(line.text);
    if (keyword) {
      section = keyword[1].trim();
      if (sections.has(section)) section = `${section}#${line.number}`;
      sections.set(section, [line]);
    } else {
      sections.get(section)?.push(line);
    }
  }
  const sectionText = (name: string) => {
    const body = sections.get(name);
    if (!body) return undefined;
    return body.map((line, index) => (index === 0 ? line.text.slice(name.length) : line.text).trim()).join(" ").trim() || undefined;
  };
  if (!sections.has("ORIGIN")) {
    if (sections.has("CONTIG")) throw new SequenceParseError("genbank.contig", `${locus.name}: CONTIG records without ORIGIN have no bases to read.`);
    throw new SequenceParseError("genbank.no-origin", `${locus.name}: the record has no ORIGIN section.`);
  }
  const rawBases = (sections.get("ORIGIN") ?? []).slice(1).map((line) => line.text).join("").replace(/[\s\d]/g, "");
  const sequence = checkedDna(rawBases, "genbank.alphabet", locus.name);
  if (Number.isFinite(locus.length) && locus.length !== sequence.length) {
    warnings.push({ code: "genbank.length", message: `${locus.name}: LOCUS says ${locus.length} bp but ORIGIN holds ${sequence.length}.` });
  }
  const features: SequenceFeature[] = [];
  const featureLines = (sections.get("FEATURES") ?? []).slice(1);
  for (const raw of readFeatureLines(featureLines)) {
    try {
      features.push(toFeature(raw, sequence.length, locus.topology));
    } catch (error) {
      if (!(error instanceof SequenceParseError)) throw error;
      unsupported.push({ code: error.code, message: `${locus.name} line ${raw.line} (${raw.key}): ${error.message}` });
    }
  }
  return {
    name: locus.name,
    description: sectionText("DEFINITION"),
    sequence,
    topology: locus.topology,
    moleculeType: locus.moleculeType,
    features,
  };
}

export function parseGenbankText(text: string): ParsedSequenceFile {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).map((line, index) => ({ text: line.replace(/\s+$/, ""), number: index + 1 }));
  const records: SequenceRecord[] = [];
  const warnings: ParseIssue[] = [];
  const unsupported: ParseIssue[] = [];
  let index = 0;
  while (index < lines.length) {
    if (!lines[index].text.trim()) {
      index += 1;
      continue;
    }
    if (!lines[index].text.startsWith("LOCUS")) throw new SequenceParseError("genbank.locus", `Expected LOCUS at line ${index + 1}.`);
    const end = lines.findIndex((line, at) => at > index && line.text.startsWith("//"));
    if (end < 0) warnings.push({ code: "genbank.unterminated", message: "The last record has no // line." });
    records.push(parseRecord(lines.slice(index, end < 0 ? lines.length : end), warnings, unsupported));
    index = end < 0 ? lines.length : end + 1;
  }
  if (!records.length) throw new SequenceParseError("genbank.empty", "The file holds no GenBank record.");
  return { format: "genbank", records, reads: [], warnings, unsupported };
}

function formatSegment(segment: Segment) {
  const start = `${segment.openStart ? "<" : ""}${segment.start + 1}`;
  if (segment.end === segment.start) return `${segment.start}^${segment.start + 1}`;
  if (segment.end - segment.start === 1 && !segment.openEnd) return start;
  return `${start}..${segment.openEnd ? ">" : ""}${segment.end}`;
}

export function formatGenbankLocation(feature: Pick<SequenceFeature, "strand" | "segments">) {
  // Minus-strand segments are stored 5'→3' on the feature, so GenBank's ascending
  // complement(join(...)) form lists them in reverse.
  const ordered = feature.strand === -1 ? [...feature.segments].reverse() : feature.segments;
  const body = ordered.length === 1 ? formatSegment(ordered[0]) : `join(${ordered.map(formatSegment).join(",")})`;
  return feature.strand === -1 ? `complement(${body})` : body;
}

/**
 * Breaks after a `breakAt` character. Without one inside the width the line runs long,
 * because readers join qualifier lines with a space and a forced cut would add one.
 */
function wrap(text: string, width: number, breakAt: RegExp) {
  const lines: string[] = [];
  let rest = text;
  while (rest.length > width) {
    let cut = -1;
    for (let at = width; at > 0 && cut < 0; at -= 1) if (breakAt.test(rest[at - 1])) cut = at;
    for (let at = width + 1; at < rest.length && cut < 0; at += 1) if (breakAt.test(rest[at - 1])) cut = at;
    if (cut < 0) break;
    lines.push(rest.slice(0, cut).trimEnd());
    rest = rest.slice(cut).trimStart();
  }
  lines.push(rest);
  return lines;
}

function locusDate(date: Date) {
  const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
  return `${String(date.getUTCDate()).padStart(2, "0")}-${months[date.getUTCMonth()]}-${date.getUTCFullYear()}`;
}

/** Line breaks inside a value (SnapGene notes keep them) would start a new GenBank line; a space keeps the value whole. */
function oneLine(value: string) {
  return value.replace(/\s*[\r\n]+\s*/g, " ");
}

/** Writes NCBI-column GenBank so that independent parsers (Biopython, SnapGene) read it back. */
export function formatGenbank(record: SequenceRecord, date = new Date()) {
  const name = (record.name.replace(/\s+/g, "_") || "sequence").slice(0, 16);
  const topology = record.topology === "circular" ? "circular" : "linear  ";
  const lines = [
    `LOCUS       ${name.padEnd(16)} ${String(record.sequence.length).padStart(11)} bp    DNA     ${topology} SYN ${locusDate(date)}`,
  ];
  wrap(oneLine(record.description || "."), 67, /\s/).forEach((line, index) => lines.push(`${index ? " ".repeat(12) : "DEFINITION  "}${line}`));
  lines.push("ACCESSION   .", "VERSION     .", "KEYWORDS    .", "SOURCE      synthetic DNA construct", "  ORGANISM  synthetic DNA construct");
  lines.push("FEATURES             Location/Qualifiers");
  for (const feature of record.features) {
    wrap(formatGenbankLocation(feature), 58, /,/).forEach((line, index) => {
      lines.push(index ? `${" ".repeat(qualifierColumn)}${line}` : `     ${feature.type.padEnd(15)} ${line}`);
    });
    const qualifiers = { ...feature.qualifiers };
    if (feature.codonStart) qualifiers.codon_start = [String(feature.codonStart)];
    if (!qualifiers.label && !qualifiers.gene && !qualifiers.product && feature.name !== feature.type) qualifiers.label = [feature.name];
    for (const [key, values] of Object.entries(qualifiers)) {
      for (const value of values.map(oneLine)) {
        const text = value === "" ? `/${key}` : integerQualifiers.has(key) && /^\d+$/.test(value) ? `/${key}=${value}` : `/${key}="${value.replace(/"/g, "\"\"")}"`;
        wrap(text, 58, key === "translation" ? /./ : /\s/).forEach((line) => lines.push(`${" ".repeat(qualifierColumn)}${line}`));
      }
    }
  }
  lines.push("ORIGIN");
  const bases = record.sequence.toLowerCase();
  for (let start = 0; start < bases.length; start += 60) {
    const groups: string[] = [];
    for (let offset = start; offset < Math.min(start + 60, bases.length); offset += 10) groups.push(bases.slice(offset, offset + 10));
    lines.push(`${String(start + 1).padStart(9)} ${groups.join(" ")}`);
  }
  lines.push("//");
  return `${lines.join("\n")}\n`;
}
