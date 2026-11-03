"use client";

import { ChevronDown, ChevronUp } from "lucide-react";
import { useMemo, useState } from "react";
import { formatSegments } from "@/lib/plasmid/layout";
import type { Segment, SequenceRecord } from "@/lib/plasmid/model";
import { looksLikeDna, searchDna, searchProtein } from "@/lib/plasmid/search";
import { strandArrow } from "@/lib/plasmid/workbench";

/**
 * 搜索 (F04): DNA on both strands (IUPAC codes allowed) or a peptide in six frames, with up to two mismatches. The
 * kind is guessed from the letters unless chosen. Picking a hit selects it in every view.
 */
export function SearchPanel({ record, onSelect }: { record: SequenceRecord; onSelect: (segments: Segment[]) => void }) {
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<"auto" | "dna" | "protein">("auto");
  const [mismatches, setMismatches] = useState(0);
  // -1 until a match is picked, so the first Enter goes to the first match.
  const [at, setAt] = useState(-1);
  const dna = mode === "dna" || (mode === "auto" && looksLikeDna(query));
  const hits = useMemo(() => {
    const letters = query.replace(/[^A-Za-z*]/g, "");
    if (letters.length < (dna ? 4 : 3)) return [];
    return dna ? searchDna(record, letters, mismatches) : searchProtein(record, letters, mismatches);
  }, [query, dna, mismatches, record]);
  const go = (index: number) => {
    if (!hits.length) return;
    const next = (index + hits.length) % hits.length;
    setAt(next);
    onSelect(hits[next].strand === -1 ? [...hits[next].segments].reverse() : hits[next].segments);
  };

  return (
    <section className="ln-pw-search" aria-label="Search">
      <h2>Search</h2>
      <input
        className="ln-pw-input ln-pw-mono"
        value={query}
        placeholder="Bases or a peptide"
        aria-label="Search for bases or a peptide"
        data-i18n-ignore
        onChange={(event) => { setQuery(event.target.value); setAt(-1); }}
        onKeyDown={(event) => { if (event.key === "Enter") go(event.shiftKey ? (at < 0 ? -1 : at - 1) : at + 1); }}
      />
      <div className="ln-pw-actions">
        <select className="ln-pw-input ln-pw-narrow" value={mode} aria-label="Search for" onChange={(event) => setMode(event.target.value as typeof mode)}>
          <option value="auto">{query && looksLikeDna(query) ? "Auto: DNA" : query ? "Auto: peptide" : "Auto"}</option>
          <option value="dna">DNA</option>
          <option value="protein">Peptide</option>
        </select>
        <select className="ln-pw-input ln-pw-narrow" value={mismatches} aria-label="Mismatches allowed" onChange={(event) => setMismatches(Number(event.target.value))}>
          {[0, 1, 2].map((value) => <option key={value} value={value}>{value === 0 ? "Exact" : `Up to ${value} mismatch${value > 1 ? "es" : ""}`}</option>)}
        </select>
      </div>
      {query.replace(/[^A-Za-z*]/g, "").length >= 3 ? (
        <>
          <div className="ln-pw-actions">
            <span className="ln-pw-note">{hits.length ? (at < 0 ? `${hits.length} matches in this sequence` : `Match ${Math.min(at, hits.length - 1) + 1} of ${hits.length}`) : "No matches"}</span>
            <button type="button" className="ln-pw-icon" aria-label="Previous match" disabled={!hits.length} onClick={() => go(at < 0 ? -1 : at - 1)}><ChevronUp className="h-3.5 w-3.5" aria-hidden /></button>
            <button type="button" className="ln-pw-icon" aria-label="Next match" disabled={!hits.length} onClick={() => go(at + 1)}><ChevronDown className="h-3.5 w-3.5" aria-hidden /></button>
          </div>
          <ul className="ln-pw-hits">
            {hits.slice(0, 50).map((hit, index) => (
              <li key={index}>
                <button type="button" data-active={index === at || undefined} onClick={() => go(index)}>
                  <span className="ln-pw-mono">{formatSegments(hit.strand === -1 ? [...hit.segments].reverse() : hit.segments)}</span>
                  <small>{`${strandArrow(hit.strand)}${hit.mismatches ? ` · ${hit.mismatches} mismatch${hit.mismatches > 1 ? "es" : ""}` : ""}`}</small>
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </section>
  );
}
