"use client";

import { useActionState, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { formInputClass, formLabelClass, formMonoTextareaClass, formTextareaClass } from "@/components/forms";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import type { FormAction, FormActionState } from "@/lib/form-actions";
import {
  designMetadataFields,
  sequenceInputPrompt,
  sequenceDesignTypes,
  sequenceDesignTypesForEntryClass,
  sequenceLifecycleStatuses,
  sequenceValidationStatuses,
  type SequenceDesignTypeValue,
} from "@/lib/sequence-registry";
import { estimatedMeltingTemperature, estimatedMolecularWeight, gcPercent, sequenceLength } from "@/lib/sequence";

const initialState: FormActionState = {};

type FeatureDraft = { name: string; type: string; start: number | string; end: number | string; strand?: string; note?: string };
type ModificationDraft = { position: string; modification: string; note?: string };
type ProjectOption = { id: string; name: string };

export type SequenceFormInitial = {
  id?: string;
  name?: string;
  entryClass?: "nucleic_acid" | "amino_acid" | "oligo";
  ownershipScope?: "library" | "project";
  designType?: SequenceDesignTypeValue;
  status?: "draft" | "active" | "inactive" | "archived";
  description?: string | null;
  projectId?: string | null;
  targetName?: string | null;
  organism?: string | null;
  metadata?: Record<string, unknown>;
  latestVersion?: {
    displayVersion: string;
    moleculeType: "DNA" | "RNA" | "Protein";
    sequence: string;
    topology: "linear" | "circular";
    strandedness: "single" | "double" | "unknown";
    validationStatus: "unverified" | "validation_in_progress" | "validated_recommended" | "validated_limited" | "validated_not_recommended" | "inconclusive";
    validationSummary?: string | null;
    features: FeatureDraft[];
    modifications: ModificationDraft[];
  };
};

function nextVersionLabel(current?: string) {
  if (!current) return "1.0";
  const match = current.match(/^(\d+)\.(\d+)$/);
  return match ? `${match[1]}.${Number(match[2]) + 1}` : `${current}.1`;
}

export function SequenceForm({ action, projects, initial = {}, allowedDesignTypes }: { action: FormAction; projects: ProjectOption[]; initial?: SequenceFormInitial; allowedDesignTypes?: readonly SequenceDesignTypeValue[] }) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const initialDesign = initial.designType ?? "other";
  const [ownershipScope, setOwnershipScope] = useState<"library" | "project">(initial.ownershipScope ?? (initial.projectId ? "project" : "library"));
  const [designType, setDesignType] = useState<SequenceDesignTypeValue>(initialDesign);
  const [moleculeType, setMoleculeType] = useState<"DNA" | "RNA" | "Protein">(initial.latestVersion?.moleculeType ?? sequenceDesignTypes.find((item) => item.value === initialDesign)?.defaultMolecule ?? "DNA");
  const [sequence, setSequence] = useState(initial.latestVersion?.sequence ?? "");
  const [features, setFeatures] = useState<FeatureDraft[]>(initial.latestVersion?.features ?? []);
  const [modifications, setModifications] = useState<ModificationDraft[]>(initial.latestVersion?.modifications ?? []);
  const metadataFields = designMetadataFields[designType] ?? [];
  const availableDesignTypes = initial.id
    ? sequenceDesignTypes
    : allowedDesignTypes
      ? sequenceDesignTypes.filter((item) => allowedDesignTypes.includes(item.value))
      : sequenceDesignTypesForEntryClass(initial.entryClass ?? "nucleic_acid");
  const inputPrompt = sequenceInputPrompt(designType, moleculeType);
  const metrics = useMemo(() => ({
    length: sequenceLength(sequence),
    gc: moleculeType === "Protein" ? undefined : gcPercent(sequence),
    tm: moleculeType === "Protein" ? undefined : estimatedMeltingTemperature(sequence, moleculeType),
    mw: estimatedMolecularWeight(sequence, moleculeType),
  }), [moleculeType, sequence]);

  function setFeature(index: number, patch: Partial<FeatureDraft>) {
    setFeatures((current) => current.map((feature, featureIndex) => featureIndex === index ? { ...feature, ...patch } : feature));
  }

  function setModification(index: number, patch: Partial<ModificationDraft>) {
    setModifications((current) => current.map((modification, modificationIndex) => modificationIndex === index ? { ...modification, ...patch } : modification));
  }

  return (
    <form action={formAction} className="space-y-4">
      {initial.id ? <input type="hidden" name="id" value={initial.id} /> : null}
      <input type="hidden" name="entryClass" value={initial.entryClass ?? "nucleic_acid"} />
      <input type="hidden" name="featuresJson" value={JSON.stringify(features)} />
      <input type="hidden" name="modificationsJson" value={JSON.stringify(modifications)} />

      <Card>
        <CardHeader title="Sequence identity" />
        <CardBody className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <label className="md:col-span-2">
            <span className={formLabelClass}>{inputPrompt.nameLabel}</span>
            <input required name="name" defaultValue={initial.name ?? ""} maxLength={180} className={formInputClass} placeholder={inputPrompt.namePlaceholder} />
          </label>
          <label>
            <span className={formLabelClass}>Design type *</span>
            <select
              name="designType"
              value={designType}
              onChange={(event) => {
                const value = event.target.value as SequenceDesignTypeValue;
                setDesignType(value);
                const suggested = sequenceDesignTypes.find((item) => item.value === value)?.defaultMolecule;
                if (suggested) setMoleculeType(suggested);
              }}
              className={formInputClass}
            >
              {availableDesignTypes.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </label>
          <label>
            <span className={formLabelClass}>Lifecycle status *</span>
            <select name="status" defaultValue={initial.status ?? "draft"} className={formInputClass}>
              {sequenceLifecycleStatuses.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </label>
          <label>
            <span className={formLabelClass}>Location *</span>
            <select name="ownershipScope" value={ownershipScope} onChange={(event) => setOwnershipScope(event.target.value as typeof ownershipScope)} className={formInputClass}>
              <option value="library">Sequence library</option>
              <option value="project">Project</option>
            </select>
          </label>
          <label>
            <span className={formLabelClass}>Project{ownershipScope === "project" ? " *" : ""}</span>
            <select name="projectId" required={ownershipScope === "project"} disabled={ownershipScope !== "project"} defaultValue={initial.projectId ?? ""} className={formInputClass}>
              <option value="">Choose a Project…</option>
              {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
            </select>
          </label>
          <label>
            <span className={formLabelClass}>{inputPrompt.targetLabel}</span>
            <input name="targetName" defaultValue={initial.targetName ?? ""} maxLength={180} className={formInputClass} placeholder={inputPrompt.targetPlaceholder} />
          </label>
          <label>
            <span className={formLabelClass}>{inputPrompt.organismLabel}</span>
            <input name="organism" defaultValue={initial.organism ?? ""} maxLength={180} className={formInputClass} placeholder={inputPrompt.organismPlaceholder} />
          </label>
          {metadataFields.map((field) => (
            <label key={field.key}>
              <span className={formLabelClass}>{field.label}</span>
              <input
                name={`meta_${field.key}`}
                type={field.type ?? "text"}
                step={field.type === "number" ? "any" : undefined}
                defaultValue={String(initial.metadata?.[field.key] ?? "")}
                className={formInputClass}
                placeholder={field.placeholder}
              />
            </label>
          ))}
          <label className="md:col-span-2 xl:col-span-4">
            <span className={formLabelClass}>Description</span>
            <textarea name="description" defaultValue={initial.description ?? ""} maxLength={5000} className={`${formTextareaClass} min-h-20`} placeholder={inputPrompt.descriptionPlaceholder} />
          </label>
          {!initial.id ? <label className="flex items-start gap-2 md:col-span-2 xl:col-span-4"><input type="checkbox" name="autoCreateEntity" defaultChecked className="mt-0.5 h-4 w-4 accent-moss" /><span className="text-xs leading-5 text-graphite"><strong className="font-medium text-ink">Create a linked scientific design object</strong><br />Recommended when this Sequence will have physical Inventory. Clear this only when you plan to link an existing Entity after creation.</span></label> : null}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Exact sequence version" />
        <CardBody className="space-y-3">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <label>
              <span className={formLabelClass}>Molecule *</span>
              <select name="moleculeType" value={moleculeType} onChange={(event) => setMoleculeType(event.target.value as typeof moleculeType)} className={formInputClass}>
                <option value="DNA">DNA</option>
                <option value="RNA">RNA</option>
                <option value="Protein">Amino acid</option>
              </select>
            </label>
            <label>
              <span className={formLabelClass}>{initial.id ? "New version label" : "Version label"} *</span>
              <input required name="displayVersion" defaultValue={initial.id ? nextVersionLabel(initial.latestVersion?.displayVersion) : initial.latestVersion?.displayVersion ?? "1.0"} maxLength={30} className={formInputClass} />
              {initial.id && initial.latestVersion ? <span className="mt-1 block text-[11px] text-muted">Current version: {initial.latestVersion.displayVersion}. Used only if sequence content changes.</span> : null}
            </label>
            <label>
              <span className={formLabelClass}>Topology *</span>
              <select name="topology" defaultValue={initial.latestVersion?.topology ?? (designType === "plasmid" ? "circular" : "linear")} className={formInputClass}>
                <option value="linear">Linear</option>
                <option value="circular">Circular</option>
              </select>
            </label>
            <label>
              <span className={formLabelClass}>Strandedness *</span>
              <select name="strandedness" defaultValue={initial.latestVersion?.strandedness ?? "unknown"} className={formInputClass}>
                <option value="single">Single-stranded</option>
                <option value="double">Double-stranded</option>
                <option value="unknown">Not specified</option>
              </select>
            </label>
            <label>
              <span className={formLabelClass}>Validation conclusion *</span>
              <select name="validationStatus" defaultValue={initial.latestVersion?.validationStatus ?? "unverified"} className={formInputClass}>
                {sequenceValidationStatuses.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
            </label>
          </div>

          <label className="block">
            <span className={formLabelClass}>{inputPrompt.sequenceLabel}</span>
            <textarea
              required
              name="sequence"
              value={sequence}
              onChange={(event) => setSequence(event.target.value)}
              spellCheck={false}
              data-i18n-ignore
              className={`${formMonoTextareaClass} min-h-44`}
              placeholder={inputPrompt.sequencePlaceholder}
            />
          </label>

          <div className="flex flex-wrap gap-x-6 gap-y-1 border-y border-hairline py-2 font-mono text-xs text-muted">
            <span>Length <strong className="text-ink">{metrics.length}</strong></span>
            {metrics.gc === undefined ? null : <span>GC <strong className="text-ink">{metrics.gc}%</strong></span>}
            {metrics.tm === undefined ? null : <span>Approx. Tm <strong className="text-ink">{metrics.tm} °C</strong></span>}
            <span>Approx. MW <strong className="text-ink">{metrics.mw.toLocaleString()} Da</strong></span>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <label>
              <span className={formLabelClass}>Validation summary</span>
              <textarea name="validationSummary" defaultValue={initial.latestVersion?.validationSummary ?? ""} maxLength={5000} className={`${formTextareaClass} min-h-24`} placeholder={inputPrompt.validationPlaceholder} />
            </label>
            <label>
              <span className={formLabelClass}>Version change summary</span>
              <textarea name="changeSummary" maxLength={1000} className={`${formTextareaClass} min-h-24`} placeholder={initial.id ? "Required when sequence content, features, or modifications change." : inputPrompt.changeSummaryPlaceholder} />
            </label>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Features"
          action={<button type="button" onClick={() => setFeatures((current) => [...current, { name: "", type: "feature", start: 1, end: Math.max(1, metrics.length), strand: "+", note: "" }])} className="focus-ring inline-flex h-8 items-center gap-1.5 rounded-[var(--ln-radius-control-sm)] border border-hairline px-2.5 text-xs text-moss hover:bg-warm"><Plus className="h-3.5 w-3.5" aria-hidden />Add feature</button>}
        />
        <CardBody className="space-y-2">
          <p className="text-xs text-muted">Coordinates are 1-based and inclusive. Features provide annotation without requiring a plasmid map editor.</p>
          {features.length ? features.map((feature, index) => (
            <div key={`feature-${index}`} className="grid gap-2 rounded-[var(--ln-radius-control-lg)] border border-hairline bg-warm/50 p-2 md:grid-cols-[1.2fr_0.8fr_90px_90px_90px_1.4fr_34px]">
              <input aria-label="Feature name" value={feature.name} onChange={(event) => setFeature(index, { name: event.target.value })} placeholder="Feature name" className={compactInputClass} />
              <input aria-label="Feature type" value={feature.type} onChange={(event) => setFeature(index, { type: event.target.value })} placeholder="CDS, promoter…" className={compactInputClass} />
              <input aria-label="Feature start" type="number" min="1" value={feature.start} onChange={(event) => setFeature(index, { start: event.target.value })} className={compactInputClass} />
              <input aria-label="Feature end" type="number" min="1" value={feature.end} onChange={(event) => setFeature(index, { end: event.target.value })} className={compactInputClass} />
              <select aria-label="Feature strand" value={feature.strand ?? ""} onChange={(event) => setFeature(index, { strand: event.target.value })} className={compactInputClass}><option value="">None</option><option value="+">+</option><option value="-">−</option></select>
              <input aria-label="Feature note" value={feature.note ?? ""} onChange={(event) => setFeature(index, { note: event.target.value })} placeholder="Note" className={compactInputClass} />
              <button type="button" aria-label="Remove feature" onClick={() => setFeatures((current) => current.filter((_, itemIndex) => itemIndex !== index))} className="focus-ring flex h-8 w-8 items-center justify-center rounded-[var(--ln-radius-control-sm)] text-error hover:bg-error-surface"><Trash2 className="h-3.5 w-3.5" aria-hidden /></button>
            </div>
          )) : <p className="rounded-[var(--ln-radius-control-lg)] border border-dashed border-hairline px-3 py-4 text-sm text-muted">No annotated features.</p>}
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Chemical modifications"
          action={<button type="button" onClick={() => setModifications((current) => [...current, { position: "", modification: "", note: "" }])} className="focus-ring inline-flex h-8 items-center gap-1.5 rounded-[var(--ln-radius-control-sm)] border border-hairline px-2.5 text-xs text-moss hover:bg-warm"><Plus className="h-3.5 w-3.5" aria-hidden />Add modification</button>}
        />
        <CardBody className="space-y-2">
          <p className="text-xs text-muted">Record 5′/3′ and internal modifications separately from the canonical sequence letters.</p>
          {modifications.length ? modifications.map((modification, index) => (
            <div key={`modification-${index}`} className="grid gap-2 rounded-[var(--ln-radius-control-lg)] border border-hairline bg-warm/50 p-2 md:grid-cols-[150px_1fr_1.4fr_34px]">
              <input aria-label="Modification position" value={modification.position} onChange={(event) => setModification(index, { position: event.target.value })} placeholder="5′, 3′, base 12" className={compactInputClass} />
              <input aria-label="Modification name" value={modification.modification} onChange={(event) => setModification(index, { modification: event.target.value })} placeholder="FAM, BHQ1, 2′-OMe…" className={compactInputClass} />
              <input aria-label="Modification note" value={modification.note ?? ""} onChange={(event) => setModification(index, { note: event.target.value })} placeholder="Purpose or supplier notation" className={compactInputClass} />
              <button type="button" aria-label="Remove modification" onClick={() => setModifications((current) => current.filter((_, itemIndex) => itemIndex !== index))} className="focus-ring flex h-8 w-8 items-center justify-center rounded-[var(--ln-radius-control-sm)] text-error hover:bg-error-surface"><Trash2 className="h-3.5 w-3.5" aria-hidden /></button>
            </div>
          )) : <p className="rounded-[var(--ln-radius-control-lg)] border border-dashed border-hairline px-3 py-4 text-sm text-muted">No chemical modifications recorded.</p>}
        </CardBody>
      </Card>

      <div className="flex flex-wrap items-center justify-end gap-3">
        {state.error ? <p role="alert" className="max-w-2xl rounded-[var(--ln-radius-control-lg)] border border-error/30 bg-error-surface px-3 py-2 text-sm text-error">{state.error}</p> : null}
        <Button type="submit" variant="primary" size="md" disabled={pending} aria-busy={pending}>
          {pending ? "Saving…" : initial.id ? "Save Sequence" : "Create Sequence"}
        </Button>
      </div>
    </form>
  );
}

const compactInputClass = "focus-ring h-8 min-w-0 w-full rounded-[var(--ln-radius-control-sm)] border border-hairline bg-surface px-2 text-xs text-ink";
