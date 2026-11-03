"use client";

import { Download, FileUp, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { copyCalculation } from "@/lib/calculators/clipboard";
import { reverseComplement } from "@/lib/sequence";
import { builtInElements, codonMarks, detectFeatures, openReadingFrames, type LibraryElement } from "@/lib/plasmid/feature-library";
import { copyKey, expandZip, groupReadEvidence, importSequenceFiles, type ImportedSource, type SourceFile } from "@/lib/plasmid/files";
import { formatGenbank } from "@/lib/plasmid/genbank";
import { clockwiseSegments, formatSegments, selectionSegments } from "@/lib/plasmid/layout";
import { completenessKinds, featureLength, type Completeness, type CompletenessSource, type Segment, type SequenceFeature, type SequenceRecord } from "@/lib/plasmid/model";
import type { PlasmidChoice, SavedFolder } from "@/lib/plasmid/store.server";
import type { StoredStructureElement } from "@/lib/plasmid/structure.server";
import { sixFrameTranslations, translate } from "@/lib/plasmid/translate";
import { completenessLabels, declaredCompleteness, defaultCompleteness, downloadText, exportFasta, genbankNotes, readAsRecord, readSummary, strandArrow, strandName, topologyLabels, workbenchItems, type WorkbenchItem } from "@/lib/plasmid/workbench";
import { AlignmentView } from "./AlignmentView";
import { MapExport } from "./MapExport";
import { FeatureTable } from "./FeatureTable";
import { ImportDropZone, ImportResults } from "./ImportPanel";
import { AddToLibrary, LibraryList } from "./LibraryPanel";
import { PlasmidMap } from "./PlasmidMap";
import { SaveFolder, SavedFolders, SaveToInventory } from "./SavePanels";
import { SearchPanel } from "./SearchPanel";
import { SequenceView, type CodingTrack } from "./SequenceView";
import { StructurePanel } from "./StructurePanel";
import "./plasmid-workbench.css";

type Selection = { segments: Segment[]; feature?: number };
type Tab = "map" | "sequence" | "features" | "structure" | "alignment";

const tabLabels: Record<Tab, string> = { map: "Map", sequence: "Sequence", features: "Features", structure: "Structure", alignment: "Sequencing alignment" };

/**
 * 质粒工作台 (Q271): open files in the browser, look at a sequence as a map, as bases and
 * as a feature table with one shared selection, and export it. Reads open as linear
 * fragments.
 */
export function PlasmidWorkbench({ initial, plasmids = [], folders = [], library = [] }: {
  initial?: { record: SequenceRecord; label: string; productId: string; versionId: string; completeness: Completeness; completenessSource: CompletenessSource | null; structure: StoredStructureElement[] };
  plasmids?: PlasmidChoice[];
  folders?: SavedFolder[];
  /** The lab's own feature-library entries (Q362). */
  library?: LibraryElement[];
}) {
  const [sources, setSources] = useState<ImportedSource[]>([]);
  const [files, setFiles] = useState<SourceFile[]>([]);
  const [progress, setProgress] = useState<{ done: number; total: number }>();
  const [importError, setImportError] = useState<string>();
  const [showImport, setShowImport] = useState(!initial);
  const [activeKey, setActiveKey] = useState<string | undefined>(initial ? "initial" : undefined);
  const [tab, setTab] = useState<Tab>("map");
  const [allFrames, setAllFrames] = useState(false);
  // Plasmids the open items were saved to in this visit, so their expected structure can be kept on them.
  const [savedTo, setSavedTo] = useState<Record<string, { productId: string; versionId: string }>>({});
  const [shape, setShape] = useState<"circular" | "linear">();
  const [selection, setSelection] = useState<Selection>({ segments: [] });
  // What each open item's completeness is and who said so; a choice in the header is a person's (Q370).
  const [completeness, setCompleteness] = useState<Record<string, { completeness: Completeness; source: CompletenessSource | null }>>(initial ? { initial: { completeness: initial.completeness, source: initial.completenessSource } } : {});
  // Detected features taken out, per open item; they stay out until the files are opened again.
  const [removed, setRemoved] = useState<Record<string, string[]>>({});

  // Reads a person split off a "same bases" group, with the reason they gave (Q371).
  const [apart, setApart] = useState<Record<string, string>>({});
  const evidence = useMemo(() => groupReadEvidence(sources, new Set(Object.keys(apart))), [sources, apart]);
  const items = useMemo(() => {
    const opened = workbenchItems(sources);
    return initial ? [{ kind: "record" as const, key: "initial", record: initial.record }, ...opened] : opened;
  }, [sources, initial]);
  const active = items.find((item) => item.key === activeKey);
  const opened = useMemo(() => (active ? (active.kind === "record" ? active.record : readAsRecord(active.read)) : undefined), [active]);
  const elements = useMemo(() => [...builtInElements(), ...library], [library]);
  const detected = useMemo(() => (opened ? detectFeatures(opened, elements) : []), [opened, elements]);
  const kept = useMemo(() => detected.filter((item) => !(removed[activeKey ?? ""] ?? []).includes(item.key)), [detected, removed, activeKey]);
  // What every view shows and what is saved or exported: the file's features, then the library's matches (Q363).
  const record = useMemo(() => (opened ? { ...opened, features: [...opened.features, ...kept.map((item) => item.feature)] } : undefined), [opened, kept]);
  const coding = useMemo(() => (record ? codingTracks(record, allFrames) : []), [record, allFrames]);
  const source = active?.source ? sources.find((item) => item.path === active.source) : undefined;
  const circular = record?.topology === "circular";
  const currentShape = shape ?? (circular ? "circular" : "linear");
  const said = active ? completeness[active.key] ?? defaultCompleteness(active) : { completeness: "unknown" as const, source: null };
  const currentCompleteness = said.completeness;
  const declared = active?.kind === "record" ? declaredCompleteness(active.record) : undefined;
  const original = source ? files.find((file) => file.path === (source.container ?? source.path)) : undefined;
  const tabs: Tab[] = active?.kind === "read" ? ["sequence", "structure"] : ["map", "sequence", "features", "structure", "alignment"];
  const view = tabs.includes(tab) ? tab : tabs[0];
  // The saved version the open record is, if any: a check can only be kept against one (C1).
  const saved = active?.key === "initial" && initial ? { productId: initial.productId, versionId: initial.versionId } : activeKey ? savedTo[activeKey] : undefined;
  const productId = saved?.productId;
  const notes = active?.kind === "record" && record ? genbankNotes(record) : [];

  const load = useCallback(async (next: SourceFile[]) => {
    setImportError(undefined);
    setProgress({ done: 0, total: next.length });
    try {
      const imported = await importSequenceFiles(next, { onProgress: (done, total) => setProgress({ done, total }) });
      setFiles(next);
      setSources(imported);
      return imported;
    } catch (failure) {
      setImportError(`The files could not be read: ${failure instanceof Error ? failure.message : String(failure)}`);
      return undefined;
    } finally {
      setProgress(undefined);
    }
  }, []);

  const open = useCallback(async (picked: SourceFile[]) => {
    if (!picked.length) return;
    const imported = await load(picked);
    if (!imported) return;
    setShowImport(false);
    // Open a whole sequence first when there is one; reads are fragments of it.
    const choices = workbenchItems(imported);
    setActiveKey((choices.find((item) => item.kind === "record") ?? choices[0])?.key);
    setSelection({ segments: [] });
    setShape(undefined);
    setRemoved({});
  }, [load]);

  // A ZIP member cannot be swapped inside its archive, so the archive is unpacked into its members first.
  const retry = useCallback(async (path: string, replacement: SourceFile) => {
    const archive = sources.find((source) => source.path === path)?.container;
    const next = files.flatMap((file) => {
      if (file.path === path) return [replacement];
      if (file.path !== archive) return [file];
      return expandZip(file.path, file.bytes).files.map((member) => (member.path === path ? replacement : member));
    });
    await load(next);
  }, [files, sources, load]);

  useEffect(() => {
    const clear = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelection({ segments: [] });
    };
    window.addEventListener("keydown", clear);
    return () => window.removeEventListener("keydown", clear);
  }, []);

  const choose = (key: string) => {
    setActiveKey(key);
    setSelection({ segments: [] });
    setShape(undefined);
    setShowImport(false);
  };
  const selectFeature = (index: number) => {
    if (!record) return;
    setSelection({ segments: clockwiseSegments(record.features[index]), feature: index });
  };
  const selectRange = (start: number, end: number) => setSelection({ segments: selectionSegments(start, end, record?.sequence.length ?? 0, false) });

  const records = items.filter((item): item is Extract<WorkbenchItem, { kind: "record" }> => item.kind === "record");
  const reads = items.filter((item): item is Extract<WorkbenchItem, { kind: "read" }> => item.kind === "read");
  const groupOf = (key: string) => evidence.groups.find((group) => group.readIds.includes(key));
  const groupSize = (key: string) => groupOf(key)?.readIds.length ?? 1;
  // Identical bases alone only suggest one run; a person may split such a read off.
  const onlySameBases = (key: string) => groupOf(key)?.reasons.every((reason) => reason === "identical-bases") ?? false;
  const selectedBases = record ? selection.segments.map((segment) => record.sequence.slice(segment.start, segment.end)).join("") : "";
  const feature = record && selection.feature !== undefined ? record.features[selection.feature] : undefined;
  const autoFrom = opened?.features.length ?? 0;
  const auto = {
    from: autoFrom,
    identities: kept.map((item) => item.identity),
    onRemove: (index: number) => {
      const key = kept[index - autoFrom]?.key;
      if (!key || !activeKey) return;
      setRemoved((current) => ({ ...current, [activeKey]: [...(current[activeKey] ?? []), key] }));
      setSelection({ segments: [] });
    },
  };

  return (
    <div className="ln-pw">
      <aside className="ln-pw-rail" aria-label="Open files">
        <Button type="button" variant="secondary" size="sm" onClick={() => setShowImport(true)}><FileUp className="h-3.5 w-3.5" aria-hidden />Open files</Button>
        {records.length ? (
          <section>
            <h2>Sequences</h2>
            <ul>
              {records.map((item) => (
                <li key={item.key}>
                  <button type="button" data-active={item.key === activeKey || undefined} onClick={() => choose(item.key)}>
                    <span data-i18n-ignore>{item.record.name}</span>
                    <small>{`${item.record.sequence.length.toLocaleString("en-US")} bp · ${topologyLabels[item.record.topology]}`}</small>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
        {reads.length ? (
          <section>
            <h2>Sequencing reads</h2>
            <p className="ln-pw-note">{`${reads.length} reads, ${evidence.groups.length} independent`}</p>
            <ul>
              {reads.map((item) => (
                <li key={item.key}>
                  <button type="button" data-active={item.key === activeKey || undefined} onClick={() => choose(item.key)}>
                    <span data-i18n-ignore>{item.read.name}</span>
                    <small>{`${item.read.bases.length} nt${item.read.quality ? "" : " · no quality values"}${groupSize(item.key) > 1 ? (onlySameBases(item.key) ? ` · possibly the same run as ${groupSize(item.key) - 1} other file(s)` : ` · same run as ${groupSize(item.key) - 1} other file(s)`) : ""}`}</small>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
        {reads.length ? <SaveFolder key={files.map((file) => file.path).join("|")} sources={sources} files={files} plasmids={plasmids} /> : null}
        {sources.length ? (
          <section>
            <h2>Files</h2>
            <ImportResults sources={sources} onRetry={retry} />
          </section>
        ) : null}
        <SavedFolders folders={folders} onOpen={open} />
      </aside>

      <section className="ln-pw-main" aria-label="Workbench">
        {showImport || !record || !active ? (
          <div className="ln-pw-start">
            <ImportDropZone progress={progress} error={importError} onFiles={open} />
            {record ? <button type="button" className="ln-pw-link" onClick={() => setShowImport(false)}><X className="h-3 w-3" aria-hidden />Back to the open sequence</button> : null}
          </div>
        ) : (
          <>
            <header className="ln-pw-head">
              <div className="ln-pw-title">
                <h2 data-i18n-ignore>{record.name}</h2>
                <p>
                  <span>{`${record.sequence.length.toLocaleString("en-US")} ${active.kind === "read" ? "nt" : "bp"}`}</span>
                  <span>{topologyLabels[record.topology]}</span>
                  <label className="ln-pw-inline">
                    <span className="sr-only">Completeness</span>
                    <select value={currentCompleteness} onChange={(event) => setCompleteness({ ...completeness, [active.key]: { completeness: event.target.value as Completeness, source: "user" } })}>
                      {completenessKinds.map((value) => <option key={value} value={value}>{completenessLabels[value]}</option>)}
                    </select>
                  </label>
                  {active.source ? <span className="ln-pw-path" data-i18n-ignore>{active.source}</span> : initial ? <span>{initial.label}</span> : null}
                </p>
                {active.kind !== "read" ? <CompletenessNote completeness={currentCompleteness} source={said.source} circular={record.topology === "circular"} declared={declared?.text} onConfirm={() => setCompleteness({ ...completeness, [active.key]: { completeness: currentCompleteness, source: "user" } })} /> : null}
                {source?.unsupported.length ? (
                  <details className="ln-pw-compat">
                    <summary>{`Not read from this file (${source.unsupported.length})`}</summary>
                    <ul>{source.unsupported.map((item, index) => <li key={index}>{item.message}</li>)}</ul>
                  </details>
                ) : null}
                {source?.warnings.length ? <ul className="ln-pw-warnings">{source.warnings.map((item, index) => <li key={index}>{item.message}</li>)}</ul> : null}
                {notes.length ? (
                  <details className="ln-pw-compat">
                    <summary>{`Not written to GenBank (${notes.length})`}</summary>
                    <ul>{notes.map((note) => <li key={note}>{note}</li>)}</ul>
                  </details>
                ) : null}
              </div>
              <div className="ln-pw-actions">
                <Button type="button" variant="secondary" size="sm" onClick={() => downloadText(`${record.name}.fasta`, exportFasta(record))}><Download className="h-3.5 w-3.5" aria-hidden />FASTA</Button>
                {active.kind === "record" ? (
                  <Button type="button" variant="secondary" size="sm" onClick={() => downloadText(`${record.name}.gb`, formatGenbank(record))}><Download className="h-3.5 w-3.5" aria-hidden />GenBank</Button>
                ) : null}
                {active.kind === "record" ? (
                  <SaveToInventory
                    key={active.key}
                    record={record}
                    completeness={currentCompleteness}
                    completenessSource={said.source}
                    format={source && source.format !== "zip" && source.format !== "attachment" && source.format !== "unknown" ? source.format : undefined}
                    original={original}
                    plasmids={plasmids}
                    defaultProductId={active.key === "initial" ? initial?.productId : undefined}
                    onSaved={(where) => setSavedTo((current) => ({ ...current, [active.key]: where }))}
                  />
                ) : null}
              </div>
            </header>

            <div className="ln-pw-tabs" role="tablist" aria-label="Views">
              {tabs.map((value) => (
                <button key={value} type="button" role="tab" aria-selected={view === value} onClick={() => setTab(value)}>
                  {value === "features" ? `Features (${record.features.length})` : tabLabels[value]}
                </button>
              ))}
              {view === "sequence" ? (
                <label className="ln-pw-choice ln-pw-shape">
                  <input type="checkbox" checked={allFrames} onChange={(event) => setAllFrames(event.target.checked)} />All six reading frames
                </label>
              ) : null}
              {view === "map" && circular ? (
                <span className="ln-pw-shape">
                  <button type="button" aria-pressed={currentShape === "circular"} onClick={() => setShape("circular")}>Circular</button>
                  <button type="button" aria-pressed={currentShape === "linear"} onClick={() => setShape("linear")}>Linear</button>
                </span>
              ) : null}
              {view === "map" ? <MapExport name={record.name} /> : null}
            </div>

            {active.kind === "read" ? <ReadFacts key={active.key} item={active} groupSize={groupSize(active.key)} onlySameBases={onlySameBases(active.key)} apartReason={apart[active.key]} onSplit={(reason) => setApart({ ...apart, [active.key]: reason })} onJoin={() => setApart(Object.fromEntries(Object.entries(apart).filter(([key]) => key !== active.key)))} /> : null}

            <div className="ln-pw-view">
              {view === "map" ? (
                <>
                  <div className="ln-pw-map"><PlasmidMap record={record} shape={currentShape} selection={selection.segments} selectedFeature={selection.feature} autoFrom={autoFrom} onSelectFeature={selectFeature} /></div>
                  <FeatureTable record={record} selectedFeature={selection.feature} onSelectFeature={selectFeature} auto={auto} />
                </>
              ) : null}
              {view === "sequence" ? (
                <SequenceView record={record} coding={coding} autoFrom={autoFrom} selection={selection.segments} selectedFeature={selection.feature} onSelectRange={selectRange} onSelectFeature={selectFeature} />
              ) : null}
              {view === "features" ? (
                <>
                  <FeatureTable record={record} selectedFeature={selection.feature} onSelectFeature={selectFeature} auto={auto} />
                  <LibraryList entries={library} />
                </>
              ) : null}
              {view === "structure" ? (
                <StructurePanel
                  key={`${active.key}:${productId ?? ""}`}
                  record={record}
                  quality={active.kind === "read" ? active.read.quality : null}
                  productId={productId}
                  initial={active.key === "initial" ? initial?.structure ?? [] : []}
                  peptides={elements.filter((element) => element.kind === "protein")}
                  selectionPeptide={selectionPeptide(record, selection, feature)}
                />
              ) : null}
              {view === "alignment" ? (
                <AlignmentView
                  key={active.key}
                  record={record}
                  reads={reads.map((item) => {
                    const found = evidence.reads.find((read) => read.id === item.key);
                    return { key: item.key, read: item.read, group: found?.group ?? item.key, copy: found ? copyKey(found) : undefined };
                  })}
                  folders={folders}
                  saved={saved}
                  structure={active.key === "initial" ? (initial?.structure ?? []) : []}
                  splits={apart}
                />
              ) : null}
            </div>
          </>
        )}
      </section>

      <aside className="ln-pw-side" aria-label="Selection">
        {record ? <SearchPanel key={active?.key} record={record} onSelect={(segments) => setSelection({ segments })} /> : null}
        <h2>Selection</h2>
        {feature ? (
          <dl className="ln-pw-facts">
            <dt>Feature</dt><dd data-i18n-ignore>{feature.name}</dd>
            <dt>Type</dt><dd data-i18n-ignore>{feature.type}</dd>
            <dt>Location</dt><dd className="ln-pw-mono">{formatSegments(clockwiseSegments(feature))}</dd>
            <dt>Strand</dt><dd>{strandName(feature.strand)}</dd>
            <dt>Length</dt><dd className="ln-pw-mono">{`${featureLength(feature).toLocaleString("en-US")} bp`}</dd>
            {feature.codonStart ? <><dt>Codon start</dt><dd className="ln-pw-mono">{feature.codonStart}</dd></> : null}
            {Object.entries(feature.qualifiers).filter(([key]) => !["label", "translation"].includes(key)).slice(0, 8).map(([key, values]) => (
              <div key={key} className="ln-pw-fact-pair"><dt data-i18n-ignore>{key}</dt><dd data-i18n-ignore>{values.join("; ")}</dd></div>
            ))}
          </dl>
        ) : null}
        {feature && record && feature.type === "CDS" && feature.strand !== 0 ? <ProteinFacts record={record} feature={feature} /> : null}
        {selection.segments.length && record ? (
          <dl className="ln-pw-facts">
            <dt>Range</dt><dd className="ln-pw-mono">{formatSegments(selection.segments)}</dd>
            <dt>Length</dt><dd className="ln-pw-mono">{`${selectedBases.length.toLocaleString("en-US")} bp`}</dd>
            <dt>GC</dt><dd className="ln-pw-mono">{`${gcPercent(selectedBases).toFixed(1)}%`}</dd>
          </dl>
        ) : <p className="ln-pw-note">Click a feature, or drag across bases in the sequence view.</p>}
        {selectedBases ? (
          <div className="ln-pw-actions">
            <Button type="button" variant="ghost" size="sm" onClick={() => void copyCalculation(selectedBases)}>Copy bases</Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => void copyCalculation(reverseComplement(selectedBases))}>Copy reverse complement</Button>
            {selectedBases.length >= 8 ? <AddToLibrary key={formatSegments(selection.segments)} bases={selectedBases.replace(/[^ACGT]/g, "")} protein={feature?.type === "CDS" && record ? selectionPeptide(record, selection, feature)?.protein : undefined} /> : null}
          </div>
        ) : null}
      </aside>

      <footer className="ln-pw-status" aria-live="polite">
        {record && selection.segments.length ? (
          <span className="ln-pw-mono">{`${formatSegments(selection.segments)} · ${selectedBases.length.toLocaleString("en-US")} bp${feature ? ` · ${strandArrow(feature.strand)}` : ""}`}</span>
        ) : <span>No selection</span>}
        {record ? <span>{`${completenessLabels[currentCompleteness]} · ${topologyLabels[record.topology]}`}</span> : null}
      </footer>
    </div>
  );
}

/** A CDS's protein (Q368), with the places it differs from the file's own /translation marked. */
function ProteinFacts({ record, feature }: { record: SequenceRecord; feature: SequenceFeature }) {
  const protein = codonMarks(record, feature).map((mark) => mark.aminoAcid).join("").replace(/\*$/, "");
  const stated = feature.qualifiers.translation?.[0]?.replace(/\s+/g, "");
  const differing = stated ? [...protein].filter((aminoAcid, at) => aminoAcid !== stated[at]).length + Math.abs(protein.length - stated.length) : 0;
  return (
    <div className="ln-pw-facts">
      <dt>Protein</dt>
      <dd>{`${protein.length} aa${stated ? (differing ? ` · ${differing} differ from the file's /translation` : " · same as the file's /translation") : ""}`}</dd>
      <p className="ln-pw-protein" data-i18n-ignore>
        {[...protein].map((aminoAcid, at) => (stated && aminoAcid !== stated[at] ? <mark key={at}>{aminoAcid}</mark> : aminoAcid))}
      </p>
    </div>
  );
}

/** The peptide the structure panel offers to add: the selected CDS's protein, or the translation of the selected bases. */
function selectionPeptide(record: SequenceRecord, selection: Selection, feature?: SequenceFeature) {
  if (feature?.type === "CDS" && feature.strand !== 0) return { name: feature.name, protein: codonMarks(record, feature).map((mark) => mark.aminoAcid).join("").replace(/\*$/, "") };
  const bases = selection.segments.map((segment) => record.sequence.slice(segment.start, segment.end)).join("");
  const protein = translate(bases).replace(/\*$/, "");
  return bases.length >= 6 && !protein.includes("*") ? { name: `Bases ${formatSegments(selection.segments)}`, protein } : undefined;
}

/**
 * Coding stretches to write amino acids under (Q368): every CDS, then open reading frames of 100 aa or more that no
 * CDS already covers for most of their length; with `allFrames`, every codon of the six frames as well.
 */
function codingTracks(record: SequenceRecord, allFrames = false): CodingTrack[] {
  const covered = (segments: Segment[]) => {
    const size = segments.reduce((total, segment) => total + segment.end - segment.start, 0);
    let shared = 0;
    for (const feature of record.features) {
      if (feature.type !== "CDS") continue;
      for (const a of feature.segments) for (const b of segments) shared += Math.max(0, Math.min(a.end, b.end) - Math.max(a.start, b.start));
    }
    return shared >= size / 2;
  };
  const cds = record.features.flatMap((feature, featureIndex) => (feature.type === "CDS" && feature.strand !== 0 ? [{ marks: codonMarks(record, feature), featureIndex }] : []));
  const frames = openReadingFrames(record)
    .filter((frame) => !covered(frame.segments))
    .map((frame) => ({ marks: codonMarks(record, { strand: frame.strand, segments: frame.strand === -1 ? [...frame.segments].reverse() : frame.segments }) }));
  if (!allFrames) return [...cds, ...frames];
  const length = record.sequence.length;
  const every = sixFrameTranslations(record.sequence).map((frame) => ({
    marks: [...frame.protein].map((aminoAcid, at) => ({ aminoAcid, position: frame.strand === 1 ? frame.offset + at * 3 + 1 : length - 1 - (frame.offset + at * 3 + 1) })),
  }));
  return [...cds, ...frames, ...every];
}

function ReadFacts({ item, groupSize, onlySameBases, apartReason, onSplit, onJoin }: {
  item: Extract<WorkbenchItem, { kind: "read" }>;
  groupSize: number;
  onlySameBases: boolean;
  apartReason?: string;
  onSplit: (reason: string) => void;
  onJoin: () => void;
}) {
  const summary = readSummary(item.read);
  const [reason, setReason] = useState("");
  return (
    <dl className="ln-pw-facts ln-pw-read-facts">
      <dt>Quality</dt>
      <dd>{summary.quality ? `median Q${summary.quality.median} · ${(summary.quality.q20 * 100).toFixed(0)}% of bases ≥ Q20` : "Not provided by the file"}</dd>
      {summary.quality ? <><dt>Good stretch</dt><dd className="ln-pw-mono">{`${summary.quality.trimmed.start + 1}–${summary.quality.trimmed.end} (Mott, cutoff 0.05)`}</dd></> : null}
      <dt>Trace</dt><dd>{item.read.traces ? `${item.read.traces.A.length.toLocaleString("en-US")} scans, channel order ${item.read.metadata.baseOrder}` : "No chromatogram"}</dd>
      <dt>Evidence</dt>
      <dd>
        {apartReason ? <>Counted on its own; split off a group of identical bases: <span data-i18n-ignore>{apartReason}</span> <button type="button" className="ln-pw-link" onClick={onJoin}>Count with the group again</button></>
          : groupSize <= 1 ? "Independent read"
          : !onlySameBases ? `Same run as ${groupSize - 1} other file(s); counts once`
          : (
            <>
              {`Possibly the same run as ${groupSize - 1} other file(s): the bases are identical; counts once`}
              <span className="ln-pw-actions">
                <input className="ln-pw-input" value={reason} placeholder="Why it is a separate run" aria-label="Why it is a separate run" onChange={(event) => setReason(event.target.value)} />
                <button type="button" className="ln-pw-link" disabled={!reason.trim()} onClick={() => onSplit(reason.trim())}>Count it on its own</button>
              </span>
            </>
          )}
      </dd>
      {item.read.editedBases ? <><dt>Edited calls</dt><dd>The file holds hand-edited base calls; the original calls are shown.</dd></> : null}
    </dl>
  );
}

/** Who said how complete the record is (R01, Q369, Q370), or what is missing. */
function CompletenessNote({ completeness, source, circular, declared, onConfirm }: { completeness: Completeness; source: CompletenessSource | null; circular: boolean; declared?: string; onConfirm: () => void }) {
  if (completeness === "unknown") return circular ? <p className="ln-pw-note">Circular does not mean complete: choose “Known full length” only when the whole plasmid was sequenced or the source says so.</p> : null;
  if (source === "file" && declared) return <p className="ln-pw-note">Stated in the file: <span data-i18n-ignore>{declared}</span></p>;
  if (source === "user") return null;
  return (
    <p className="ln-pw-warn">
      Nobody recorded where this completeness came from. Check it; confirming records that you said so, and saving then makes a new version.
      {" "}<button type="button" className="ln-pw-link" onClick={onConfirm}>Confirm</button>
    </p>
  );
}

function gcPercent(sequence: string) {
  if (!sequence) return 0;
  return (sequence.split("").filter((base) => base === "G" || base === "C").length / sequence.length) * 100;
}
