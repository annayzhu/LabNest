"use client";

import { Bot, LoaderCircle } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import type { ExtractionItem, ExtractionStatus, SignedExtractionProposal } from "@/lib/protocol-extraction";

export type ProtocolExtractionState = SignedExtractionProposal & { acceptedIds: string[] };

const groups: { kind: ExtractionItem["kind"]; title: string }[] = [
  { kind: "parameter", title: "Parameters" },
  { kind: "consumption_rule", title: "Consumption rules" },
  { kind: "step_attribute", title: "Step attributes" },
  { kind: "result_field", title: "Result fields" },
];

const statusTone: Record<ExtractionStatus, "success" | "neutral" | "warning" | "danger"> = {
  ok: "success",
  duplicate: "neutral",
  unmatched: "warning",
  invalid: "danger",
};

/** Items checked by default: only those that passed every check. */
export function defaultAcceptedIds(items: ExtractionItem[]) {
  return items.filter((item) => item.status === "ok").map((item) => item.id);
}

function describe(item: ExtractionItem) {
  switch (item.kind) {
    case "parameter": {
      const { name, type, unit, default: fallback, options } = item.value;
      return `${name} · ${type}${unit ? ` · ${unit}` : ""}${fallback !== undefined ? ` · default ${String(fallback)}` : ""}${options?.length ? ` · ${options.join(" / ")}` : ""}`;
    }
    case "consumption_rule":
      return `${item.value.material_name} = ${item.value.formula} ${item.value.unit}`;
    case "step_attribute": {
      const flags = [
        item.value.requires_confirmation !== undefined ? `${item.value.requires_confirmation ? "requires" : "no"} confirmation` : "",
        item.value.allows_deviation !== undefined ? `${item.value.allows_deviation ? "allows" : "no"} deviation` : "",
      ].filter(Boolean);
      return `Step ${item.value.order}${item.value.title ? ` · ${item.value.title}` : ""} → ${flags.join(", ")}`;
    }
    case "result_field":
      return `${item.value.template_title} → ${item.value.label} (${item.value.key}) · ${item.value.type}${item.value.unit ? ` · ${item.value.unit}` : ""}`;
  }
}

export function ProtocolExtractionPanel({
  file,
  checksum,
  rowIndex,
  providerName,
  value,
  onChange,
}: {
  file: File;
  checksum: string;
  rowIndex: number;
  providerName?: string;
  value?: ProtocolExtractionState;
  onChange: (next: ProtocolExtractionState | undefined) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  async function run() {
    setBusy(true);
    setError(undefined);
    const formData = new FormData();
    formData.set("file", file);
    formData.set("checksum", checksum);
    formData.set("rowIndex", String(rowIndex));
    try {
      const response = await fetch("/api/ai/protocol-extraction", { method: "POST", body: formData });
      const payload = (await response.json()) as Partial<SignedExtractionProposal> & { error?: string };
      if (!response.ok || !payload.proposal || !payload.token) throw new Error(payload.error ?? "The extraction failed.");
      onChange({ proposal: payload.proposal, token: payload.token, acceptedIds: defaultAcceptedIds(payload.proposal.items) });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The extraction failed.");
    } finally {
      setBusy(false);
    }
  }

  function toggle(id: string, checked: boolean) {
    if (!value) return;
    const next = new Set(value.acceptedIds);
    if (checked) next.add(id);
    else next.delete(id);
    onChange({ ...value, acceptedIds: [...next] });
  }

  const accepted = new Set(value?.acceptedIds ?? []);

  return (
    <section className="rounded-[var(--ln-radius-panel-inner)] border border-moss/25 bg-sage-surface/40 p-3" aria-label="AI extraction">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h4 className="flex items-center gap-2 text-xs font-semibold text-ink"><Bot className="h-4 w-4 text-moss" aria-hidden />AI extraction</h4>
          <p className="mt-1 text-xs leading-5 text-muted">
            {providerName
              ? `Sends this document's text (no images) to ${providerName}. Suggestions are checked against the document; only ticked items are written into the new version.`
              : "Connect a model provider in Settings and turn on AI access to extract parameters, consumption rules, step attributes, and result fields."}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          {value ? <Button type="button" size="sm" variant="ghost" onClick={() => onChange(undefined)} disabled={busy}>Discard</Button> : null}
          <Button type="button" size="sm" variant={value ? "secondary" : "primary"} onClick={run} disabled={!providerName || busy}>
            {busy ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden /> : <Bot className="h-4 w-4" aria-hidden />}
            {busy ? "Reading document…" : value ? "Run again" : "Extract with AI"}
          </Button>
        </div>
      </div>

      {error ? <p role="alert" className="mt-3 rounded-[var(--ln-radius-control-md)] bg-error-surface px-3 py-2 text-xs text-error">{error}</p> : null}

      {value ? (
        <div className="mt-3 space-y-3">
          <p className="text-xs font-medium text-ink" aria-live="polite">
            {accepted.size} of {value.proposal.items.length} suggestions selected · {value.proposal.provider}{value.proposal.model ? ` · ${value.proposal.model}` : ""}
          </p>
          {value.proposal.warnings.map((warning) => <p key={warning} className="rounded-[var(--ln-radius-control-md)] bg-warning-surface px-3 py-2 text-xs text-warning">{warning}</p>)}
          {value.proposal.items.length === 0 ? <p className="text-xs text-muted">The model found nothing to add beyond what the importer already recognized.</p> : null}
          {groups.map((group) => {
            const items = value.proposal.items.filter((item) => item.kind === group.kind);
            if (!items.length) return null;
            return (
              <fieldset key={group.kind} className="space-y-2">
                <legend className="text-xs font-semibold text-ink">{group.title}</legend>
                {items.map((item) => (
                  <label key={item.id} className={`flex items-start gap-3 rounded-[var(--ln-radius-control-md)] border border-hairline bg-surface px-3 py-2 ${item.status === "invalid" ? "opacity-70" : "cursor-pointer"}`}>
                    <input
                      type="checkbox"
                      className="mt-1 h-4 w-4 shrink-0 accent-[var(--moss)]"
                      checked={accepted.has(item.id)}
                      disabled={item.status === "invalid"}
                      onChange={(event) => toggle(item.id, event.target.checked)}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="break-words font-mono text-xs text-ink">{describe(item)}</span>
                        <Badge tone={statusTone[item.status]}>{item.status}</Badge>
                      </span>
                      {item.message ? <span className="mt-1 block text-xs text-muted">{item.message}</span> : null}
                      <span className="mt-1 block break-words border-l-2 border-moss/30 pl-2 text-xs italic leading-5 text-graphite">“{item.evidence}”</span>
                    </span>
                  </label>
                ))}
              </fieldset>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}
