"use client";

import { ChevronLeft, ChevronRight, Minus, Plus } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { createAligner, differenceStops, rescore, type AlignmentOutcome, type ReadAlignment } from "@/lib/plasmid/align";
import type { AlignRequest, AlignResponse } from "@/lib/plasmid/align.worker";
import { coverageProfile, type CoverageState } from "@/lib/plasmid/coverage";
import { differenceContext } from "@/lib/plasmid/effects";
import { copyKey, groupReadEvidence, importSequenceFiles, joinKnownCopies } from "@/lib/plasmid/files";
import type { SangerRead, SequenceRecord } from "@/lib/plasmid/model";
import type { SavedFolder } from "@/lib/plasmid/store.server";
import { mixedPeaks } from "@/lib/plasmid/trace";
import type { StoredStructureElement } from "@/lib/plasmid/structure.server";
import { KeepCheck } from "./KeepCheck";
import { TraceView, useCenteredMark } from "./TraceView";

/** `copy` names the read by its file bytes (`copyKey`), so the same file added again from a folder joins its group. */
export type ReadChoice = { key: string; read: SangerRead; group: string; from?: string; copy?: string };
/** The place whose trace is open: a read and a reference position (0-based). */
type Spot = { read: number; position: number };

export const stateLabels: Record<CoverageState, string> = { supported: "Supported", interrupted: "Evidence interrupted", low: "Low quality", conflict: "Conflict", uncovered: "Not covered" };
export const confidenceLabels = { high: "High quality", "low-quality": "Low quality", "no-quality": "No quality values", "ambiguous-base": "Ambiguous base" } as const;
const span = 30;

/** Aligns in a worker so the page stays usable (Q364); falls back to the page when workers are unavailable. */
function alignReads(request: AlignRequest): Promise<AlignmentOutcome[]> {
  try {
    const worker = new Worker(new URL("../../lib/plasmid/align.worker.ts", import.meta.url));
    return new Promise((resolve, reject) => {
      worker.onmessage = (event: MessageEvent<AlignResponse>) => {
        resolve(event.data.outcomes);
        worker.terminate();
      };
      worker.onerror = (event) => {
        reject(new Error(event.message || "The alignment stopped."));
        worker.terminate();
      };
      worker.postMessage(request);
    });
  } catch {
    const aligner = createAligner(request.reference, request.topology === "circular" ? "circular" : "linear");
    return Promise.resolve(request.reads.map((read) => aligner.align({ ...read, peaks: null, traces: null, metadata: {} })));
  }
}

/**
 * 测序比对 (F06, Q364–Q367): reads placed on the open sequence. Shows coverage by evidence group, every difference with
 * its confidence, double peaks, and the trace at any position (R02): the difference in view, or a place picked on the
 * coverage, in the bases or by number. One quality threshold judges everything shown (R03). It draws no conclusion:
 * checking and confirming come with the verification records (batch C).
 */
export function AlignmentView({ record, reads, folders, saved, structure, splits }: {
  record: SequenceRecord;
  reads: ReadChoice[];
  folders: SavedFolder[];
  /** The saved version the record is; a check record needs one. */
  saved?: { productId: string; versionId: string };
  structure: StoredStructureElement[];
  /** Reads a person split off a same-bases group, with the reason (Q371). */
  splits: Record<string, string>;
}) {
  const [extra, setExtra] = useState<ReadChoice[]>([]);
  const all = useMemo(() => [...reads, ...extra], [reads, extra]);
  const [chosen, setChosen] = useState<string[]>(() => reads.map((item) => item.key));
  const [minQuality, setMinQuality] = useState(20);
  const [ratio, setRatio] = useState(0.3);
  const [includeLow, setIncludeLow] = useState(false);
  const [result, setResult] = useState<{ keys: string[]; outcomes: AlignmentOutcome[] }>();
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string>();
  const [stop, setStop] = useState(0);
  const [view, setView] = useState<"aligned" | "original">("aligned");
  const [zoom, setZoom] = useState(2);
  const [loadingFolder, setLoadingFolder] = useState(false);
  // Set by picking a place; cleared by "next difference", which then shows the difference in view.
  const [focus, setFocus] = useState<Spot>();

  const request = useCallback((picked: ReadChoice[]) => alignReads({ reference: record.sequence, topology: record.topology, reads: picked.map(({ read }) => ({ name: read.name, bases: read.bases, quality: read.quality })) }), [record.sequence, record.topology]);

  const run = async (keys: string[]) => {
    const picked = all.filter((item) => keys.includes(item.key));
    if (!picked.length) return;
    setRunning(true);
    setError(undefined);
    try {
      setResult({ keys: picked.map((item) => item.key), outcomes: await request(picked) });
      setStop(0);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure));
    } finally {
      setRunning(false);
    }
  };

  // The reads opened with the file are aligned straight away; later changes wait for "Align".
  const first = !result && !error && reads.length > 0;
  useEffect(() => {
    if (!first) return;
    let cancelled = false;
    request(reads)
      .then((outcomes) => { if (!cancelled) setResult({ keys: reads.map((item) => item.key), outcomes }); })
      .catch((failure) => { if (!cancelled) setError(failure instanceof Error ? failure.message : String(failure)); });
    return () => { cancelled = true; };
  }, [first, reads, request]);

  const placed = useMemo(() => (result ? result.keys.map((key, index) => ({ choice: all.find((item) => item.key === key)!, outcome: result.outcomes[index] })) : []), [result, all]);
  const length = record.sequence.length;
  const circularLength = record.topology === "circular" ? length : undefined;
  const alignments = useMemo(() => placed.map(({ outcome }) => (outcome.aligned ? rescore(outcome.alignment, minQuality, circularLength) : undefined)), [placed, minQuality, circularLength]);
  const profile = useMemo(() => coverageProfile(length, placed.flatMap(({ choice }, index) => (alignments[index] ? [{ alignment: alignments[index], group: choice.group }] : [])), { minQuality }), [placed, alignments, length, minQuality]);
  const stops = useMemo(() => differenceStops(alignments, includeLow), [alignments, includeLow]);
  const mixed = useMemo(() => placed.map(({ choice }) => mixedPeaks(choice.read, ratio, minQuality)), [placed, ratio, minQuality]);
  const current = stops[Math.min(stop, stops.length - 1)];
  const go = (next: (at: number) => number) => {
    setFocus(undefined);
    setStop(next);
  };

  useEffect(() => {
    const keys = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLElement && event.target.closest("input, textarea, select")) return;
      if (event.key === "n" || event.key === "N") go((at) => Math.min(at + 1, Math.max(0, stops.length - 1)));
      if (event.key === "p" || event.key === "P") go((at) => Math.max(0, at - 1));
    };
    window.addEventListener("keydown", keys);
    return () => window.removeEventListener("keydown", keys);
  }, [stops.length]);

  const covers = (read: number, position: number) => Boolean(alignments[read]?.columns.some((column) => column.referencePosition === position));
  const firstAligned = alignments.findIndex(Boolean);
  const spot: Spot | undefined = focus ?? (current ? { read: current.read, position: current.difference.referenceStart } : firstAligned >= 0 ? { read: firstAligned, position: alignments[firstAligned]!.referenceSegments[0].start } : undefined);
  /** Opens the trace at `position`, in `read` or else the open read when it covers the place, or else the first that does. */
  const pick = (position: number, read?: number) => {
    const at = Math.min(Math.max(0, position), length - 1);
    const chosenRead = read ?? (spot && covers(spot.read, at) ? spot.read : alignments.findIndex((_, index) => covers(index, at)));
    const next = { read: chosenRead >= 0 ? chosenRead : (spot?.read ?? 0), position: at };
    setFocus(next);
    const index = stops.findIndex((item) => item.read === next.read && item.difference.referenceStart === next.position);
    if (index >= 0) setStop(index);
  };
  /** Settings change what counts as a stop; the place in view stays put instead of jumping to another stop. */
  const keepPlace = () => { if (spot) setFocus(spot); };

  const addFolder = async (folder: SavedFolder) => {
    setLoadingFolder(true);
    setError(undefined);
    try {
      const files = await Promise.all(folder.files.map(async (file) => {
        const response = await fetch(`/api/attachments/${file.attachmentId}`);
        if (!response.ok) throw new Error(`${file.path} could not be fetched.`);
        return { path: `${folder.name}/${file.path}`, bytes: new Uint8Array(await response.arrayBuffer()) };
      }));
      const { reads: found } = groupReadEvidence(await importSequenceFiles(files));
      const known = new Map(all.filter((item) => item.copy && !item.key.startsWith(`${folder.id}:`)).map((item) => [item.copy!, item.group]));
      const groups = joinKnownCopies(found, known, folder.id);
      const added = found.map((item, index) => ({ key: `${folder.id}:${item.id}`, read: item.read, group: groups[index], from: folder.name, copy: copyKey(item) }));
      setExtra((list) => [...list.filter((item) => !item.key.startsWith(`${folder.id}:`)), ...added]);
      setChosen((keys) => [...new Set([...keys, ...added.map((item) => item.key)])]);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure));
    } finally {
      setLoadingFolder(false);
    }
  };

  const center = spot?.position ?? 0;
  const windowStart = Math.max(0, center - span);
  const windowEnd = Math.min(length, center + span);
  // The facts of a difference show when the open place is one of the stops.
  const shown = spot ? stops.find((item) => item.read === spot.read && item.difference.referenceStart === spot.position) : undefined;
  const context = shown ? differenceContext(shown.difference, record) : undefined;
  const spotAlignment = spot ? alignments[spot.read] : undefined;

  return (
    <div className="ln-pw-alignment">
      <section className="ln-pw-align-reads" aria-label="Reads">
        <div className="ln-pw-actions">
          <strong>{`${chosen.length} of ${all.length} reads`}</strong>
          <Button type="button" variant="primary" size="sm" disabled={running || !chosen.length} onClick={() => void run(chosen)}>{running ? "Aligning…" : "Align"}</Button>
          {folders.length ? (
            <select className="ln-pw-input ln-pw-narrow" value="" disabled={loadingFolder} aria-label="Add reads from a saved sequencing folder" onChange={(event) => {
              const folder = folders.find((item) => item.id === event.target.value);
              if (folder) void addFolder(folder);
            }}>
              <option value="">{loadingFolder ? "Opening…" : "Add reads from a saved folder…"}</option>
              {folders.map((folder) => <option key={folder.id} value={folder.id}>{folder.name}</option>)}
            </select>
          ) : null}
        </div>
        <ul>
          {all.map((item) => (
            <li key={item.key}>
              <label className="ln-pw-choice">
                <input type="checkbox" checked={chosen.includes(item.key)} onChange={(event) => setChosen((keys) => (event.target.checked ? [...keys, item.key] : keys.filter((key) => key !== item.key)))} />
                <span data-i18n-ignore>{item.read.name}</span>
                {item.from ? <small data-i18n-ignore>{item.from}</small> : null}
              </label>
            </li>
          ))}
        </ul>
        <div className="ln-pw-settings">
          <label>Quality threshold Q<input type="number" min={0} max={60} value={minQuality} onChange={(event) => { keepPlace(); setMinQuality(Math.max(0, Number(event.target.value))); }} /></label>
          <label>Double peak at<input type="number" min={10} max={90} step={5} value={Math.round(ratio * 100)} onChange={(event) => setRatio(Math.min(0.9, Math.max(0.1, Number(event.target.value) / 100)))} />%</label>
          <label className="ln-pw-choice"><input type="checkbox" checked={includeLow} onChange={(event) => { keepPlace(); setIncludeLow(event.target.checked); }} />Stop at low-quality differences too</label>
        </div>
        {error ? <p className="ln-pw-error" role="alert">{error}</p> : null}
      </section>

      {result ? (
        <>
          <section aria-label="Coverage">
            <svg className="ln-pw-coverage" viewBox={`0 0 1000 ${28 + placed.length * 14}`} role="img" aria-label="Coverage of the reference" onClick={(event) => {
              // A click on a read's row opens that read; elsewhere the read in view, or the first covering the place.
              const box = event.currentTarget.getBoundingClientRect();
              const position = Math.floor(((event.clientX - box.left) / box.width) * length);
              const row = Math.floor((((event.clientY - box.top) / box.height) * (28 + placed.length * 14) - 24) / 14);
              pick(position, row >= 0 && row < placed.length && covers(row, position) ? row : undefined);
            }}>
              {profile.ranges.map((range) => <rect key={range.start} data-state={range.state} x={(range.start / length) * 1000} width={Math.max(0.5, ((range.end - range.start) / length) * 1000)} y={4} height={14} />)}
              {spot ? <line className="ln-pw-coverage-mark" x1={(center / length) * 1000} x2={(center / length) * 1000} y1={0} y2={22 + placed.length * 14} /> : null}
              {placed.map(({ outcome }, index) => (outcome.aligned ? outcome.alignment.referenceSegments.map((segment, part) => (
                <rect key={`${index}-${part}`} className="ln-pw-read-span" data-reverse={outcome.alignment.orientation === "reverse" || undefined} x={(segment.start / length) * 1000} width={Math.max(1, ((segment.end - segment.start) / length) * 1000)} y={26 + index * 14} height={8} />
              )) : null))}
              {stops.map((item, index) => <rect key={`stop-${index}`} className="ln-pw-stop-tick" data-current={index === stop || undefined} x={(item.difference.referenceStart / length) * 1000 - 1} width={2} y={24 + item.read * 14} height={12} onClick={(event) => { event.stopPropagation(); go(() => index); }} />)}
            </svg>
            <p className="ln-pw-legend">
              {(Object.keys(stateLabels) as CoverageState[]).map((state) => <span key={state} data-state={state}>{stateLabels[state]}</span>)}
            </p>
            {placed.some(({ outcome }) => !outcome.aligned) ? (
              <ul className="ln-pw-warnings">
                {placed.filter(({ outcome }) => !outcome.aligned).map(({ choice, outcome }) => <li key={choice.key}><span data-i18n-ignore>{choice.read.name}</span>: {outcome.aligned ? "" : outcome.reason}</li>)}
              </ul>
            ) : null}
          </section>

          <section aria-label="Check record">
            <KeepCheck record={record} saved={saved} structure={structure} placed={placed} alignments={alignments} profile={profile} settings={{ minQuality, ratio, includeLow }} splits={splits} />
          </section>

          <section aria-label="Differences">
            <div className="ln-pw-actions">
              <Button type="button" variant="secondary" size="sm" disabled={!stops.length || stop <= 0} onClick={() => go((at) => Math.max(0, at - 1))}><ChevronLeft className="h-3.5 w-3.5" aria-hidden />Previous difference</Button>
              <Button type="button" variant="secondary" size="sm" disabled={!stops.length || stop >= stops.length - 1} onClick={() => go((at) => Math.min(stops.length - 1, at + 1))}>Next difference<ChevronRight className="h-3.5 w-3.5" aria-hidden /></Button>
              <span className="ln-pw-note">{stops.length ? `${Math.min(stop, stops.length - 1) + 1} of ${stops.length} · keys P and N` : "No differences to stop at"}</span>
            </div>
            {shown ? (
              <dl className="ln-pw-facts">
                <dt>Sequencing read</dt><dd data-i18n-ignore>{placed[shown.read].choice.read.name}</dd>
                <dt>Position</dt><dd className="ln-pw-mono">{shown.difference.kind === "insertion" ? `between ${shown.difference.referenceStart} and ${shown.difference.referenceStart + 1}` : shown.difference.referenceEnd - shown.difference.referenceStart > 1 ? `${shown.difference.referenceStart + 1}–${shown.difference.referenceEnd}` : String(shown.difference.referenceStart + 1)}</dd>
                <dt>Base change</dt><dd className="ln-pw-mono" data-i18n-ignore>{`${shown.difference.referenceBases || "-"} → ${shown.difference.readBases || "-"}`}</dd>
                <dt>Quality</dt><dd>{`${confidenceLabels[shown.difference.confidence]}${shown.difference.lowestQuality !== null ? ` · Q${shown.difference.lowestQuality}` : ""}`}</dd>
                {shown.difference.homopolymer ? <><dt>Homopolymer</dt><dd>Run of one base: check the trace before accepting.</dd></> : null}
                {context?.features.length ? <><dt>In features</dt><dd data-i18n-ignore>{context.features.join(", ")}</dd></> : null}
                {context?.coding.map((change) => <div key={change.feature} className="ln-pw-fact-pair"><dt>Codon</dt><dd className="ln-pw-mono" data-i18n-ignore>{`${change.feature} ${change.codon}: ${change.referenceCodon} (${change.referenceAminoAcid}) → ${change.readCodon} (${change.readAminoAcid})`}</dd></div>)}
                {context?.knownVariant ? <><dt>Known variant</dt><dd>{context.matchesKnownVariant ? "Matches the annotated variant: " : "Annotated variant here: "}<span data-i18n-ignore>{context.knownVariant}</span></dd></> : null}
              </dl>
            ) : null}
            {spot ? (
              <div className="ln-pw-actions ln-pw-spot">
                <label>Trace of<select className="ln-pw-input ln-pw-narrow" value={spot.read} onChange={(event) => pick(spot.position, Number(event.target.value))}>
                  {placed.map(({ choice }, index) => (alignments[index] ? <option key={choice.key} value={index}>{choice.read.name}</option> : null))}
                </select></label>
                <label>at position<input className="ln-pw-input ln-pw-narrow" type="number" min={1} max={length} value={spot.position + 1} onChange={(event) => { if (event.target.value) pick(Number(event.target.value) - 1, spot.read); }} /></label>
              </div>
            ) : null}
            <BaseWindow record={record} placed={placed} alignments={alignments} start={windowStart} end={windowEnd} mark={spot?.position} mixed={mixed} minQuality={minQuality} onPick={pick} />
            {spot && spotAlignment ? (
              <>
                <div className="ln-pw-actions">
                  <span className="ln-pw-shape">
                    <button type="button" aria-pressed={view === "aligned"} onClick={() => setView("aligned")}>Reference direction</button>
                    <button type="button" aria-pressed={view === "original"} onClick={() => setView("original")}>As recorded</button>
                  </span>
                  <button type="button" className="ln-pw-icon" aria-label="Zoom out" onClick={() => setZoom((value) => Math.max(1, value - 1))}><Minus className="h-3.5 w-3.5" aria-hidden /></button>
                  <button type="button" className="ln-pw-icon" aria-label="Zoom in" onClick={() => setZoom((value) => Math.min(6, value + 1))}><Plus className="h-3.5 w-3.5" aria-hidden /></button>
                  {mixed[spot.read].runs.length ? <span className="ln-pw-warn">{`${mixed[spot.read].runs.length} stretch(es) of double peaks: possibly a mixed clone`}</span> : null}
                </div>
                {covers(spot.read, spot.position)
                  ? <TraceView read={placed[spot.read].choice.read} alignment={spotAlignment} start={windowStart} end={windowEnd} view={view} zoom={zoom} mark={spot.position} mixed={new Set(mixed[spot.read].indices)} minQuality={minQuality} />
                  : <p className="ln-pw-note">This read has no evidence at this position.</p>}
              </>
            ) : null}
          </section>
        </>
      ) : running || first ? <p className="ln-pw-note">Aligning…</p> : <p className="ln-pw-note">Choose reads and align them to this sequence.</p>}
    </div>
  );
}

/** The bases around the open place: the reference on top, each read below, with matches dimmed and changes marked. A click opens that place. */
function BaseWindow({ record, placed, alignments, start, end, mark, mixed, minQuality, onPick }: {
  record: SequenceRecord;
  placed: Array<{ choice: ReadChoice; outcome: AlignmentOutcome }>;
  alignments: Array<ReadAlignment | undefined>;
  start: number;
  end: number;
  mark?: number;
  mixed: Array<{ indices: number[] }>;
  minQuality: number;
  onPick: (position: number, read?: number) => void;
}) {
  const positions = Array.from({ length: end - start }, (_, index) => start + index);
  const box = useRef<HTMLDivElement>(null);
  useCenteredMark(box, "[data-mark]", `${mark}|${start}`);
  return (
    <div className="ln-pw-bases" ref={box}>
      <div className="ln-pw-bases-row ln-pw-bases-ruler"><span>{start + 1}</span></div>
      <div className="ln-pw-bases-row"><span className="ln-pw-bases-name">Reference sequence</span><span className="ln-pw-bases-cells" data-i18n-ignore>{positions.map((position) => <span key={position} data-mark={position === mark || undefined} onClick={() => onPick(position)}>{record.sequence[position]}</span>)}</span></div>
      {placed.map(({ choice }, index) => {
        const alignment = alignments[index];
        if (!alignment) return null;
        const columns = new Map(alignment.columns.filter((column) => column.referencePosition !== null).map((column) => [column.referencePosition!, column]));
        const inserted = new Set(alignment.columns.flatMap((column, at, list) => (column.kind === "insertion" ? [list.slice(at).find((item) => item.referencePosition !== null)?.referencePosition] : [])));
        const doubles = new Set(mixed[index].indices);
        if (!positions.some((position) => columns.has(position))) return null;
        return (
          <div key={choice.key} className="ln-pw-bases-row">
            <span className="ln-pw-bases-name" data-i18n-ignore>{choice.read.name}</span>
            <span className="ln-pw-bases-cells" data-i18n-ignore>
            {positions.map((position) => {
              const column = columns.get(position);
              const low = column && column.quality !== null && column.quality < minQuality;
              return (
                <span key={position} onClick={() => onPick(position, index)} data-kind={column?.kind} data-low={low || undefined} data-insert={inserted.has(position) || undefined} data-double={column?.originalIndex !== null && column?.originalIndex !== undefined && doubles.has(column.originalIndex) ? true : undefined} data-mark={position === mark || undefined}>
                  {!column ? " " : column.kind === "match" ? "·" : column.kind === "deletion" ? "-" : column.readBase}
                </span>
              );
            })}
            </span>
          </div>
        );
      })}
    </div>
  );
}
