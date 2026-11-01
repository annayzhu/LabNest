import type { ReactNode } from "react";
import { formatStockQuantity } from "@/lib/inventory";

// The building blocks inventory detail pages share, so the stock, product and type pages line up the same way.

/** One cell of the summary row under a detail page's title. */
export function Fact({ label, value, detail }: { label: string; value: ReactNode; detail?: ReactNode }) {
  return (
    <div className="min-w-0 px-4 py-3">
      <p className="text-xs text-muted">{label}</p>
      <div className="mt-1 min-h-6 truncate text-base font-semibold text-ink">{value}</div>
      {detail ? <p className="mt-0.5 truncate text-xs text-muted">{detail}</p> : null}
    </div>
  );
}

/** A bordered section of the main column; `flush` lets a table reach the border. */
export function Panel({ title, children, flush = false }: { title: string; children: ReactNode; flush?: boolean }) {
  return (
    <section className="rounded-[var(--ln-radius-panel)] border border-hairline bg-surface">
      <h2 className="border-b border-hairline px-4 py-2.5 font-semibold text-ink">{title}</h2>
      {/* A table reaching the panel's border drops its own frame, so the panel is not a box inside a box. */}
      <div className={flush ? "[&_.ln-data-table-frame]:rounded-none! [&_.ln-data-table-frame]:border-0! [&_.ln-data-table-frame]:shadow-none!" : "p-4"}>{children}</div>
    </section>
  );
}

/** A section of the side panel, separated from the next by the panel's hairline. */
export function SideSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-1.5 px-4 py-3">
      <h3 className="text-xs! font-semibold text-muted">{title}</h3>
      {children}
    </section>
  );
}

/** A label and value in the side panel; empty values are left out. */
export function Row({ label, value, mono = false }: { label: string; value: ReactNode; mono?: boolean }) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <div className="grid grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] gap-3 text-sm">
      <span className="text-muted">{label}</span>
      <span className={`min-w-0 break-words text-ink ${mono ? "font-mono text-xs leading-5" : ""}`}>{value}</span>
    </div>
  );
}

/**
 * 已用完 on a take-out form (Q196): what is taken out is marked empty at once. Unticked, it stays with the recipient
 * until someone marks it used up or returns it; using it in an experiment is never required.
 */
export function UsedUpCheckbox({ className, checked, onChange, disabled }: { className?: string; checked?: boolean; onChange?: (checked: boolean) => void; disabled?: boolean }) {
  return (
    <label className={`inline-flex min-h-8 items-center gap-2 text-sm text-graphite ${className ?? ""}`}>
      <input type="checkbox" name="usedUp" checked={checked} disabled={disabled} onChange={onChange ? (event) => onChange(event.target.checked) : undefined} className="h-4 w-4 accent-[var(--action)]" />
      <span>Already used up</span>
    </label>
  );
}

/** An amount with its unit as separate text, so the unit reads in Chinese; stock never counted says so. */
export function QuantityText({ quantity, unit, recorded = true }: { quantity: number; unit: string | null; recorded?: boolean }) {
  if (!recorded) return <span className="text-muted">Quantity not recorded</span>;
  return <span><span className="font-mono">{formatStockQuantity(quantity, unit)}</span> <span>{unit}</span></span>;
}
