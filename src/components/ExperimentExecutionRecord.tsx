"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { saveProtocolRunProgress, type ProtocolRunProgressState } from "@/app/experiments/[id]/run/actions";
import { newClientMutationId } from "@/lib/client-mutation-id";
import { experimentExecutionDocument } from "@/lib/experiment-document";
import { experimentStepGroupHeading } from "@/lib/experiment-planning";
import { runStepContent, runStepIsConfirmation } from "@/lib/run-step-content";
import { structuredRunView } from "@/lib/structured-run";
import type { ScientificContentBlock } from "@/lib/scientific-document";
import { ProtocolContentBlockView } from "./ProtocolDocumentView";
import { ProtocolConditionCaption } from "./ProtocolSystemLabels";
import { RunSystemPreparation } from "./RunSystemPreparation";
import { ScientificBlockView } from "./ScientificBlockView";
import { Button } from "./ui/Button";
import { formTextareaClass } from "./forms";

export type ExperimentExecutionStep = {
  id: string; groupKey: string; groupOrder: number; groupTitle: string;
  protocolStepRef: string | null; order: number; title: string; description: string;
  completed: boolean; completedAt?: Date | null; allowsDeviation?: boolean;
  deviationNote?: string | null; deviationType?: string | null;
  deviationImpact?: string | null; deviationAuthor?: string | null;
  timerStartedAt?: Date | null; evidence?: ScientificContentBlock[];
};

/** A live view of captured operations. No execution controls are serialized into prose. */
export function ExperimentExecutionRecord({ experimentId, steps, snapshot, executionPlan, parameters, editable, updatedAt, onSaved, onPendingChange }: {
  experimentId: string; steps: ExperimentExecutionStep[]; snapshot: unknown; executionPlan?: unknown; parameters?: unknown;
  editable: boolean; updatedAt: string;
  onSaved?: (result: ProtocolRunProgressState) => void;
  onPendingChange?: (pending: boolean) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<ProtocolRunProgressState>({});
  const view = structuredRunView(snapshot, executionPlan, steps);
  const groups = new Map<string, ExperimentExecutionStep[]>();
  for (const step of [...steps].sort((a, b) => a.groupOrder - b.groupOrder || a.order - b.order)) {
    groups.set(step.groupKey, [...(groups.get(step.groupKey) ?? []), step]);
  }

  function save(stepId: string, intent: "complete" | "reopen" | "deviation", note?: string) {
    const form = new FormData();
    form.set("experimentId", experimentId);
    form.set("changedStepId", stepId);
    form.set("stepIntent", intent);
    form.set("expectedUpdatedAt", updatedAt);
    form.set("executionPlanRevision", String(view.plan.revision));
    form.set("clientMutationId", newClientMutationId());
    if (note !== undefined) form.set("deviationNote", note);
    onPendingChange?.(true);
    startTransition(async () => {
      try {
        const result = await saveProtocolRunProgress({}, form);
        setState(result);
        if (!result.error) onSaved?.(result);
      } catch {
        setState({ error: "保存失败，当前输入仍保留，请重试。" });
      } finally { onPendingChange?.(false); }
    });
  }

  // Receipts, continuation history and documentation-only sources remain available.
  const projection = experimentExecutionDocument(undefined, steps, parameters, snapshot, executionPlan);
  const provenance = projection.sections.find(s => s.key === "execution")?.blocks.filter(block =>
    block.id.startsWith("run-derived:calculation:") || block.id === "run-derived:parameters" || block.id.startsWith("run-derived:reference:")) ?? [];
  return <div className="experiment-execution-record" aria-label="规程执行步骤" aria-busy={pending}>
    <RunSystemPreparation experimentId={experimentId} view={view} editable={editable && !pending} embedded />
    {state.error ? <p role="alert" className="text-sm text-error">{state.error}</p> : null}
    {state.message ? <p role="status" className="text-sm text-muted">已保存执行记录。</p> : null}
    {[...groups].map(([key, groupSteps]) => {
      const heading = experimentStepGroupHeading(groupSteps[0].groupTitle);
      const version = view.versions.find(v => v.id === key);
      const common = version?.commonBlocks ?? runStepContent(snapshot, groupSteps[0], (parameters ?? {}) as Record<string, string | number | boolean>).common;
      return <section key={key} data-execution-protocol={key} className="experiment-execution-group">
        <header><h3>{heading.title}</h3>{heading.detail ? <p className="text-xs text-muted">{heading.detail}</p> : null}</header>
        {common.length ? <details className="text-sm"><summary className="focus-ring cursor-pointer text-muted">规程说明与参考</summary>{common.map(block => <ProtocolContentBlockView key={block.id} block={block} executionContext />)}</details> : null}
        <ol className="experiment-execution-steps">
          {groupSteps.map(step => {
            const adopted = view.steps[step.id];
            const inapplicable = adopted?.applicability === "not-applicable";
            const skip = view.plan.skips[step.id];
            const needsActual = adopted?.actualFields.some(field => field.required && !view.plan.actualValues[step.id]?.[field.id]);
            const blocked = Boolean(adopted?.blocked || skip || needsActual || step.timerStartedAt);
            const content = adopted?.content_blocks ?? runStepContent(snapshot, step, (parameters ?? {}) as Record<string, string | number | boolean>).blocks;
            const rules = version?.document.systems?.rules.filter(rule => rule.target === "step" && rule.targetId === adopted?.source_ref) ?? [];
            return <li key={step.id} id={`execution-step-${step.id}`} data-execution-step={step.id} data-execution-role={runStepIsConfirmation(snapshot, step) ? 'confirmation' : 'step'} data-applicability={inapplicable ? "not-applicable" : adopted?.applicability ?? "applicable"} className="experiment-execution-step">
              <div className="experiment-execution-step-heading">
                <label className="experiment-step-check">
                  <input type="checkbox" checked={step.completed} disabled={!editable || pending || inapplicable || !step.completed && blocked} onChange={event => save(step.id, event.target.checked ? "complete" : "reopen")} aria-label={`${step.completed ? "撤销完成" : "完成步骤"} ${step.order}：${adopted?.title ?? step.title}`} />
                  <span className="tabular-nums">{step.order}.</span><strong>{adopted?.title ?? step.title}</strong>
                </label>
                {inapplicable ? <span className="text-xs text-muted">本次不适用</span> : step.completed ? <span className="text-xs text-moss">已完成{step.completedAt ? <time className="ml-1" dateTime={new Date(step.completedAt).toISOString()} suppressHydrationWarning>{new Date(step.completedAt).toLocaleString()}</time> : null}</span> : null}
              </div>
              {inapplicable ? null : <div className="experiment-execution-step-body">
                {version?.document.systems ? rules.map(rule => <ProtocolConditionCaption key={rule.id} systems={version.document.systems!} when={rule.when} />) : null}
                {adopted?.blocked ? <p className="text-sm text-warning">待确认体系或参数</p> : null}
                {skip ? <p className="text-sm text-muted">已跳过：{skip.reason}</p> : null}
                {content.length ? content.map(block => <ProtocolContentBlockView key={block.id} block={block} executionContext />) : step.description ? <p className="whitespace-pre-wrap">{step.description}</p> : null}
                {Object.entries(view.plan.actualValues[step.id] ?? {}).map(([id, value]) => <p key={id} className="text-sm">{adopted?.actualFields.find(field => field.id === id)?.label ?? id}：{value.value} {value.unit}</p>)}
                {needsActual || step.timerStartedAt ? <Link className="text-sm text-moss underline" href={`/experiments/${experimentId}/run#step-${step.id}`}>{needsActual ? "记录必填实际值" : "管理活动计时器"}</Link> : null}
                {step.evidence?.map(block => <ScientificBlockView key={block.id} block={block} />)}
                {step.allowsDeviation !== false && editable ? <StepDeviation key={step.id} step={step} pending={pending} onSave={note => save(step.id, "deviation", note)} /> : null}
                {step.deviationNote ? <p className="text-xs text-muted">已记录偏差，见“偏差与事件”。</p> : null}
              </div>}
            </li>;
          })}
        </ol>
      </section>;
    })}
    {provenance.length ? <details className="text-sm"><summary className="focus-ring cursor-pointer text-muted">执行参数与来源记录</summary>{provenance.map(block => <ScientificBlockView key={block.id} block={block} />)}</details> : null}
  </div>;
}

function StepDeviation({ step, pending, onSave }: { step: ExperimentExecutionStep; pending: boolean; onSave: (note: string) => void }) {
  const [note, setNote] = useState(step.deviationNote ?? "");
  return <details className="experiment-step-deviation" data-print-hidden>
    <summary className="focus-ring cursor-pointer text-sm text-moss">{step.deviationNote ? "编辑偏差" : "记录偏差"}</summary>
    <label className="mt-2 block"><span className="sr-only">步骤 {step.order} 的偏差</span><textarea aria-label={`步骤 ${step.order} 的偏差`} className={`${formTextareaClass} min-h-20`} maxLength={5000} value={note} onChange={event => setNote(event.target.value)} placeholder="简述实际操作与规程的差异" /></label>
    <Button type="button" size="sm" disabled={pending || note.trim() === (step.deviationNote ?? "")} onClick={() => onSave(note)}>保存偏差</Button>
  </details>;
}
