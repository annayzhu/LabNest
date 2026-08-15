"use client";

import { useActionState, useMemo, useState } from "react";
import Link from "next/link";
import { Link2, Trash2 } from "lucide-react";
import {
  linkSequenceEntity,
  linkSequenceResearchRecord,
  unlinkSequenceEntity,
  unlinkSequenceResearchRecord,
  type SequenceManageState,
} from "@/app/sequences/actions";
import { formInputClass, formLabelClass } from "@/components/forms";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";

const initialState: SequenceManageState = {};

type VersionOption = { id: string; label: string };
type EntityOption = { id: string; name: string; type: string; code?: string | null };
type EntityLinkRecord = { id: string; entityName: string; entityType: string; entityCode?: string | null; role: string; isPrimary: boolean; versionLabel: string; inventoryCount: number };
type ResearchTarget = { id: string; label: string; detail?: string };
type ResearchLinkRecord = { id: string; targetType: string; targetId: string; targetLabel: string; linkType: string; note?: string | null; versionLabel?: string };

export function SequenceRelationshipManager({
  sequenceId,
  versions,
  entities,
  entityLinks,
  researchTargets,
  researchLinks,
}: {
  sequenceId: string;
  versions: VersionOption[];
  entities: EntityOption[];
  entityLinks: EntityLinkRecord[];
  researchTargets: Record<string, ResearchTarget[]>;
  researchLinks: ResearchLinkRecord[];
}) {
  const [entityState, entityAction, entityPending] = useActionState(linkSequenceEntity, initialState);
  const [unlinkEntityState, unlinkEntityAction, unlinkEntityPending] = useActionState(unlinkSequenceEntity, initialState);
  const [researchState, researchAction, researchPending] = useActionState(linkSequenceResearchRecord, initialState);
  const [unlinkResearchState, unlinkResearchAction, unlinkResearchPending] = useActionState(unlinkSequenceResearchRecord, initialState);
  const [targetType, setTargetType] = useState("experiment");
  const targets = useMemo(() => researchTargets[targetType] ?? [], [researchTargets, targetType]);
  const latestVersionId = versions[0]?.id ?? "";

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <Card>
        <CardHeader title="Design objects and Inventory" />
        <CardBody className="space-y-4">
          <form action={entityAction} className="grid gap-2 rounded-[8px] border border-hairline bg-warm/50 p-3 md:grid-cols-2">
            <input type="hidden" name="sequenceId" value={sequenceId} />
            <label>
              <span className={formLabelClass}>Entity / design object *</span>
              <select required name="entityId" defaultValue="" className={formInputClass}>
                <option value="">Choose an Entity…</option>
                {entities.map((entity) => <option key={entity.id} value={entity.id}>{entity.name} · {entity.type}{entity.code ? ` · ${entity.code}` : ""}</option>)}
              </select>
            </label>
            <label>
              <span className={formLabelClass}>Exact version *</span>
              <select required name="sequenceVersionId" defaultValue={latestVersionId} className={formInputClass}>
                {versions.map((version) => <option key={version.id} value={version.id}>{version.label}</option>)}
              </select>
            </label>
            <label>
              <span className={formLabelClass}>Role *</span>
              <input required name="role" defaultValue="primary" list="entity-sequence-roles" className={formInputClass} />
              <datalist id="entity-sequence-roles"><option value="primary" /><option value="forward" /><option value="reverse" /><option value="sense" /><option value="antisense" /><option value="guide" /><option value="insert" /><option value="backbone" /></datalist>
            </label>
            <label>
              <span className={formLabelClass}>Note</span>
              <input name="note" maxLength={500} className={formInputClass} />
            </label>
            <label className="flex items-center gap-2 text-xs text-graphite md:col-span-2"><input type="checkbox" name="isPrimary" className="h-4 w-4 accent-moss" />Primary sequence for this Entity</label>
            <div className="flex items-center justify-between gap-3 md:col-span-2">
              <ActionMessage state={entityState} />
              <button type="submit" disabled={entityPending} className={saveButtonClass}><Link2 className="h-3.5 w-3.5" aria-hidden />{entityPending ? "Linking…" : "Link Entity"}</button>
            </div>
          </form>

          <div className="divide-y divide-hairline rounded-[8px] border border-hairline">
            {entityLinks.length ? entityLinks.map((link) => (
              <div key={link.id} className="flex flex-wrap items-center justify-between gap-3 px-3 py-2.5 text-sm">
                <div>
                  <p className="font-medium text-ink">{link.entityName} <span className="font-mono text-xs text-muted">{link.entityCode}</span></p>
                  <p className="mt-0.5 text-xs text-muted">{link.entityType} · {link.role} · v{link.versionLabel}{link.isPrimary ? " · primary" : ""} · {link.inventoryCount} Inventory {link.inventoryCount === 1 ? "item" : "items"}</p>
                </div>
                <form action={unlinkEntityAction}>
                  <input type="hidden" name="sequenceId" value={sequenceId} /><input type="hidden" name="linkId" value={link.id} />
                  <button type="submit" disabled={unlinkEntityPending} aria-label="Remove Entity link" className={removeButtonClass}><Trash2 className="h-3.5 w-3.5" aria-hidden /></button>
                </form>
              </div>
            )) : <p className="px-3 py-4 text-sm text-muted">No Entity or Inventory links.</p>}
          </div>
          <ActionMessage state={unlinkEntityState} />
          <p className="text-xs text-muted">Inventory remains linked through its scientific Entity, preserving the distinction between a design and a physical tube or lot.</p>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Research workflow links" />
        <CardBody className="space-y-4">
          <form action={researchAction} className="grid gap-2 rounded-[8px] border border-hairline bg-warm/50 p-3 md:grid-cols-2">
            <input type="hidden" name="sequenceId" value={sequenceId} />
            <label>
              <span className={formLabelClass}>Exact version *</span>
              <select required name="sequenceVersionId" defaultValue={latestVersionId} className={formInputClass}>
                {versions.map((version) => <option key={version.id} value={version.id}>{version.label}</option>)}
              </select>
            </label>
            <label>
              <span className={formLabelClass}>Record type *</span>
              <select name="targetType" value={targetType} onChange={(event) => setTargetType(event.target.value)} className={formInputClass}>
                <option value="project">Project</option><option value="research_plan">Research Plan</option><option value="protocol">Protocol</option><option value="experiment">Experiment</option><option value="result">Result</option>
              </select>
            </label>
            <label>
              <span className={formLabelClass}>Record *</span>
              <select required name="targetId" key={targetType} defaultValue="" className={formInputClass}>
                <option value="">Choose a record…</option>
                {targets.map((target) => <option key={target.id} value={target.id}>{target.label}{target.detail ? ` · ${target.detail}` : ""}</option>)}
              </select>
            </label>
            <label>
              <span className={formLabelClass}>Relationship *</span>
              <select name="linkType" defaultValue="used_by" className={formInputClass}><option value="used_by">Used by</option><option value="designed_for">Designed for</option><option value="validated_by">Validated by</option><option value="reported_in">Reported in</option><option value="related_to">Related to</option></select>
            </label>
            <label className="md:col-span-2">
              <span className={formLabelClass}>Note</span>
              <input name="note" maxLength={500} className={formInputClass} />
            </label>
            <div className="flex items-center justify-between gap-3 md:col-span-2">
              <ActionMessage state={researchState} />
              <button type="submit" disabled={researchPending} className={saveButtonClass}><Link2 className="h-3.5 w-3.5" aria-hidden />{researchPending ? "Linking…" : "Link Record"}</button>
            </div>
          </form>

          <div className="divide-y divide-hairline rounded-[8px] border border-hairline">
            {researchLinks.length ? researchLinks.map((link) => (
              <div key={link.id} className="flex flex-wrap items-center justify-between gap-3 px-3 py-2.5 text-sm">
                <div>
                  <Link href={targetHref(link.targetType, link.targetId)} className="font-medium text-ink hover:text-moss">{link.targetLabel}</Link>
                  <p className="mt-0.5 text-xs text-muted">{link.targetType.replaceAll("_", " ")} · {link.linkType.replaceAll("_", " ")}{link.versionLabel ? ` · v${link.versionLabel}` : ""}{link.note ? ` · ${link.note}` : ""}</p>
                </div>
                <form action={unlinkResearchAction}>
                  <input type="hidden" name="sequenceId" value={sequenceId} /><input type="hidden" name="linkId" value={link.id} />
                  <button type="submit" disabled={unlinkResearchPending} aria-label="Remove research link" className={removeButtonClass}><Trash2 className="h-3.5 w-3.5" aria-hidden /></button>
                </form>
              </div>
            )) : <p className="px-3 py-4 text-sm text-muted">No Project, Protocol, Experiment, or Result links.</p>}
          </div>
          <ActionMessage state={unlinkResearchState} />
        </CardBody>
      </Card>
    </div>
  );
}

function targetHref(type: string, id: string) {
  if (type === "research_plan") return `/research-plans/${id}`;
  if (type === "project") return `/projects/${id}`;
  if (type === "protocol") return `/protocols/${id}`;
  if (type === "experiment") return `/experiments/${id}`;
  if (type === "result") return `/results/${id}`;
  return "/search";
}

function ActionMessage({ state }: { state: SequenceManageState }) {
  if (state.error) return <span role="alert" className="text-xs text-error">{state.error}</span>;
  if (state.success) return <span role="status" className="text-xs text-success">{state.success}</span>;
  return <span />;
}

const saveButtonClass = "focus-ring inline-flex h-8 items-center gap-1.5 rounded-[6px] border border-moss bg-moss px-2.5 text-xs font-medium text-warm disabled:opacity-55";
const removeButtonClass = "focus-ring flex h-8 w-8 items-center justify-center rounded-[6px] text-error hover:bg-error-surface disabled:opacity-55";
