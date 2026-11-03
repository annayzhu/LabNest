import { reverseComplement } from "@/lib/sequence";
import { DEFAULT_MIN_QUALITY } from "./model";
import { findPeptide, type PeptideHit } from "./tags";
import { sixFrameTranslations, translate, type Frame } from "./translate";

/** One element of an expected construct ("期望结构", Q277), in N→C order. */
export type StructureElement = {
  name: string;
  /** Peptide, or accepted alternatives (for example a known natural variant). */
  protein: string | string[];
  /** Largest number of amino acids allowed between this element and the previous one. */
  maxGapBefore?: number;
};

export type StructureCheckInput = {
  sequence: string;
  quality?: number[] | null;
  /** The coding frame; found from the first element when omitted. */
  frame?: Frame;
  elements: StructureElement[];
  minQuality?: number;
};

export type CheckStatus = "pass" | "fail" | "unknown" | "not-applicable";

export type StructureCheckItem = {
  id: "present" | "in-frame" | "order" | "gap" | "no-stop" | "junction-quality";
  element: string;
  status: CheckStatus;
  detail: string;
};

export type ElementObservation = {
  name: string;
  /** Exact peptide hits in any of the six frames: is the DNA there at all? */
  anyFrame: PeptideHit[];
  /** Amino-acid interval in the coding frame, counted from codon 1. */
  inFrame?: { aaStart: number; aaEnd: number; protein: string };
};

export type StructureCheck = {
  frame?: Frame;
  codingProtein: string;
  elements: ElementObservation[];
  items: StructureCheckItem[];
  /** True only when every element is present, in frame, in order, within its allowed gap and not after a stop. */
  arrangementFound: boolean;
};

/**
 * Checks an expected fusion as separate items (F05): the tag's DNA being present does
 * not make it a fusion tag; it also has to be in the coding frame, in order, and not
 * behind a stop codon. Junction quality is reported, never assumed.
 */
export function checkStructure(input: StructureCheckInput): StructureCheck {
  const minQuality = input.minQuality ?? DEFAULT_MIN_QUALITY;
  const frames = sixFrameTranslations(input.sequence);
  const observations: ElementObservation[] = input.elements.map((element) => ({
    name: element.name,
    anyFrame: alternatives(element).flatMap((value) => findPeptide(input.sequence, value, element.name, { frames })),
  }));
  let frame = input.frame;
  const anchors = observations[0]?.anyFrame ?? [];
  if (!frame && anchors.length) {
    // The earliest hit in reading order: on the minus strand that is the one with the highest top-strand position.
    const anchor = [...anchors].sort((left, right) => right.strand - left.strand || (left.offset + left.aaStart * 3) - (right.offset + right.aaStart * 3))[0];
    frame = { strand: anchor.strand, offset: anchor.offset + anchor.aaStart * 3 };
  }
  if (!frame) {
    return {
      codingProtein: "",
      elements: observations,
      items: [{ id: "present", element: input.elements[0]?.name ?? "", status: "fail", detail: "The first element was not found, so there is no coding frame to check." }],
      arrangementFound: false,
    };
  }

  const oriented = frame.strand === 1 ? input.sequence : reverseComplement(input.sequence);
  const orientedQuality = input.quality ? (frame.strand === 1 ? input.quality : [...input.quality].reverse()) : null;
  const codingProtein = translate(oriented, frame.offset);
  const items: StructureCheckItem[] = [];
  let previousEnd: number | undefined;
  input.elements.forEach((element, index) => {
    const observation = observations[index];
    const found = firstHit(codingProtein, element, 0);
    const inOrder = firstHit(codingProtein, element, previousEnd ?? 0);
    const placed = inOrder ?? found;
    if (placed) observation.inFrame = placed;
    const present = observation.anyFrame.length > 0;
    items.push({ id: "present", element: element.name, status: present ? "pass" : "fail", detail: present ? `${observation.anyFrame.length} hit(s) in six frames.` : "Not found in any frame." });
    items.push({
      id: "in-frame",
      element: element.name,
      status: !present ? "not-applicable" : found ? "pass" : "fail",
      detail: found ? `Codons ${found.aaStart + 1}–${found.aaEnd} of the coding frame.` : present ? "Only found in another frame or on the other strand." : "",
    });
    if (index > 0) {
      items.push({
        id: "order",
        element: element.name,
        status: !found || previousEnd === undefined ? "not-applicable" : inOrder ? "pass" : "fail",
        detail: !found ? "" : previousEnd === undefined ? `Not checked: ${input.elements[index - 1].name} is not placed in the coding frame.` : inOrder ? `Placed after ${input.elements[index - 1].name}.` : `Placed before ${input.elements[index - 1].name}.`,
      });
      if (inOrder && previousEnd !== undefined) {
        const gap = inOrder.aaStart - previousEnd;
        const allowed = element.maxGapBefore ?? Number.POSITIVE_INFINITY;
        items.push({ id: "gap", element: element.name, status: gap <= allowed ? "pass" : "fail", detail: `${gap} amino acid(s) after ${input.elements[index - 1].name}.` });
        const junction = frame.offset + previousEnd * 3;
        if (!orientedQuality) items.push({ id: "junction-quality", element: element.name, status: "unknown", detail: "The sequence has no quality values." });
        else {
          const window = orientedQuality.slice(Math.max(0, junction - 9), junction + 9);
          const lowest = window.length ? Math.min(...window) : Number.NaN;
          items.push({
            id: "junction-quality",
            element: element.name,
            status: window.length && lowest >= minQuality ? "pass" : "fail",
            detail: window.length ? `Lowest quality Q${lowest} within 3 codons of the junction.` : "The junction is outside the sequence.",
          });
        }
      }
    }
    const stop = placed ? codingProtein.slice(0, placed.aaEnd).indexOf("*") : -1;
    items.push({
      id: "no-stop",
      element: element.name,
      status: !placed ? "not-applicable" : stop < 0 ? "pass" : "fail",
      detail: !placed ? "" : stop < 0 ? "No stop codon before or inside it." : `Stop codon at codon ${stop + 1}, before the end of ${element.name}.`,
    });
    previousEnd = inOrder?.aaEnd;
  });
  // Junction quality judges the reads, not the construct, so it does not decide whether the arrangement is there.
  const arrangementFound = items.every((item) => item.status === "pass" || item.id === "junction-quality");
  return { frame, codingProtein, elements: observations, items, arrangementFound };
}

function alternatives(element: StructureElement) {
  return Array.isArray(element.protein) ? element.protein : [element.protein];
}

/** The earliest of the element's peptides in the coding protein at or after amino acid `from`. */
function firstHit(coding: string, element: StructureElement, from: number) {
  const earliest = alternatives(element)
    .map((value) => ({ index: coding.indexOf(value, from), value }))
    .filter((match) => match.index >= 0)
    .sort((left, right) => left.index - right.index)[0];
  return earliest ? { aaStart: earliest.index, aaEnd: earliest.index + earliest.value.length, protein: earliest.value } : undefined;
}
