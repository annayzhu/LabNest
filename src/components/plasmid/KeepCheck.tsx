"use client";

import { ClipboardCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { plasmidTubes, saveVerification } from "@/app/tools/plasmid/actions";
import { Button } from "@/components/ui/Button";
import { ALIGNER_VERSION, type AlignmentOutcome, type ReadAlignment } from "@/lib/plasmid/align";
import type { CoverageProfile } from "@/lib/plasmid/coverage";
import { checkStructure } from "@/lib/plasmid/fusion";
import { PLASMID_PARSER_VERSION, type SequenceRecord } from "@/lib/plasmid/model";
import { sha256Hex } from "@/lib/plasmid/sha256";
import type { StoredStructureElement } from "@/lib/plasmid/structure.server";
import { draftItems, rangeScope, scopedCoverage, structureScope, wholeScope, type VerificationScope } from "@/lib/plasmid/verification";
import type { ReadChoice } from "./AlignmentView";

type Tube = Awaited<ReturnType<typeof plasmidTubes>>[number];

const tubeLabel = (tube: Tube) => [tube.name, tube.lotNumber && `lot ${tube.lotNumber}`, tube.aliquotCode, tube.barcode].filter(Boolean).join(" · ");
const utf8 = (value: string) => new TextEncoder().encode(value);

/**
 * 建立核查记录 (C1, Q372–Q375): freezes this alignment — reference version, reads with their hashes and groups, settings,
 * scope, expected structure and coverage — as a draft to go through item by item. Only a saved version can be checked,
 * and only a check bound to a tube can later say anything about a tube.
 */
export function KeepCheck({ record, saved, structure, placed, alignments, profile, settings, splits }: {
  record: SequenceRecord;
  saved?: { productId: string; versionId: string };
  structure: StoredStructureElement[];
  placed: Array<{ choice: ReadChoice; outcome: AlignmentOutcome }>;
  alignments: Array<ReadAlignment | undefined>;
  profile: CoverageProfile;
  settings: { minQuality: number; ratio: number; includeLow: boolean };
  splits: Record<string, string>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [tubes, setTubes] = useState<Tube[]>();
  const [tube, setTube] = useState("");
  const [sample, setSample] = useState("");
  const structureCheck = useMemo(() => (structure.length ? checkStructure({ sequence: record.sequence, elements: structure }) : undefined), [record.sequence, structure]);
  const suggested = structureScope(structureCheck);
  const [scopeChoice, setScopeChoice] = useState<string>(suggested ? "structure" : "whole");
  const [range, setRange] = useState({ start: "1", end: String(record.sequence.length) });
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const productId = saved?.productId;

  useEffect(() => {
    if (!open || !productId) return;
    let cancelled = false;
    plasmidTubes(productId).then((found) => { if (!cancelled) setTubes(found); }).catch(() => { if (!cancelled) setTubes([]); });
    return () => { cancelled = true; };
  }, [open, productId]);

  if (!saved) return <p className="ln-pw-note">Save this sequence to a plasmid in inventory to keep a check record of it.</p>;
  if (!open) return <Button type="button" variant="secondary" size="sm" onClick={() => setOpen(true)}><ClipboardCheck className="h-3.5 w-3.5" aria-hidden />Keep a check record…</Button>;

  const length = record.sequence.length;
  const features = record.features.filter((feature) => feature.name);
  const scope: VerificationScope | undefined = scopeChoice === "whole" ? wholeScope(length)
    : scopeChoice === "structure" ? suggested
    : scopeChoice === "range" ? rangeScope(Number(range.start), Number(range.end), length, record.topology === "circular")
    : (() => {
      const feature = features[Number(scopeChoice.replace("feature-", ""))];
      return feature ? { kind: "feature" as const, label: feature.name, segments: feature.segments.map(({ start, end }) => ({ start, end })) } : undefined;
    })();

  const keep = () => startTransition(async () => {
    if (!scope) return;
    setError(undefined);
    const reads = placed.map(({ choice }, index) => ({ read: choice.read, alignment: alignments[index] }));
    const items = draftItems({ record, scope, reads, profile });
    const result = await saveVerification({
      productId: saved.productId,
      sequenceVersionId: saved.versionId,
      referenceSha256: await sha256Hex(utf8(record.sequence)),
      inventoryItemId: tube || null,
      sampleCode: sample.trim() || null,
      scope,
      settings: { ...settings, aligner: ALIGNER_VERSION, parser: PLASMID_PARSER_VERSION, continuity: 10 },
      reads: await Promise.all(placed.map(async ({ choice, outcome }, index) => {
        const alignment = alignments[index];
        return {
          name: choice.read.name,
          from: choice.from ?? null,
          file: choice.copy ?? null,
          basesSha256: await sha256Hex(utf8(choice.read.bases)),
          length: choice.read.bases.length,
          quality: Boolean(choice.read.quality),
          trace: Boolean(choice.read.traces),
          group: choice.group,
          ...(alignment ? { orientation: alignment.orientation, segments: alignment.referenceSegments, score: alignment.score, multiMapped: alignment.secondary.length > 0, differences: alignment.differences.length } : { unaligned: outcome.aligned ? "" : outcome.reason }),
        };
      })),
      groups: { independent: profile.independentReads, splits: Object.entries(splits).map(([read, reason]) => ({ read, reason })) },
      structure: structureCheck ? { elements: structure, arrangementFound: structureCheck.arrangementFound, items: structureCheck.items } : null,
      coverage: scopedCoverage(profile, scope),
      items,
    });
    if (result.error || !result.id) setError(result.error ?? "The check was not saved.");
    else router.push(`/tools/plasmid/verifications/${result.id}`);
  });

  return (
    <div className="ln-pw-save" role="dialog" aria-label="Keep a check record">
      <p className="ln-pw-note">The reads, settings, scope and expected structure are kept as they are now; later changes start a new check.</p>
      <label className="ln-pw-field">
        <span>Scope</span>
        <select className="ln-pw-input" value={scopeChoice} onChange={(event) => setScopeChoice(event.target.value)}>
          {suggested ? <option value="structure">{suggested.label}</option> : null}
          <option value="whole">Whole reference</option>
          {features.map((feature, index) => <option key={index} value={`feature-${index}`}>{`Feature: ${feature.name}`}</option>)}
          <option value="range">Typed range</option>
        </select>
      </label>
      {scopeChoice === "range" ? (
        <span className="ln-pw-actions">
          <input className="ln-pw-input ln-pw-narrow" type="number" min={1} max={length} value={range.start} aria-label="From" onChange={(event) => setRange({ ...range, start: event.target.value })} />
          <span>–</span>
          <input className="ln-pw-input ln-pw-narrow" type="number" min={1} max={length} value={range.end} aria-label="To" onChange={(event) => setRange({ ...range, end: event.target.value })} />
        </span>
      ) : null}
      <label className="ln-pw-field">
        <span>Tube checked</span>
        <select className="ln-pw-input" value={tube} onChange={(event) => setTube(event.target.value)}>
          <option value="">{tubes === undefined ? "Loading…" : "None: an analysis draft, no tube"}</option>
          {(tubes ?? []).map((item) => <option key={item.id} value={item.id}>{tubeLabel(item)}</option>)}
        </select>
      </label>
      {!tube ? <p className="ln-pw-warn">Without a tube this stays an analysis draft and gives no tube a result.</p> : null}
      <label className="ln-pw-field">
        <span>Sample code (optional)</span>
        <input className="ln-pw-input" value={sample} placeholder="S-0001" onChange={(event) => setSample(event.target.value)} />
      </label>
      {!scope ? <p className="ln-pw-error" role="alert">The range lies outside the reference.</p> : null}
      {error ? <p className="ln-pw-error" role="alert">{error}</p> : null}
      <div className="ln-pw-actions">
        <Button type="button" variant="primary" size="sm" disabled={pending || !scope} onClick={keep}>{pending ? "Saving…" : "Keep as a draft"}</Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>Close</Button>
      </div>
    </div>
  );
}
