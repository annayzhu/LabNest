import { DOMParser, type Document, type Element } from "@xmldom/xmldom";
import { checkedDna, readCodonStart, SequenceParseError, type ParseIssue, type ParsedSequenceFile, type Segment, type SequenceFeature, type SequenceRecord, type Strand } from "./model";

/** Names for the packets listed as not read. */
const packetNames: Record<number, string> = {
  0x01: "compressed DNA",
  0x03: "restriction enzymes",
  0x07: "history tree",
  0x08: "sequence properties",
  0x0b: "history node",
  0x0d: "enzyme display settings",
  0x0e: "custom enzyme sets",
  0x10: "alignable sequence",
  0x11: "alignable sequences",
  0x12: "sequence trace",
  0x13: "uracil positions",
  0x14: "custom DNA colors",
  0x15: "protein or RNA sequence",
};

type Packet = { type: number; data: Uint8Array };

function* packets(bytes: Uint8Array): Generator<Packet> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let at = 0;
  while (at < bytes.length) {
    if (at + 5 > bytes.length) throw new SequenceParseError("snapgene.truncated", `The file ends inside a packet header at byte ${at}.`);
    const type = bytes[at];
    const length = view.getUint32(at + 1);
    if (at + 5 + length > bytes.length) throw new SequenceParseError("snapgene.truncated", `Packet 0x${type.toString(16)} at byte ${at} runs past the end of the file.`);
    yield { type, data: bytes.subarray(at + 5, at + 5 + length) };
    at += 5 + length;
  }
}

export function isSnapGene(bytes: Uint8Array) {
  return bytes.length >= 19 && bytes[0] === 0x09 && bytes[1] === 0 && bytes[2] === 0 && bytes[3] === 0 && bytes[4] === 14
    && String.fromCharCode(...bytes.subarray(5, 13)) === "SnapGene";
}

function xmlDocument(data: Uint8Array) {
  try {
    return new DOMParser({ onError: () => undefined }).parseFromString(new TextDecoder("utf-8").decode(data), "text/xml");
  } catch (error) {
    throw new SequenceParseError("snapgene.xml", `The XML is unreadable: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function attribute(element: Element, name: string) {
  return element.getAttribute(name) || undefined;
}

function elements(parent: Document | Element, name: string): Element[] {
  return Array.from(parent.getElementsByTagName(name));
}

function plainText(value: string) {
  return value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, "\"").replace(/&#39;/g, "'").replace(/&amp;/g, "&")
    .trim();
}

/** SnapGene ranges are closed and count from `base`: 1 for features, 0 for primer sites. `start > end` wraps a circular origin. */
function rangeSegments(range: string, length: number, circular: boolean, base: 0 | 1 = 1): Segment[] {
  const match = /^(\d+)-(\d+)$/.exec(range.trim());
  if (!match) throw new SequenceParseError("snapgene.range", `Unreadable range "${range}".`);
  const start = Number(match[1]) - base;
  const end = Number(match[2]) + 1 - base;
  if (start < end && end <= length) return [{ start, end }];
  if (start >= end && circular && start < length && end <= length) return [{ start, end: length }, { start: 0, end }];
  throw new SequenceParseError("snapgene.range", `Range "${range}" lies outside a ${circular ? "circular" : "linear"} ${length} bp sequence.`);
}

/** Directionality 1 is forward, 2 reverse, anything else none; gap segments are dropped. A feature whose range cannot be read goes to `unsupported`. */
function readFeatures(data: Uint8Array, length: number, circular: boolean, unsupported: ParseIssue[]) {
  const features: SequenceFeature[] = [];
  for (const element of elements(xmlDocument(data), "Feature")) {
    const type = attribute(element, "type") ?? "misc_feature";
    const name = attribute(element, "name") ?? type;
    try {
      const direction = attribute(element, "directionality");
      const strand: Strand | 0 = direction === "1" ? 1 : direction === "2" ? -1 : 0;
      const segmentElements = elements(element, "Segment").filter((segment) => attribute(segment, "type") !== "gap");
      const ascending = segmentElements.flatMap((segment) => rangeSegments(attribute(segment, "range") ?? "", length, circular));
      if (!ascending.length) throw new SequenceParseError("snapgene.range", "The feature has no segment.");
      const qualifiers: Record<string, string[]> = {};
      for (const qualifier of elements(element, "Q")) {
        const key = attribute(qualifier, "name");
        if (!key) continue;
        qualifiers[key] = elements(qualifier, "V").map((value) => {
          const text = attribute(value, "text");
          return text !== undefined ? plainText(text) : attribute(value, "int") ?? attribute(value, "predef") ?? "";
        });
      }
      const color = segmentElements.map((segment) => attribute(segment, "color")).find(Boolean);
      features.push({
        name,
        type,
        strand,
        segments: strand === -1 ? ascending.reverse() : ascending,
        ...readCodonStart(qualifiers),
        ...(color ? { color } : {}),
        qualifiers,
        evidence: "file",
      });
    } catch (error) {
      if (!(error instanceof SequenceParseError)) throw error;
      unsupported.push({ code: error.code, message: `Feature "${name}": ${error.message}` });
    }
  }
  return features;
}

/**
 * Primer binding sites use 0-based closed ranges, unlike features. Sites below the file's
 * hybridization thresholds are hidden in SnapGene, so they are skipped here too (as
 * Biopython's SnapGene reader does).
 */
function readPrimers(data: Uint8Array, length: number, circular: boolean, unsupported: ParseIssue[]) {
  const features: SequenceFeature[] = [];
  const document = xmlDocument(data);
  const params = elements(document, "HybridizationParams")[0];
  const minLength = Number(params ? attribute(params, "minContinuousMatchLen") ?? 0 : 0);
  const minMelting = Number(params ? attribute(params, "minMeltingTemperature") ?? 0 : 0);
  let hidden = 0;
  for (const primer of elements(document, "Primer")) {
    const name = attribute(primer, "name") ?? "primer";
    const seen = new Set<string>();
    for (const site of elements(primer, "BindingSite")) {
      const location = attribute(site, "location") ?? "";
      const strand: Strand = attribute(site, "boundStrand") === "1" ? -1 : 1;
      // A site can be listed twice (a full and a simplified form): each place and strand is kept once.
      if (seen.has(`${location}:${strand}`)) continue;
      seen.add(`${location}:${strand}`);
      const annealed = attribute(site, "annealedBases");
      const melting = attribute(site, "meltingTemperature");
      if ((annealed !== undefined && annealed.length < minLength) || (melting !== undefined && Number(melting) < minMelting)) {
        hidden += 1;
        continue;
      }
      try {
        const ascending = rangeSegments(location, length, circular, 0);
        features.push({
          name,
          type: "primer_bind",
          strand,
          segments: strand === -1 ? ascending.reverse() : ascending,
          qualifiers: { label: [name], ...(attribute(primer, "sequence") ? { primer_sequence: [attribute(primer, "sequence")!] } : {}) },
          evidence: "file",
        });
      } catch (error) {
        if (!(error instanceof SequenceParseError)) throw error;
        unsupported.push({ code: error.code, message: `Primer "${name}": ${error.message}` });
      }
    }
  }
  if (hidden) unsupported.push({ code: "snapgene.hidden-primer-sites", message: `${hidden} primer binding site(s) below the file's display thresholds are not imported.` });
  return features;
}

function readDescription(data: Uint8Array) {
  const notes = xmlDocument(data);
  const text = (name: string) => {
    const element = elements(notes, name)[0];
    return element?.textContent ? plainText(element.textContent) : undefined;
  };
  return text("Description") || text("Comments");
}

/**
 * SnapGene `.dna` is a run of packets: one type byte, a big-endian uint32 length, then the
 * data. Only the tested subset is read (Q279): sequence and topology (0x00), features
 * (0x0A), primers (0x05) and notes (0x06). Every other packet is listed as not read.
 */
export function parseSnapGene(bytes: Uint8Array, name: string): ParsedSequenceFile {
  if (!isSnapGene(bytes)) throw new SequenceParseError("snapgene.signature", "Not a SnapGene file (the SnapGene cookie packet is missing).");
  const warnings: ParseIssue[] = [];
  const unsupported: ParseIssue[] = [];
  const byType = new Map<number, Packet[]>();
  for (const packet of packets(bytes)) byType.set(packet.type, [...(byType.get(packet.type) ?? []), packet]);

  const dna = byType.get(0x00);
  if (!dna?.length) {
    const why = byType.has(0x01) ? "the sequence is stored compressed" : byType.has(0x15) ? "it holds a protein or RNA sequence" : "it has no DNA packet";
    throw new SequenceParseError("snapgene.no-dna", `The bases cannot be read reliably: ${why}.`);
  }
  if (dna.length > 1) throw new SequenceParseError("snapgene.multiple-dna", "The file holds more than one DNA packet.");
  const flags = dna[0].data[0];
  const sequence = checkedDna(new TextDecoder("latin1").decode(dna[0].data.subarray(1)), "snapgene.alphabet");
  const circular = (flags & 0x01) !== 0;
  const record: SequenceRecord = {
    name,
    sequence,
    topology: circular ? "circular" : "linear",
    moleculeType: (flags & 0x02) !== 0 ? "ds-DNA" : "ss-DNA",
    features: [],
  };

  for (const [type, list] of byType) {
    if (type === 0x09 || type === 0x00) continue;
    const hex = `0x${type.toString(16).padStart(2, "0")}`;
    for (const packet of list) {
      if (type !== 0x0a && type !== 0x05 && type !== 0x06) {
        unsupported.push({ code: `snapgene.packet-${hex}`, message: `${packetNames[type] ?? "unknown block"} (packet ${hex}, ${packet.data.length} bytes) is not read.` });
        continue;
      }
      try {
        if (type === 0x0a) record.features.push(...readFeatures(packet.data, sequence.length, circular, unsupported));
        else if (type === 0x05) record.features.push(...readPrimers(packet.data, sequence.length, circular, unsupported));
        else record.description = readDescription(packet.data) ?? record.description;
      } catch (error) {
        if (!(error instanceof SequenceParseError)) throw error;
        unsupported.push({ code: error.code, message: `Packet ${hex}: ${error.message}` });
      }
    }
  }
  if ((flags & ~0x03) !== 0) warnings.push({ code: "snapgene.methylation", message: "Methylation flags are set on the sequence; they are not read." });
  return { format: "snapgene", records: [record], reads: [], warnings, unsupported };
}
