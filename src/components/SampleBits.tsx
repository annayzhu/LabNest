import type { ReactNode } from "react";
import { Badge } from "@/components/ui/Badge";
import { formatQuantity } from "@/lib/calculators/quantity-format";
import { sampleStatusLabels, type SampleStatusValue } from "@/lib/samples";
import type { StatusTone } from "@/lib/types";

const statusTone: Record<SampleStatusValue, StatusTone> = { available: "success", depleted: "neutral", discarded: "neutral", sent_out: "info" };

export function SampleStatusBadge({ status }: { status: SampleStatusValue }) {
  return <Badge tone={statusTone[status]}>{sampleStatusLabels[status]}</Badge>;
}

/** An amount or a concentration with its unit; a dash when none was recorded. */
export function SampleQuantity({ value, unit }: { value: number | null; unit: string | null }) {
  if (value === null) return <span className="text-muted">—</span>;
  return <span><span className="font-mono tabular-nums">{formatQuantity(value)}</span>{unit ? <> <span>{unit}</span></> : null}</span>;
}

/** Where a sample is: its box path and position, or "Not placed". */
export function SamplePlace({ location, position }: { location: string | null; position: string | null }): ReactNode {
  if (!location) return <span className="text-muted">Not placed</span>;
  return <span className="min-w-0"><span>{location}</span>{position ? <span className="ml-1 font-mono text-ink">{position}</span> : null}</span>;
}
