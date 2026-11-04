"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { compareSequences, featureDifferences, type CompareDifference } from "@/lib/plasmid/compare";
import { differenceContext } from "@/lib/plasmid/effects";
import type { SequenceRecord } from "@/lib/plasmid/model";

const perLine = 60;
const kindLabels: Record<CompareDifference["kind"], string> = { substitution: "Substitution", insertion: "Only in the other", deletion: "Only in this one" };
// A table of more than this says little; the alignment below still shows them all.
const maxRows = 500;

/**
 * 序列比较 (PRD PW-09): this sequence against another one, whole. Strand and origin are allowed for and said so; every
 * difference is listed in both sets of coordinates, with the CDS change where there is one. It compares sequences only,
 * so it says nothing about quality or about which tube they came from.
 */
export function CompareView({ record, other, onChange }: { record: SequenceRecord; other: SequenceRecord; onChange: () => void }) {
  const result = useMemo(() => compareSequences(record, other), [record, other]);
  const features = useMemo(() => featureDifferences(record, other), [record, other]);
  const [at, setAt] = useState(-1);
  const box = useRef<HTMLDivElement>(null);
  const { differences } = result;
  const lines = useMemo(() => {
    const rows: Array<{ column: number; a: string; b: string; aFrom: number; bFrom: number }> = [];
    let atA = 0;
    let atB = 0;
    for (let column = 0; column < result.a.length; column += perLine) {
      const a = result.a.slice(column, column + perLine);
      const b = result.b.slice(column, column + perLine);
      rows.push({ column, a, b, aFrom: atA, bFrom: atB });
      atA += a.replaceAll("-", "").length;
      atB += b.replaceAll("-", "").length;
    }
    return rows;
  }, [result]);
  const go = (index: number) => {
    const next = Math.max(0, Math.min(differences.length - 1, index));
    setAt(next);
    box.current?.querySelector(`[data-line="${Math.floor(differences[next].column / perLine)}"]`)?.scrollIntoView({ block: "center" });
  };
  const place = (from: number, to: number) => (to - from > 1 ? `${from + 1}–${to}` : to === from ? `${from} | ${from + 1}` : String(from + 1));
  const otherPlace = (difference: CompareDifference) => {
    if (difference.bEnd === difference.bStart) {
      const [low, high] = [result.originalPosition(Math.max(0, difference.bStart - 1)), result.originalPosition(Math.min(other.sequence.length - 1, difference.bStart))].sort((left, right) => left - right);
      return `${low + 1} | ${high + 1}`;
    }
    const [low, high] = [result.originalPosition(difference.bStart), result.originalPosition(difference.bEnd - 1)].sort((left, right) => left - right);
    return high === low ? String(low + 1) : `${low + 1}–${high + 1}`;
  };
  // One changed base gives a codon change; a longer run only names where it falls.
  const coding = (difference: CompareDifference) => differenceContext({
    kind: difference.kind !== "substitution" ? difference.kind : difference.aBases.length === 1 ? "mismatch" : "ambiguous",
    referenceStart: difference.aStart,
    referenceEnd: difference.aEnd,
    referenceBases: difference.aBases,
    readBases: difference.bBases,
    lowestQuality: null,
    confidence: "no-quality",
  }, record);
  const count = (kind: CompareDifference["kind"]) => differences.filter((difference) => difference.kind === kind).length;

  return (
    <div className="ln-pw-compare">
      <header className="ln-pw-compare-head">
        <div>
          <p data-i18n-ignore className="ln-pw-compare-names"><strong>{record.name}</strong>{` · ${record.sequence.length.toLocaleString("en-US")}`}<span> ⇄ </span><strong>{other.name}</strong>{` · ${other.sequence.length.toLocaleString("en-US")}`}</p>
          {result.identical ? <p className="ln-pw-ok">The two sequences are identical. That does not show they come from the same tube.</p>
            : result.equivalent ? <p className="ln-pw-ok">The same sequence, written differently. That does not show they come from the same tube.</p>
            : <p className="ln-pw-warn">{`${(result.identity * 100).toFixed(2)}% identical · ${count("substitution")} substitution(s) · ${count("insertion")} only in the other · ${count("deletion")} only in this one`}</p>}
          {result.reversed ? <p className="ln-pw-note">The other sequence runs the opposite way, so its reverse complement is compared.</p> : null}
          {result.turn ? <p className="ln-pw-note">{`Both are circular with different origins: the other one is turned by ${result.turn.toLocaleString("en-US")} bp.`}</p> : null}
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={onChange}>Compare with another</Button>
      </header>

      {differences.length ? (
        <section aria-label="Differences">
          <div className="ln-pw-actions ln-pw-compare-steps">
            <Button type="button" variant="secondary" size="sm" disabled={at <= 0} onClick={() => go(at - 1)}><ChevronLeft className="h-3.5 w-3.5" aria-hidden />Previous difference</Button>
            <Button type="button" variant="secondary" size="sm" disabled={at >= differences.length - 1} onClick={() => go(at + 1)}>Next difference<ChevronRight className="h-3.5 w-3.5" aria-hidden /></Button>
          </div>
          <div className="ln-pw-table-wrap">
            <table className="ln-pw-table">
              <thead><tr><th>Type</th><th>This sequence</th><th>The other</th><th>Base change</th><th>In features</th></tr></thead>
              <tbody>
                {differences.slice(0, maxRows).map((difference, index) => {
                  const context = coding(difference);
                  return (
                    <tr key={index} data-selected={index === at || undefined} onClick={() => go(index)}>
                      <td>{kindLabels[difference.kind]}</td>
                      <td className="ln-pw-mono">{place(difference.aStart, difference.aEnd)}</td>
                      <td className="ln-pw-mono">{otherPlace(difference)}</td>
                      <td className="ln-pw-mono" data-i18n-ignore>{`${short(difference.aBases)} → ${short(difference.bBases)}`}</td>
                      <td data-i18n-ignore>{[context.features.join(", "), ...context.coding.map((change) => `${change.feature} ${change.codon}: ${change.referenceAminoAcid} → ${change.readAminoAcid}`)].filter(Boolean).join(" · ")}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {differences.length > maxRows ? <p className="ln-pw-note">{`The first ${maxRows} of ${differences.length} differences are listed; all of them are in the alignment below.`}</p> : null}
        </section>
      ) : null}

      {features.onlyFirst.length || features.onlySecond.length ? (
        <section aria-label="Annotation differences">
          <h3>Annotation differences</h3>
          {features.onlyFirst.length ? <p className="ln-pw-note">Only in this one: <span data-i18n-ignore>{features.onlyFirst.join(", ")}</span></p> : null}
          {features.onlySecond.length ? <p className="ln-pw-note">Only in the other: <span data-i18n-ignore>{features.onlySecond.join(", ")}</span></p> : null}
        </section>
      ) : null}

      <section aria-label="Alignment">
        <h3>Alignment</h3>
        <div className="ln-pw-compare-alignment" ref={box} data-i18n-ignore>
          {lines.map((line, index) => (
            <div key={line.column} className="ln-pw-compare-line" data-line={index}>
              <Row label={line.aFrom + 1} text={line.a} other={line.b} />
              <Row label="" text={[...line.a].map((base, column) => (base === line.b[column] ? "|" : " ")).join("")} other={null} />
              <Row label={line.bFrom + 1} text={line.b} other={line.a} />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function short(bases: string) {
  if (!bases) return "-";
  return bases.length > 12 ? `${bases.slice(0, 6)}…${bases.slice(-3)} (${bases.length})` : bases;
}

function Row({ label, text, other }: { label: number | string; text: string; other: string | null }) {
  return (
    <div className="ln-pw-compare-row">
      <span>{label}</span>
      <code>{other === null || other === text ? text : [...text].map((base, at) => (base === other[at] ? base : <mark key={at}>{base}</mark>))}</code>
    </div>
  );
}
