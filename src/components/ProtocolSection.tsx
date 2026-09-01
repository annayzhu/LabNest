import type { ReactNode } from "react";
import { CheckCircle2, Circle, FlaskConical } from "lucide-react";
import type { ExperimentStepRecord, ProtocolStep } from "@/lib/types";
import { Badge } from "./ui/Badge";

export function VariableBadge({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-[var(--ln-radius-control-sm)] border border-hairline bg-sage-surface px-1.5 py-0.5 font-mono text-xs text-moss">
      {children}
    </span>
  );
}

export function ProtocolStepCard({ step }: { step: ProtocolStep }) {
  return (
    <div className="rounded-[var(--ln-radius-panel-inner)] border border-hairline bg-surface p-4">
      <div className="flex items-start gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--ln-radius-control-lg)] bg-stone font-mono text-xs text-moss">
          {step.order}
        </span>
        <div>
          <h4 className="font-semibold text-ink">{step.title}</h4>
          <p className="mt-1 text-sm leading-6 text-graphite">{step.description}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {step.requires_confirmation ? <Badge tone="warning">confirmation</Badge> : null}
            {step.allows_deviation ? <Badge tone="info">deviation allowed</Badge> : null}
          </div>
        </div>
      </div>
    </div>
  );
}

export function ProtocolRunStep({ step }: { step: ExperimentStepRecord }) {
  return (
    <div className="rounded-[var(--ln-radius-panel-inner)] border border-hairline bg-surface p-4">
      <div className="flex items-start gap-3">
        {step.completed ? (
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" aria-hidden />
        ) : (
          <Circle className="mt-0.5 h-5 w-5 shrink-0 text-muted" aria-hidden />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs text-muted">Step {step.order}</span>
            {step.completed ? <Badge tone="success">completed</Badge> : <Badge>open</Badge>}
          </div>
          <h4 className="mt-2 font-semibold text-ink">{step.title}</h4>
          <p className="mt-1 text-sm leading-6 text-graphite">{step.description}</p>
          {step.deviationNote ? (
            <p className="mt-3 rounded-[var(--ln-radius-control-lg)] border border-hairline bg-warning-surface px-3 py-2 text-sm text-graphite">
              {step.deviationNote}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function ProtocolMetric({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="rounded-[var(--ln-radius-panel-inner)] border border-hairline bg-warm p-3">
      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">{label}</p>
      <div className="mt-2 flex items-center gap-2 text-sm font-semibold text-ink">
        <FlaskConical className="h-4 w-4 text-moss" aria-hidden />
        {value}
      </div>
    </div>
  );
}
