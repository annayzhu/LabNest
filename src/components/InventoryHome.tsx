"use client";

import { Camera, LoaderCircle, MapPin, PackageMinus, PackagePlus, Search, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { recordInventoryTransaction } from "@/app/inventory/actions";
import { applyStockBulk } from "@/app/inventory/bulk-actions";
import { receiveContainers, searchStock } from "@/app/inventory/home-actions";
import { useI18n } from "@/components/I18nProvider";
import { QuantityText } from "@/components/InventoryDetail";
import { InventoryRiskBadges } from "@/components/InventoryRiskBadges";
import { formInputClass, formLabelClass } from "@/components/forms";
import { Button } from "@/components/ui/Button";
import { newClientMutationId } from "@/lib/client-mutation-id";
import { cn } from "@/lib/cn";
import { formatStockQuantity, quantityStep } from "@/lib/inventory";
import { readInventoryBarcode } from "@/lib/inventory-barcode";
import type { InventoryAlert } from "@/lib/inventory-home.server";
import type { RowLot, StockRow, StockSearch } from "@/lib/inventory-search";

type Direction = "out" | "in";
const placesList = "inventory-home-places";
const usable = (row: StockRow) => row.lots.filter((lot) => lot.quantityRecorded && lot.managementMode !== "information");

/**
 * The inventory home (Q180–Q184): one search that answers as you type, a scan of a label, what needs attention, and
 * take-out or receipt right in the row. With nothing typed the rows are the stock used most recently.
 */
export function InventoryHome({ initial, alerts, places }: { initial: StockSearch; alerts: InventoryAlert[]; places: string[] }) {
  const router = useRouter();
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const [result, setResult] = useState(initial);
  const [searching, setSearching] = useState(false);
  const [active, setActive] = useState(0);
  const [moving, setMoving] = useState<{ key: string; direction: Direction } | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [scan, setScan] = useState("");
  const latest = useRef(0);
  // Only typing triggers the delayed search: the first rows came with the page, and a scanned code is searched at once.
  const typed = useRef(false);
  const input = useRef<HTMLInputElement>(null);
  const camera = useRef<HTMLInputElement>(null);
  const search = query.trim();

  async function run(text: string) {
    const ticket = ++latest.current;
    setSearching(true);
    const next = await searchStock(text);
    // An older answer never replaces a newer one.
    if (ticket === latest.current) {
      setResult(next);
      setSearching(false);
      setActive(0);
    }
    return next;
  }

  useEffect(() => {
    // On a desktop the search is ready to type into; a phone keeps its keyboard down until asked.
    if (window.matchMedia("(min-width: 1024px)").matches) input.current?.focus();
  }, []);

  useEffect(() => {
    if (!typed.current) return;
    const timer = setTimeout(() => void run(query), 180);
    return () => clearTimeout(timer);
  }, [query]);

  function type(text: string) {
    typed.current = true;
    setQuery(text);
    setMoving(null);
    setDone(null);
  }

  function keys(event: React.KeyboardEvent<HTMLInputElement>) {
    const rows = result.rows;
    if (event.key === "ArrowDown") { event.preventDefault(); setActive((index) => Math.min(index + 1, rows.length - 1)); }
    if (event.key === "ArrowUp") { event.preventDefault(); setActive((index) => Math.max(index - 1, 0)); }
    if (event.key === "Enter" && rows[active]) { event.preventDefault(); router.push(rows[active].href); }
    if (event.key === "Escape" && query) { event.preventDefault(); type(""); }
  }

  async function scanImage(file?: File) {
    if (!file) return;
    setScan(t("Reading barcode…"));
    try {
      const code = await readInventoryBarcode(file);
      typed.current = false;
      setQuery(code);
      const found = await run(code);
      // A code that names exactly one lot opens it; anything else shows the matches to choose from.
      const exact = found.rows.filter((row) => row.exact);
      if (exact.length === 1) { router.push(`/inventory/${exact[0].focusLotId}`); return; }
      setScan(found.rows.length ? t("Code read. Choose the stock below.") : t("No stock has this code."));
    } catch {
      setScan(t("No readable barcode. Take a closer photo, or type the code."));
      input.current?.focus();
    }
  }

  async function moved(key: string) {
    setMoving(null);
    setDone(key);
    await run(query);
    router.refresh();
  }

  return (
    <div className="min-w-0 space-y-3">
      <div className="flex gap-2">
        <label className="relative min-w-0 flex-1">
          <span className="sr-only">Search stock</span>
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" aria-hidden />
          <input
            ref={input}
            type="search"
            value={query}
            onChange={(event) => type(event.target.value)}
            onKeyDown={keys}
            enterKeyHint="go"
            autoComplete="off"
            placeholder="Name, lot, barcode, catalogue, CAS or place"
            className="focus-ring h-12 w-full rounded-[var(--ln-radius-control-lg)] border border-hairline bg-surface pl-11 pr-10 text-base text-ink placeholder:text-muted [&::-webkit-search-cancel-button]:hidden"
          />
          {searching ? <LoaderCircle className="absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted" aria-hidden />
            : query ? <button type="button" aria-label="Clear search" title="Clear search" onClick={() => { type(""); input.current?.focus(); }} className="focus-ring absolute right-2 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-[var(--ln-radius-control-sm)] text-muted hover:bg-stone hover:text-ink"><X className="h-4 w-4" aria-hidden /></button> : null}
        </label>
        <button type="button" onClick={() => camera.current?.click()} className="focus-ring inline-flex h-12 shrink-0 items-center gap-2 rounded-[var(--ln-radius-control-lg)] border border-hairline bg-surface px-4 text-sm font-medium text-moss hover:bg-sage-surface/60">
          <Camera className="h-5 w-5" aria-hidden /><span className="max-sm:sr-only">Scan</span>
        </button>
        <input ref={camera} type="file" accept="image/*" capture="environment" className="sr-only" tabIndex={-1} aria-hidden onChange={(event) => { void scanImage(event.target.files?.[0]); event.target.value = ""; }} />
      </div>
      {scan ? <p role="status" aria-live="polite" className="text-sm text-graphite">{scan}</p> : null}

      {alerts.length ? (
        <nav aria-label="Needs attention" className="flex flex-wrap items-center gap-2">
          {alerts.map((alert) => (
            <Link key={alert.label} href={alert.href} className="focus-ring inline-flex h-7 items-center gap-1.5 rounded-[var(--ln-radius-control-sm)] border border-hairline bg-surface px-2.5 text-xs text-graphite hover:border-border-strong hover:text-ink">
              <span>{alert.label}</span>
              <span className={cn("font-semibold tabular-nums", alert.tone === "danger" ? "text-error" : alert.tone === "warning" ? "text-warning" : "text-info")}>{alert.value}</span>
            </Link>
          ))}
        </nav>
      ) : null}

      <section aria-labelledby="inventory-home-rows" className="overflow-hidden rounded-[var(--ln-radius-panel)] border border-hairline bg-surface">
        <header className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-hairline px-4 py-2.5">
          <h2 id="inventory-home-rows" className="text-sm font-semibold text-ink">{search ? "Matches" : "Recently used"}</h2>
          {search && result.total > result.rows.length ? <Link href={`/inventory/list?q=${encodeURIComponent(search)}`} className="text-xs font-medium text-moss hover:underline">{t(`All ${result.total} in the stock list`)}</Link> : null}
        </header>
        {result.rows.length ? (
          <ul aria-busy={searching} className={cn("divide-y divide-hairline transition-opacity", searching && "opacity-60")}>
            {result.rows.map((row, index) => (
              <StockRowItem
                key={row.key}
                row={row}
                active={!!search && index === active}
                moving={moving?.key === row.key ? moving.direction : null}
                done={done === row.key}
                onMove={(direction) => { setDone(null); setMoving(moving?.key === row.key && moving.direction === direction ? null : { key: row.key, direction }); }}
                onMoved={() => moved(row.key)}
              />
            ))}
          </ul>
        ) : (
          <div className="space-y-2 px-4 py-8 text-center text-sm text-graphite">
            {search ? <>
              <p>{t(`No stock matches “${search}”.`)}</p>
              <p className="flex flex-wrap justify-center gap-x-4 gap-y-1"><Link href={`/inventory/products?q=${encodeURIComponent(search)}`} className="font-medium text-moss hover:underline">Search products</Link><Link href="/inventory/new" className="font-medium text-moss hover:underline">Register stock</Link></p>
            </> : <>
              <p>No stock yet. Register what is on the shelf, or import a spreadsheet.</p>
              <p className="flex flex-wrap justify-center gap-x-4 gap-y-1"><Link href="/inventory/new" className="font-medium text-moss hover:underline">Register stock</Link><Link href="/inventory/import" className="font-medium text-moss hover:underline">Import</Link></p>
            </>}
          </div>
        )}
      </section>
      <datalist id={placesList}>{places.map((place) => <option key={place} value={place} />)}</datalist>
    </div>
  );
}

function StockRowItem({ row, active, moving, done, onMove, onMoved }: {
  row: StockRow;
  active: boolean;
  moving: Direction | null;
  done: boolean;
  onMove: (direction: Direction) => void;
  onMoved: () => void;
}) {
  const { t } = useI18n();
  const canMove = usable(row).length > 0;
  return (
    <li className={cn("px-4 py-3 transition-colors", active && "bg-warm/70")}>
      <div className="flex flex-wrap items-start gap-x-4 gap-y-2 sm:flex-nowrap">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <Link href={row.href} className="font-semibold text-ink hover:text-moss">{row.name}</Link>
            {row.kind ? <span className="text-xs text-muted">{row.kind}</span> : null}
          </div>
          {row.detail ? <p className="mt-0.5 truncate text-xs text-muted">{row.detail}</p> : null}
          <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-graphite">
            {row.totals.length ? row.totals.map((total) => <span key={total.unit} className="font-medium text-ink"><QuantityText quantity={total.quantity} unit={total.unit} /></span>) : <span className="text-muted">Quantity not recorded</span>}
            {row.places.length ? (
              <span className="inline-flex min-w-0 max-w-full items-center gap-1">
                <MapPin className="h-3.5 w-3.5 shrink-0 text-muted" aria-hidden />
                <span className="truncate">{row.places[0]}</span>
                {row.places.length > 1 ? <span className="shrink-0 text-muted">{t(`+${row.places.length - 1} more`)}</span> : null}
              </span>
            ) : null}
            {row.expiry ? <span className="text-muted"><span>Expires</span> <span className="tabular-nums">{row.expiry}</span></span> : null}
            {row.lots.length > 1 ? <span className="text-muted">{t(`${row.lots.length} lots`)}</span> : null}
          </p>
          {row.flags.length ? <div className="mt-1.5"><InventoryRiskBadges flags={row.flags} linkToFilters /></div> : null}
        </div>
        {canMove ? (
          <div className="flex shrink-0 gap-1.5">
            <Button type="button" size="sm" aria-expanded={moving === "out"} onClick={() => onMove("out")}><PackageMinus className="h-3.5 w-3.5" aria-hidden />Take out</Button>
            <Button type="button" size="sm" aria-expanded={moving === "in"} onClick={() => onMove("in")}><PackagePlus className="h-3.5 w-3.5" aria-hidden />Receive</Button>
          </div>
        ) : null}
      </div>
      {moving ? <QuickMove key={moving} row={row} direction={moving} onCancel={() => onMove(moving)} onDone={onMoved} /> : null}
      {done ? <p role="status" className="mt-2 text-sm text-success">Recorded.</p> : null}
    </li>
  );
}

/** Take-out or receipt for one lot of the row, in place: an amount for precise stock, containers for stock kept by container. */
function QuickMove({ row, direction, onCancel, onDone }: { row: StockRow; direction: Direction; onCancel: () => void; onDone: () => void }) {
  const { t } = useI18n();
  const lots = usable(row);
  const [lotId, setLotId] = useState(lots.some((lot) => lot.id === row.focusLotId) ? row.focusLotId : lots[0].id);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [receiptKey] = useState(newClientMutationId);
  const lot = lots.find((entry) => entry.id === lotId) ?? lots[0];
  const containers = lot.managementMode === "package";
  const step = quantityStep(lot.unit);
  const out = direction === "out";
  const lotLabel = (entry: RowLot) => [
    entry.lotNumber ? t(`Lot ${entry.lotNumber}`) : t("No lot number"),
    `${formatStockQuantity(entry.quantity, entry.unit)} ${t(entry.unit)}`,
    entry.location,
    entry.expiry ? `${t("Expires")} ${entry.expiry}` : null,
  ].filter(Boolean).join(" · ");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const text = (name: string) => String(data.get(name) ?? "").trim();
    setBusy(true);
    setError("");
    let problem: string | undefined;
    try {
      if (containers && out) {
        const result = await applyStockBulk({ action: "takeOut", ids: [lot.id], count: Number(text("count")), holder: text("holder"), place: text("place") });
        problem = result.error ?? result.entries?.find((entry) => entry.outcome === "skip")?.reason;
      } else if (containers) {
        problem = (await receiveContainers(lot.id, { count: Number(text("count")), place: text("place"), clientMutationId: receiptKey })).error;
      } else {
        data.set("type", out ? "consume" : "receive");
        problem = (await recordInventoryTransaction(lot.id, {}, data)).error;
      }
    } catch {
      problem = "The network failed.";
    }
    setBusy(false);
    if (problem) setError(t(problem));
    else onDone();
  }

  return (
    <form onSubmit={submit} className="mt-3 grid gap-3 rounded-[var(--ln-radius-panel-inner)] border border-hairline bg-warm p-3 sm:grid-cols-2 lg:grid-cols-4 lg:items-end">
      {lots.length > 1 ? (
        <label className="sm:col-span-2 lg:col-span-4">
          <span className={formLabelClass}>Lot</span>
          <select value={lot.id} onChange={(event) => { setLotId(event.target.value); setError(""); }} className={formInputClass}>
            {lots.map((entry) => <option key={entry.id} value={entry.id}>{lotLabel(entry)}</option>)}
          </select>
        </label>
      ) : null}
      {containers ? <>
        <label>
          <span className={formLabelClass}>How many</span>
          <input name="count" type="number" required min={1} max={out ? Math.max(lot.inStore, 1) : 1000} step={1} defaultValue={1} className={formInputClass} />
          {out ? <span className="mt-1 block text-xs text-muted"><span>In store</span> <span className="tabular-nums">{lot.inStore}</span></span> : null}
        </label>
        {out ? <label><span className={formLabelClass}>Recipient</span><input name="holder" required maxLength={120} className={formInputClass} /></label> : null}
        <label><span className={formLabelClass}>Put at (optional)</span><input name="place" list={placesList} maxLength={240} className={formInputClass} /></label>
      </> : <>
        <label>
          <span className={formLabelClass}>Amount</span>
          <span className="relative block">
            <input name="quantity" type="number" required min={step} step={step} className={`${formInputClass} pr-12 tabular-nums`} />
            <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-muted">{lot.unit}</span>
          </span>
        </label>
        <label><span className={formLabelClass}>{row.strict ? "Handled by *" : "Handled by"}</span><input name="performedBy" required={row.strict} maxLength={120} className={formInputClass} /></label>
        <label><span className={formLabelClass}>{row.strict ? "Purpose *" : "Note"}</span><input name="notes" required={row.strict} maxLength={2000} className={formInputClass} /></label>
      </>}
      <div className="flex gap-2 sm:col-span-2 lg:col-span-1 lg:justify-end">
        <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={onCancel}>Cancel</Button>
        <Button type="submit" variant="primary" size="sm" disabled={busy} aria-busy={busy}>{busy ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" aria-hidden /> : out ? <PackageMinus className="h-3.5 w-3.5" aria-hidden /> : <PackagePlus className="h-3.5 w-3.5" aria-hidden />}{out ? "Take out" : "Receive"}</Button>
      </div>
      {error ? <p role="alert" className="text-sm text-error sm:col-span-2 lg:col-span-4">{error}</p> : null}
    </form>
  );
}
