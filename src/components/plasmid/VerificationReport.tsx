"use client";

import { Download, ExternalLink } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { confirmVerificationAction, decideVerificationItem, reviseVerificationAction, submitVerification } from "@/app/tools/plasmid/actions";
import { DocumentPrintButton } from "@/components/DocumentPrintButton";
import { Button } from "@/components/ui/Button";
import type { CoverageState } from "@/lib/plasmid/coverage";
import type { StructureCheckItem } from "@/lib/plasmid/fusion";
import type { Channel } from "@/lib/plasmid/model";
import type { LoadedVerification } from "@/lib/plasmid/verification.server";
import {
  allowedResults, choicesFor, confirmBlockers, dispositionLabels, resultLabels, scopeLength, statusLabels,
  type DifferenceDetail, type Disposition, type GapDetail, type ItemKind, type TraceSnippet, type VerificationResult, type VerificationScope, type VerificationStatus,
} from "@/lib/plasmid/verification";
import { confidenceLabels, stateLabels } from "./AlignmentView";
import { itemLabels, statusLabels as checkLabels } from "./StructurePanel";
import "./plasmid-workbench.css";

type Report = Omit<LoadedVerification, "sequenceVersion"> & { version: { id: string; label: string; length: number; topology: string } };
type Read = { name: string; from: string | null; group: string; orientation?: string; segments?: Array<{ start: number; end: number }>; differences?: number; multiMapped?: boolean; quality: boolean; trace: boolean; unaligned?: string; basesSha256: string };
type Settings = { minQuality: number; ratio: number; includeLow: boolean; aligner: string };
type Coverage = { ranges: Array<{ start: number; end: number; state: CoverageState }>; totals: Record<CoverageState, number> };
type Structure = { elements: Array<{ name: string }>; arrangementFound: boolean; items: StructureCheckItem[] } | null;

const span = (segments: Array<{ start: number; end: number }>) => segments.map((segment) => `${segment.start + 1}–${segment.end}`).join(", ");

/**
 * 核查记录 (C1) and its report (C2, Q379): the frozen inputs, every item with its disposition, and the conclusion. While a
 * draft or under review the items and the result can be set; a confirmed record only prints, exports or is revised.
 */
export function VerificationReport({ record }: { record: Report }) {
  const router = useRouter();
  const scope = record.scopeJson as VerificationScope;
  const settings = record.settingsJson as Settings;
  const reads = record.readsJson as Read[];
  const coverage = record.coverageJson as Coverage;
  const structure = record.structureJson as Structure;
  const groups = record.groupsJson as { independent: number; splits: Array<{ read: string; reason: string }> };
  const status = record.status as VerificationStatus;
  const editable = status === "draft" || status === "review";
  const items = record.items.map((item) => ({ kind: item.kind as ItemKind, disposition: item.disposition as Disposition }));
  const allowed = allowedResults(items);
  const scopeSize = scopeLength(scope);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const act = (work: () => Promise<{ error?: string; id?: string }>) => startTransition(async () => {
    setError(undefined);
    const result = await work();
    if (result.error) setError(result.error);
    else if (result.id) router.push(`/tools/plasmid/verifications/${result.id}`);
    else router.refresh();
  });

  return (
    <article className="ln-pw-report space-y-4">
      <header className="ln-pw-report-head">
        <div>
          <p className="ln-pw-note">Sequencing check</p>
          <h1 data-i18n-ignore>{record.product.name}</h1>
          <p className="ln-pw-report-badges">
            <span data-status={status}>{statusLabels[status]}</span>
            {record.result ? <span data-result={record.result}>{resultLabels[record.result as VerificationResult]}</span> : null}
            <span>{scope.kind === "whole" ? "Whole reference" : "Part of the reference"}</span>
          </p>
        </div>
        <div className="ln-pw-actions print:hidden">
          <Link className="ln-pw-link" href={`/tools/plasmid?product=${record.product.id}`}><ExternalLink className="h-3.5 w-3.5" aria-hidden />Open the plasmid</Link>
          <Link className="ln-pw-link" href={`/inventory/products/${record.product.id}`}>Plasmid in inventory</Link>
          <a className="ln-pw-link" href={`/tools/plasmid/verifications/${record.id}/csv`}><Download className="h-3.5 w-3.5" aria-hidden />Differences (CSV)</a>
          <CopyForRecord text={`[${[`Sequencing check`, record.product.name, record.version.label, record.inventoryItem?.lotNumber ? `lot ${record.inventoryItem.lotNumber}` : record.inventoryItem?.name, scope.label, record.result ? resultLabels[record.result as VerificationResult] : statusLabels[status], new Date(record.confirmedAt ?? record.createdAt).toISOString().slice(0, 10)].filter(Boolean).join(" · ").replaceAll("[", "(").replaceAll("]", ")")}](/tools/plasmid/verifications/${record.id})`} />
          <DocumentPrintButton label="Print or save as PDF" showLabel />
        </div>
      </header>

      {!record.currentVersion ? <p className="ln-pw-warn" role="note">Not for the current version: the plasmid has a newer sequence since this check. It still describes {record.version.label}.</p> : null}
      {record.supersededBy ? <p className="ln-pw-warn" role="note">Revised: <Link className="ln-pw-link" href={`/tools/plasmid/verifications/${record.supersededBy.id}`}>see the newer record</Link>.</p> : null}
      {record.supersedes ? <p className="ln-pw-note">This record revises <Link className="ln-pw-link" href={`/tools/plasmid/verifications/${record.supersedes.id}`}>an earlier check</Link>.</p> : null}
      {!record.inventoryItem ? <p className="ln-pw-warn" role="note">Analysis draft: no tube was chosen, so this check says nothing about any tube.</p> : null}

      <section className="ln-pw-report-section" aria-label="What was checked">
        <dl className="ln-pw-facts">
          <dt>Reference</dt><dd><span data-i18n-ignore>{`${record.version.label} · ${record.version.length.toLocaleString("en-US")} bp · `}</span><span className="ln-pw-mono" data-i18n-ignore>{`sha256 ${record.referenceSha256.slice(0, 16)}…`}</span></dd>
          <dt>Tube</dt><dd>{record.inventoryItem ? <Link className="ln-pw-link" href={`/inventory/${record.inventoryItem.id}`} data-i18n-ignore>{[record.inventoryItem.name, record.inventoryItem.lotNumber && `lot ${record.inventoryItem.lotNumber}`, record.inventoryItem.aliquotCode].filter(Boolean).join(" · ")}</Link> : "None"}</dd>
          {record.sample ? <><dt>Sample</dt><dd data-i18n-ignore>{`${record.sample.code} · ${record.sample.name}`}</dd></> : null}
          <dt>Scope</dt><dd><span data-i18n-ignore={scope.kind === "feature" || undefined}>{scope.label}</span>{` · ${span(scope.segments)} · ${scopeSize.toLocaleString("en-US")} bp`}</dd>
          <dt>Settings</dt><dd>{`Quality threshold Q${settings.minQuality} · double peak at ${Math.round(settings.ratio * 100)}% · ${settings.includeLow ? "stops at low-quality differences" : "stops at high-quality differences"}`}</dd>
          <dt>Aligner</dt><dd className="ln-pw-mono" data-i18n-ignore>{settings.aligner}</dd>
          <dt>Kept</dt><dd>{new Date(record.createdAt).toLocaleString("zh-CN")}</dd>
          {record.confirmedBy ? <><dt>Confirmed by</dt><dd><span data-i18n-ignore>{record.confirmedBy}</span>{` · ${new Date(record.confirmedAt!).toLocaleString("zh-CN")} · `}<em>Typed by hand, not an authenticated identity</em></dd></> : null}
          {record.note ? <><dt>Note</dt><dd data-i18n-ignore>{record.note}</dd></> : null}
        </dl>
      </section>

      <section className="ln-pw-report-section" aria-label="Coverage in the scope">
        <h2>Coverage in the scope</h2>
        <svg className="ln-pw-coverage" viewBox="0 0 1000 18" role="img" aria-label="Coverage in the scope">
          {coverage.ranges.map((range) => <rect key={range.start} data-state={range.state} x={(range.start / record.version.length) * 1000} width={Math.max(0.5, ((range.end - range.start) / record.version.length) * 1000)} y={2} height={14} />)}
        </svg>
        <p className="ln-pw-legend">
          {(Object.keys(stateLabels) as CoverageState[]).map((state) => <span key={state} data-state={state}>{`${stateLabels[state]} ${coverage.totals[state].toLocaleString("en-US")} bp`}</span>)}
        </p>
      </section>

      <section className="ln-pw-report-section" aria-label="Reads">
        <h2>{`Reads (${reads.length}, ${groups.independent} independent)`}</h2>
        <table className="ln-pw-table">
          <thead><tr><th>Sequencing read</th><th>Placed</th><th>Differences</th><th>Evidence group</th></tr></thead>
          <tbody>
            {reads.map((read, index) => (
              <tr key={index}>
                <td><span data-i18n-ignore>{read.name}</span>{read.from ? <small data-i18n-ignore>{read.from}</small> : null}<small className="ln-pw-mono" data-i18n-ignore>{read.basesSha256.slice(0, 12)}</small></td>
                <td>{read.segments ? <><span className="ln-pw-mono" data-i18n-ignore>{span(read.segments)}</span>{` · ${read.orientation === "reverse" ? "reverse" : "forward"}${read.multiMapped ? " · multi-mapped" : ""}${read.quality ? "" : " · no quality values"}`}</> : <span>{`Not aligned: ${read.unaligned ?? ""}`}</span>}</td>
                <td>{read.differences ?? "–"}</td>
                <td className="ln-pw-mono" data-i18n-ignore>{read.group.slice(-24)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {groups.splits.length ? <ul className="ln-pw-warnings">{groups.splits.map((split) => <li key={split.read}><span data-i18n-ignore>{`${split.read}: ${split.reason}`}</span></li>)}</ul> : null}
      </section>

      {structure ? (
        <section className="ln-pw-report-section" aria-label="Expected structure">
          <h2>Expected structure, as it stood</h2>
          <p className={structure.arrangementFound ? "ln-pw-ok" : "ln-pw-error"}>{structure.arrangementFound ? "✓ The expected arrangement is in this sequence." : "✗ The expected arrangement is not in this sequence."}</p>
          <p className="ln-pw-note">This checks the reference sequence, not the reads: sequencing support for the junctions is in the items below.</p>
          <ul className="ln-pw-checks">
            {structure.items.map((item, index) => <li key={index}><strong data-i18n-ignore>{item.element}</strong> <span>{itemLabels[item.id]}</span> <span>{checkLabels[item.status]}</span>{item.detail ? <small>{item.detail}</small> : null}</li>)}
          </ul>
        </section>
      ) : null}

      <section className="ln-pw-report-section" aria-label="Items">
        <h2>{`Items (${record.items.length})`}</h2>
        {!record.items.length ? <p className="ln-pw-note">Nothing to deal with: no difference and no gap in the scope.</p> : null}
        <ol className="ln-pw-items">
          {record.items.map((item) => <ItemRow key={item.id} item={item} editable={editable} onError={setError} />)}
        </ol>
      </section>

      <section className="ln-pw-report-section" aria-label="Conclusion">
        <h2>Conclusion</h2>
        {editable ? <Conclusion id={record.id} status={status} items={items} allowed={allowed} pending={pending} act={act} /> : (
          <p>{record.result ? resultLabels[record.result as VerificationResult] : statusLabels[status]}</p>
        )}
        {status === "confirmed" && !record.supersededBy ? <div className="print:hidden"><Button type="button" variant="secondary" size="sm" disabled={pending} onClick={() => act(() => reviseVerificationAction(record.id))}>Revise as a new record</Button></div> : null}
        {error ? <p className="ln-pw-error" role="alert">{error}</p> : null}
      </section>
    </article>
  );
}

/**
 * Copies a one-line snapshot with a link back here, to paste into an experiment record (Q381). The text stays as it was
 * written; the page behind the link says when the check was revised or the plasmid moved on.
 */
function CopyForRecord({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button type="button" className="ln-pw-link" onClick={async () => {
      try {
        await navigator.clipboard.writeText(text);
        setCopied(true);
      } catch {
        window.prompt("Copy this line into the experiment record:", text);
      }
    }}>{copied ? "Copied" : "Copy for an experiment record"}</button>
  );
}

function Conclusion({ id, status, items, allowed, pending, act }: {
  id: string;
  status: VerificationStatus;
  items: Array<{ kind: ItemKind; disposition: Disposition }>;
  allowed: VerificationResult[];
  pending: boolean;
  act: (work: () => Promise<{ error?: string }>) => void;
}) {
  const [result, setResult] = useState<VerificationResult | "">("");
  const [confirmedBy, setConfirmedBy] = useState("");
  const [note, setNote] = useState("");
  const blockers = confirmBlockers(items, result || null, confirmedBy, allowed);
  const open = items.filter((item) => item.disposition === "pending").length;
  const gaps = items.filter((item) => item.kind === "gap").length;
  return (
    <div className="ln-pw-save print:hidden">
      <p className="ln-pw-note">{`${open} of ${items.length} item(s) still to check · ${gaps} gap(s) in the scope`}</p>
      <label className="ln-pw-field">
        <span>Result</span>
        <select className="ln-pw-input" value={result} onChange={(event) => setResult(event.target.value as VerificationResult)}>
          <option value="">Choose…</option>
          {(Object.keys(resultLabels) as VerificationResult[]).map((value) => <option key={value} value={value} disabled={!allowed.includes(value)}>{resultLabels[value]}</option>)}
        </select>
      </label>
      <label className="ln-pw-field">
        <span>Confirmed by (typed by hand, not an authenticated identity)</span>
        <input className="ln-pw-input" value={confirmedBy} onChange={(event) => setConfirmedBy(event.target.value)} />
      </label>
      <label className="ln-pw-field">
        <span>Note</span>
        <textarea className="ln-pw-input" rows={2} value={note} onChange={(event) => setNote(event.target.value)} />
      </label>
      {blockers.length ? <ul className="ln-pw-warnings">{blockers.map((blocker) => <li key={blocker}>{blocker}</li>)}</ul> : null}
      <div className="ln-pw-actions">
        {status === "draft" ? <Button type="button" variant="secondary" size="sm" disabled={pending} onClick={() => act(() => submitVerification(id))}>Send for review</Button> : null}
        <Button type="button" variant="primary" size="sm" disabled={pending || blockers.length > 0} onClick={() => act(() => confirmVerificationAction(id, { result, confirmedBy, note }))}>Confirm</Button>
      </div>
    </div>
  );
}

function ItemRow({ item, editable, onError }: { item: Report["items"][number]; editable: boolean; onError: (error?: string) => void }) {
  const router = useRouter();
  const kind = item.kind as ItemKind;
  const [disposition, setDisposition] = useState<Disposition>(item.disposition as Disposition);
  const [reason, setReason] = useState(item.reason ?? "");
  const [pending, startTransition] = useTransition();
  const changed = disposition !== item.disposition || reason !== (item.reason ?? "");
  const save = () => startTransition(async () => {
    const result = await decideVerificationItem(item.id, disposition, reason);
    onError(result.error);
    if (!result.error) router.refresh();
  });
  const position = item.end - item.start > 1 ? `${item.start + 1}–${item.end}` : item.start === item.end ? `between ${item.start} and ${item.start + 1}` : String(item.start + 1);

  if (kind === "gap") {
    const detail = item.detailJson as GapDetail;
    return (
      <li className="ln-pw-item" data-disposition={item.disposition}>
        <div className="ln-pw-item-head"><strong>{stateLabels[detail.state]}</strong><span className="ln-pw-mono">{position}</span><span>{`${detail.length} bp`}</span></div>
        <Decision kind={kind} editable={editable} disposition={disposition} reason={reason} saved={item.reason} changed={changed} pending={pending} setDisposition={setDisposition} setReason={setReason} save={save} />
      </li>
    );
  }
  const detail = item.detailJson as DifferenceDetail;
  return (
    <li className="ln-pw-item" data-disposition={item.disposition}>
      <div className="ln-pw-item-head">
        <strong className="ln-pw-mono" data-i18n-ignore>{`${detail.referenceBases || "-"} → ${detail.readBases || "-"}`}</strong>
        <span className="ln-pw-mono">{position}</span>
        <span data-i18n-ignore>{item.readName}</span>
        <span>{confidenceLabels[detail.confidence]}</span>
        {detail.lowestQuality !== null ? <span>{`Q${detail.lowestQuality}`}</span> : null}
        {detail.homopolymer ? <span>Homopolymer</span> : null}
      </div>
      {detail.features.length || detail.coding.length || detail.knownVariant ? (
        <p className="ln-pw-note" data-i18n-ignore>{[detail.features.join(", "), ...detail.coding.map((change) => `${change.feature} codon ${change.codon}: ${change.change}`), detail.knownVariant].filter(Boolean).join(" · ")}</p>
      ) : null}
      {detail.trace ? <Snippet trace={detail.trace} /> : null}
      <Decision kind={kind} editable={editable} disposition={disposition} reason={reason} saved={item.reason} changed={changed} pending={pending} setDisposition={setDisposition} setReason={setReason} save={save} />
    </li>
  );
}

function Decision({ kind, editable, disposition, reason, saved, changed, pending, setDisposition, setReason, save }: {
  kind: ItemKind;
  editable: boolean;
  disposition: Disposition;
  reason: string;
  saved: string | null;
  changed: boolean;
  pending: boolean;
  setDisposition: (value: Disposition) => void;
  setReason: (value: string) => void;
  save: () => void;
}) {
  if (!editable) return <p className="ln-pw-item-decision"><span>{dispositionLabels[disposition]}</span>{saved ? <span data-i18n-ignore>{`: ${saved}`}</span> : null}</p>;
  return (
    <div className="ln-pw-actions ln-pw-item-decision">
      <select className="ln-pw-input ln-pw-narrow" value={disposition} aria-label="Disposition" onChange={(event) => setDisposition(event.target.value as Disposition)}>
        {choicesFor(kind).map((value) => <option key={value} value={value}>{dispositionLabels[value]}</option>)}
      </select>
      {disposition !== "pending" ? <input className="ln-pw-input" value={reason} placeholder="Reason" aria-label="Reason" onChange={(event) => setReason(event.target.value)} /> : null}
      {changed ? <Button type="button" variant="secondary" size="sm" disabled={pending || (disposition !== "pending" && !reason.trim())} onClick={save}>{pending ? "Saving…" : "Save"}</Button> : null}
    </div>
  );
}

const channels: Channel[] = ["A", "C", "G", "T"];

/** The trace kept with a difference: four channels, called bases, and a band on the difference. */
function Snippet({ trace }: { trace: TraceSnippet }) {
  const peak = Math.max(1, ...channels.flatMap((channel) => trace.channels[channel]));
  const width = trace.scans * 2;
  return (
    <svg className="ln-pw-snippet" width={width} height={76} viewBox={`0 0 ${width} 76`} role="img" aria-label="Chromatogram at the difference">
      {trace.calls.filter((call) => call.mark).map((call) => <rect key={call.scan} className="ln-pw-trace-mark" x={call.scan * 2 - 6} width={12} y={0} height={76} />)}
      {channels.map((channel) => <polyline key={channel} data-channel={channel} points={trace.channels[channel].map((value, index) => `${index * 2},${(74 - (value / peak) * 58).toFixed(1)}`).join(" ")} />)}
      {trace.calls.map((call) => <text key={call.scan} x={call.scan * 2} y={11} textAnchor="middle" data-channel={call.base} data-i18n-ignore>{call.base}</text>)}
    </svg>
  );
}
