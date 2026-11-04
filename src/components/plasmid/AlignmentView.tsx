"use client";

import { ChevronLeft, ChevronRight, FileUp, Minus, Plus } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { differenceStops, rescore, runAlignRequest, type AlignmentOutcome, type AlignRequest } from "@/lib/plasmid/align";
import type { AlignResponse } from "@/lib/plasmid/align.worker";
import { coverageProfile, type CoverageState } from "@/lib/plasmid/coverage";
import { differenceContext } from "@/lib/plasmid/effects";
import { copyKey, groupReadEvidence, importSequenceFiles, joinKnownCopies } from "@/lib/plasmid/files";
import type { SangerRead, Segment, SequenceRecord } from "@/lib/plasmid/model";
import type { SavedFolder } from "@/lib/plasmid/store.server";
import { mixedPeaks } from "@/lib/plasmid/trace";
import type { StoredStructureElement } from "@/lib/plasmid/structure.server";
import { featureColor } from "@/lib/plasmid/workbench";
import { AlignedReads } from "./AlignedReads";
import { KeepCheck } from "./KeepCheck";
import { TraceView } from "./TraceView";

/** `copy` names the read by its file bytes (`copyKey`), so the same file added again from a folder joins its group. */
export type ReadChoice = { key: string; read: SangerRead; group: string; from?: string; copy?: string };
/** The place whose trace is open: a read and a reference position (0-based). */
export type Spot = { read: number; position: number };

/**
 * What a sequence's alignment keeps while its tab shows something else, so coming back neither aligns again nor loses the
 * settings. `marks` are the stops, for the map.
 */
export type AlignmentMemory = {
  left: string[];
  extra: ReadChoice[];
  minQuality: number;
  ratio: number;
  includeLow: boolean;
  hideEnds: boolean;
  regions: Record<string, Segment>;
  result?: { run: string; keys: string[]; outcomes: AlignmentOutcome[] };
  focus?: Spot;
  marks: Spot[];
};

export const stateLabels: Record<CoverageState, string> = { supported: "Supported", interrupted: "Evidence interrupted", low: "Low quality", conflict: "Conflict", uncovered: "Not covered" };
export const confidenceLabels = { high: "High quality", "low-quality": "Low quality", "no-quality": "No quality values", "ambiguous-base": "Ambiguous base" } as const;
const span = 30;
// Height of the overview's feature row, above the coverage and the reads.
const featureRow = 14;

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
    return Promise.resolve(runAlignRequest(request));
  }
}

/**
 * 测序比对 (F06, Q364–Q367, Q383): reads placed on the open sequence. An overview shows the features, the coverage by
 * evidence group and every read; below it the whole reference runs with the reads under it. The trace opens at any
 * position (R02): the difference in view, or a place picked in the overview, in the bases or by number. One quality
 * threshold judges everything shown (R03). It draws no conclusion: checking and confirming come with the check records.
 */
export function AlignmentView({ record, reads, folders, saved, structure, splits, memory, onKeep, onOpenFiles }: {
  record: SequenceRecord;
  reads: ReadChoice[];
  folders: SavedFolder[];
  /** The saved version the record is; a check record needs one. */
  saved?: { productId: string; versionId: string };
  structure: StoredStructureElement[];
  /** Reads a person split off a same-bases group, with the reason (Q371). */
  splits: Record<string, string>;
  memory?: AlignmentMemory;
  onKeep: (memory: AlignmentMemory) => void;
  onOpenFiles: () => void;
}) {
  const [extra, setExtra] = useState<ReadChoice[]>(memory?.extra ?? []);
  const all = useMemo(() => [...reads, ...extra], [reads, extra]);
  // Reads taken out by hand; everything else open is aligned, so a read opened later joins by itself.
  const [left, setLeft] = useState<string[]>(memory?.left ?? []);
  const chosen = useMemo(() => all.filter((item) => !left.includes(item.key)), [all, left]);
  const chosenKeys = chosen.map((item) => item.key).join("\n");
  const [minQuality, setMinQuality] = useState(memory?.minQuality ?? 20);
  const [ratio, setRatio] = useState(memory?.ratio ?? 0.3);
  const [includeLow, setIncludeLow] = useState(memory?.includeLow ?? false);
  const [hideEnds, setHideEnds] = useState(memory?.hideEnds ?? true);
  const [regions, setRegions] = useState<Record<string, Segment>>(memory?.regions ?? {});
  const [regionFor, setRegionFor] = useState<string>();
  const [regionText, setRegionText] = useState({ start: "1", end: String(record.sequence.length) });
  const [result, setResult] = useState(memory?.result);
  const [error, setError] = useState<{ keys: string; message: string }>();
  const [stop, setStop] = useState(0);
  const [view, setView] = useState<"aligned" | "original">("aligned");
  const [zoom, setZoom] = useState(2);
  const [loadingFolder, setLoadingFolder] = useState(false);
  // Set by picking a place; cleared by "next difference", which then shows the difference in view.
  const [focus, setFocus] = useState<Spot | undefined>(memory?.focus);
  // Goes up when the place changes from elsewhere than the bases, so the long view scrolls there.
  const [jump, setJump] = useState(memory?.focus ? 1 : 0);

  const request = useCallback((picked: ReadChoice[], held: Record<string, Segment>) => alignReads({
    reference: record.sequence,
    topology: record.topology,
    reads: picked.map(({ key, read }) => ({ name: read.name, bases: read.bases, quality: read.quality, ...(held[key] ? { region: held[key] } : {}) })),
  }), [record.sequence, record.topology]);
  // What the result must have been made from; anything else aligns again.
  const run = JSON.stringify([chosenKeys, chosen.map((item) => regions[item.key] ?? null), record.sequence.length]);

  // Whatever is chosen is aligned straight away; a newer choice overrides a run still going.
  useEffect(() => {
    if (!chosen.length || result?.run === run) return;
    let cancelled = false;
    request(chosen, regions)
      .then((outcomes) => {
        if (cancelled) return;
        setResult({ run, keys: chosen.map((item) => item.key), outcomes });
        setStop(0);
      })
      .catch((failure) => { if (!cancelled) setError({ keys: run, message: failure instanceof Error ? failure.message : String(failure) }); });
    return () => { cancelled = true; };
    // `run` says whether the reads or their regions really changed; `chosen` is a new list whenever a folder loads.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run, request]);
  const failed = error?.keys === run ? error.message : undefined;
  const running = chosen.length > 0 && !failed && result?.run !== run;

  const placed = useMemo(() => (result ? result.keys.flatMap((key, index) => {
    const choice = chosen.find((item) => item.key === key);
    return choice ? [{ choice, outcome: result.outcomes[index] }] : [];
  }) : []), [result, chosen]);
  const length = record.sequence.length;
  const circularLength = record.topology === "circular" ? length : undefined;
  const alignments = useMemo(() => placed.map(({ outcome }) => (outcome.aligned ? rescore(outcome.alignment, minQuality, circularLength) : undefined)), [placed, minQuality, circularLength]);
  const profile = useMemo(() => coverageProfile(length, placed.flatMap(({ choice }, index) => (alignments[index] ? [{ alignment: alignments[index], group: choice.group }] : [])), { minQuality }), [placed, alignments, length, minQuality]);
  const stops = useMemo(() => differenceStops(alignments, includeLow), [alignments, includeLow]);
  const mixed = useMemo(() => placed.map(({ choice }) => mixedPeaks(choice.read, ratio, minQuality)), [placed, ratio, minQuality]);
  const current = stops[Math.min(stop, stops.length - 1)];
  const go = (index: number) => {
    setFocus(undefined);
    setStop(index);
    setJump((value) => value + 1);
  };

  useEffect(() => {
    onKeep({ left, extra, minQuality, ratio, includeLow, hideEnds, regions, result, focus, marks: stops.map((item) => ({ read: item.read, position: item.difference.referenceStart })) });
    // `stops` follows from the values listed; `onKeep` is a new function each render of the workbench.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [left, extra, minQuality, ratio, includeLow, hideEnds, regions, result, focus]);

  const covers = (read: number, position: number) => Boolean(alignments[read]?.columns.some((column) => column.referencePosition === position));
  const firstAligned = alignments.findIndex(Boolean);
  const spot: Spot | undefined = focus ?? (current ? { read: current.read, position: current.difference.referenceStart } : firstAligned >= 0 ? { read: firstAligned, position: alignments[firstAligned]!.referenceSegments[0].start } : undefined);
  // "Next" and "previous" go from the place in view, which need not be a stop.
  const shownStop = spot ? stops.findIndex((item) => item.read === spot.read && item.difference.referenceStart === spot.position) : -1;
  const nextStop = shownStop >= 0 ? (shownStop + 1 < stops.length ? shownStop + 1 : -1) : spot ? stops.findIndex((item) => item.difference.referenceStart >= spot.position) : -1;
  const previousStop = shownStop >= 0 ? shownStop - 1 : spot ? stops.findLastIndex((item) => item.difference.referenceStart <= spot.position) : -1;
  useEffect(() => {
    const keys = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLElement && event.target.closest("input, textarea, select")) return;
      if ((event.key === "n" || event.key === "N") && nextStop >= 0) go(nextStop);
      if ((event.key === "p" || event.key === "P") && previousStop >= 0) go(previousStop);
    };
    window.addEventListener("keydown", keys);
    return () => window.removeEventListener("keydown", keys);
  }, [nextStop, previousStop]);
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
    } catch (failure) {
      setError({ keys: run, message: failure instanceof Error ? failure.message : String(failure) });
    } finally {
      setLoadingFolder(false);
    }
  };

  const center = spot?.position ?? 0;
  const windowStart = Math.max(0, center - span);
  const windowEnd = Math.min(length, center + span);
  // The facts of a difference show when the open place is one of the stops.
  const shown = stops[shownStop];
  const context = shown ? differenceContext(shown.difference, record) : undefined;
  const alignedReads = useMemo(() => placed.map(({ choice }, index) => ({ read: choice.read, alignment: alignments[index], doubles: new Set(mixed[index].indices) })), [placed, alignments, mixed]);
  const overviewRows = 28 + featureRow + placed.length * 14;
  const pieces = record.features.filter((feature) => feature.type !== "source").flatMap((feature, index) => feature.segments.map((segment, part) => ({ key: `${index}-${part}`, feature, segment })));
  const spotAlignment = spot ? alignments[spot.read] : undefined;

  return (
    <div className="ln-pw-alignment">
      <section className="ln-pw-align-reads" aria-label="Reads">
        <div className="ln-pw-actions">
          {all.length ? <strong>{`${chosen.length} of ${all.length} reads`}</strong> : <strong>No reads open yet</strong>}
          {running ? <span className="ln-pw-note">Aligning…</span> : null}
          <Button type="button" variant="secondary" size="sm" onClick={onOpenFiles}><FileUp className="h-3.5 w-3.5" aria-hidden />Open read files</Button>
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
                <input type="checkbox" checked={!left.includes(item.key)} onChange={(event) => setLeft((keys) => (event.target.checked ? keys.filter((key) => key !== item.key) : [...keys, item.key]))} />
                <span data-i18n-ignore>{item.read.name}</span>
                {item.from ? <small data-i18n-ignore>{item.from}</small> : null}
              </label>
              <ReadPlacement
                outcome={placed.find(({ choice }) => choice.key === item.key)?.outcome}
                region={regions[item.key]}
                editing={regionFor === item.key}
                text={regionText}
                length={record.sequence.length}
                onEdit={() => setRegionFor(item.key)}
                onText={setRegionText}
                onCancel={() => setRegionFor(undefined)}
                onHold={(region) => {
                  setRegions((current) => (region ? { ...current, [item.key]: region } : Object.fromEntries(Object.entries(current).filter(([key]) => key !== item.key))));
                  setRegionFor(undefined);
                }}
              />
            </li>
          ))}
        </ul>
        <div className="ln-pw-settings">
          <label>Quality threshold Q<input type="number" min={0} max={60} value={minQuality} onChange={(event) => { keepPlace(); setMinQuality(Math.max(0, Number(event.target.value))); }} /></label>
          <label>Double peak at<input type="number" min={10} max={90} step={5} value={Math.round(ratio * 100)} onChange={(event) => setRatio(Math.min(0.9, Math.max(0.1, Number(event.target.value) / 100)))} />%</label>
          <label className="ln-pw-choice"><input type="checkbox" checked={includeLow} onChange={(event) => { keepPlace(); setIncludeLow(event.target.checked); }} />Stop at low-quality differences too</label>
          <label className="ln-pw-choice"><input type="checkbox" checked={hideEnds} onChange={(event) => setHideEnds(event.target.checked)} />Hide low-quality read ends</label>
        </div>
        {failed ? <p className="ln-pw-error" role="alert">{failed}</p> : null}
      </section>

      {placed.length ? (
        <>
          <section aria-label="Coverage">
            <svg className="ln-pw-coverage" viewBox={`0 0 1000 ${overviewRows}`} role="img" aria-label="Features, coverage and reads along the reference" onClick={(event) => {
              // A click on a read's row opens that read; elsewhere the read in view, or the first covering the place.
              const box = event.currentTarget.getBoundingClientRect();
              const position = Math.floor(((event.clientX - box.left) / box.width) * length);
              const row = Math.floor((((event.clientY - box.top) / box.height) * overviewRows - 24 - featureRow) / 14);
              pick(position, row >= 0 && row < placed.length && covers(row, position) ? row : undefined);
              setJump((value) => value + 1);
            }}>
              {pieces.map(({ key, feature, segment }) => <rect key={key} fill={featureColor(feature)} x={(segment.start / length) * 1000} width={Math.max(1, ((segment.end - segment.start) / length) * 1000)} y={2} height={featureRow - 6}><title>{feature.name}</title></rect>)}
              {profile.ranges.map((range) => <rect key={range.start} data-state={range.state} x={(range.start / length) * 1000} width={Math.max(0.5, ((range.end - range.start) / length) * 1000)} y={4 + featureRow} height={14} />)}
              {spot ? <line className="ln-pw-coverage-mark" x1={(center / length) * 1000} x2={(center / length) * 1000} y1={0} y2={22 + featureRow + placed.length * 14} /> : null}
              {placed.map(({ outcome }, index) => (outcome.aligned ? outcome.alignment.referenceSegments.map((segment, part) => {
                const y = 26 + featureRow + index * 14;
                const from = (segment.start / length) * 1000;
                const to = Math.max(from + 1, (segment.end / length) * 1000);
                const reverse = alignments[index]?.orientation === "reverse";
                const tip = Math.min(6, (to - from) / 2);
                const shape = reverse ? `${from},${y + 4} ${from + tip},${y} ${to},${y} ${to},${y + 8} ${from + tip},${y + 8}` : `${from},${y} ${to - tip},${y} ${to},${y + 4} ${to - tip},${y + 8} ${from},${y + 8}`;
                return <polygon key={`${index}-${part}`} className="ln-pw-read-span" data-reverse={reverse || undefined} points={shape} />;
              }) : null))}
              {stops.map((item, index) => <rect key={`stop-${index}`} className="ln-pw-stop-tick" data-current={index === shownStop || undefined} x={(item.difference.referenceStart / length) * 1000 - 1} width={2} y={24 + featureRow + item.read * 14} height={12} onClick={(event) => { event.stopPropagation(); go(index); }} />)}
            </svg>
            <p className="ln-pw-legend">
              {(Object.keys(stateLabels) as CoverageState[]).map((state) => <span key={state} data-state={state}>{stateLabels[state]}</span>)}
            </p>
          </section>

          <section aria-label="Differences">
            <div className="ln-pw-actions ln-pw-steps">
              <Button type="button" variant="secondary" size="sm" disabled={previousStop < 0} onClick={() => go(previousStop)}><ChevronLeft className="h-3.5 w-3.5" aria-hidden />Previous difference</Button>
              <Button type="button" variant="secondary" size="sm" disabled={nextStop < 0} onClick={() => go(nextStop)}>Next difference<ChevronRight className="h-3.5 w-3.5" aria-hidden /></Button>
              <span className="ln-pw-note">{!stops.length ? "No differences to stop at" : shownStop >= 0 ? `${shownStop + 1} of ${stops.length} · keys P and N` : `${stops.length} differences to stop at · keys P and N`}</span>
              {spot ? (
                <span className="ln-pw-actions ln-pw-spot">
                  <label>Trace of<select className="ln-pw-input ln-pw-narrow" value={spot.read} onChange={(event) => pick(spot.position, Number(event.target.value))}>
                    {placed.map(({ choice }, index) => (alignments[index] ? <option key={choice.key} value={index}>{choice.read.name}</option> : null))}
                  </select></label>
                  <label>at position<input className="ln-pw-input ln-pw-narrow" type="number" min={1} max={length} value={spot.position + 1} onChange={(event) => { if (event.target.value) { pick(Number(event.target.value) - 1, spot.read); setJump((value) => value + 1); } }} /></label>
                </span>
              ) : null}
            </div>
            <AlignedReads
              record={record}
              reads={alignedReads}
              minQuality={minQuality}
              hideEnds={hideEnds}
              spot={spot}
              jump={jump}
              onPick={pick}
              detail={spot && spotAlignment ? (
                <div className="ln-pw-spot-detail">
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
                </div>
              ) : null}
            />
          </section>
          <section aria-label="Check record">
            <KeepCheck record={record} saved={saved} structure={structure} placed={placed} alignments={alignments} profile={profile} settings={{ minQuality, ratio, includeLow }} splits={splits} />
          </section>
        </>
      ) : running ? null : <p className="ln-pw-note">{all.length ? "Tick a read to align it to this sequence." : "Open .ab1 or .seq files, or add reads from a saved folder. They align to this sequence by themselves."}</p>}
    </div>
  );
}

/** Where a read went, and the way to hold it to a stretch of the reference when it fits a repeat equally well elsewhere. */
function ReadPlacement({ outcome, region, editing, text, length, onEdit, onText, onCancel, onHold }: {
  outcome?: AlignmentOutcome;
  region?: Segment;
  editing: boolean;
  text: { start: string; end: string };
  length: number;
  onEdit: () => void;
  onText: (text: { start: string; end: string }) => void;
  onCancel: () => void;
  onHold: (region: Segment | undefined) => void;
}) {
  const start = Number(text.start);
  const end = Number(text.end);
  const valid = Number.isInteger(start) && Number.isInteger(end) && start >= 1 && end <= length && end > start;
  if (editing) {
    return (
      <span className="ln-pw-actions ln-pw-region">
        <input className="ln-pw-input ln-pw-narrow" type="number" min={1} max={length} value={text.start} aria-label="From" onChange={(event) => onText({ ...text, start: event.target.value })} />
        <span>–</span>
        <input className="ln-pw-input ln-pw-narrow" type="number" min={1} max={length} value={text.end} aria-label="To" onChange={(event) => onText({ ...text, end: event.target.value })} />
        <button type="button" className="ln-pw-link" disabled={!valid} onClick={() => onHold({ start: start - 1, end })}>Align only here</button>
        <button type="button" className="ln-pw-link" onClick={onCancel}>Close</button>
      </span>
    );
  }
  const multi = outcome?.aligned && outcome.alignment.secondary.length > 0;
  return (
    <>
      {outcome && !outcome.aligned ? <small className="ln-pw-warn">{outcome.reason}</small> : null}
      {multi ? <small className="ln-pw-warn">Fits more than one place</small> : null}
      {region ? <small className="ln-pw-mono">{`${region.start + 1}–${region.end}`}</small> : null}
      {region ? <button type="button" className="ln-pw-link" onClick={() => onHold(undefined)}>Align anywhere</button> : outcome ? <button type="button" className="ln-pw-link" onClick={onEdit}>Choose a region</button> : null}
    </>
  );
}
