"use client";

import { Camera, ChevronRight, Plus, Search } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { useI18n } from "@/components/I18nProvider";
import { formatQuantity } from "@/lib/calculators/quantity-format";
import { readInventoryBarcode } from "@/lib/inventory-barcode";
import type { InventoryRiskFlag } from "@/lib/inventory";

type MobileInventoryItem = {
  id: string; name: string; subtitle: string; code: string; lot: string;
  quantity: number; quantityRecorded: boolean; unit: string; location: string;
  riskFlags: InventoryRiskFlag[];
};

export function MobileInventoryBench({ items, totalCount, query, filters, riskCounts }: {
  items: MobileInventoryItem[]; totalCount: number; query?: string;
  filters: Record<string, string | undefined>; riskCounts: Record<InventoryRiskFlag, number>;
}) {
  const router = useRouter();
  const zh = useI18n().locale === "zh";
  const cameraInput = useRef<HTMLInputElement>(null);
  const searchInput = useRef<HTMLInputElement>(null);
  const [scanStatus, setScanStatus] = useState("");
  const [reading, setReading] = useState(false);
  const [visibleCount, setVisibleCount] = useState(12);
  const labels: Record<InventoryRiskFlag, string> = {
    low: zh ? "余量不足" : "Low stock",
    depleted: zh ? "已用完" : "Out of stock",
    expired: zh ? "已过期" : "Expired",
    expiring: zh ? "30天内到期" : "Expires in 30 days",
  };
  const filtered = Object.values(filters).some(Boolean) || Boolean(query);

  async function scanImage(file?: File) {
    if (!file || reading) return;
    setReading(true);
    setScanStatus(zh ? "正在识别条码…" : "Reading barcode…");
    try {
      const value = await readInventoryBarcode(file);
      if (searchInput.current) searchInput.current.value = value;
      setScanStatus(zh ? "已识别，请核对物料和批次。" : "Code read. Confirm the material and lot.");
      // A scan starts a search, never an inventory mutation or an automatic choice of bottle.
      router.push(`/inventory?q=${encodeURIComponent(value)}`);
    } catch {
      setScanStatus(zh ? "未识别到清晰条码。请靠近标签重新拍照，或输入条码、批号查找。" : "No readable barcode. Take a closer photo, or enter the barcode or lot number.");
      searchInput.current?.focus();
    } finally {
      setReading(false);
    }
  }

  return <section className="space-y-4 lg:hidden" aria-label={zh ? "实验台库存" : "Bench inventory"}>
    <header className="flex items-center justify-between gap-3">
      <div className="min-w-0"><h1 className="page-header-title text-ink">{zh ? "实验台库存" : "Inventory at the bench"}</h1></div>
      <Link href="/inventory/new" className="focus-ring inline-flex min-h-11 items-center gap-1 text-sm text-moss"><Plus className="h-4 w-4" aria-hidden />{zh ? "新增物料" : "Add material"}</Link>
    </header>
    <div>
      <form action="/inventory" className="space-y-3">
        {Object.entries(filters).filter(([key, value]) => key !== "flag" && value).map(([key, value]) => <input key={key} type="hidden" name={key} value={value} />)}
        <div className="flex gap-2">
          <label className="relative min-w-0 flex-1">
            <span className="sr-only">{zh ? "搜索库存" : "Search inventory"}</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" aria-hidden />
            <input ref={searchInput} name="q" defaultValue={query} className="focus-ring h-12 w-full rounded-[var(--ln-radius-control-lg)] border border-hairline bg-surface pl-10 pr-3 text-base text-ink"
              placeholder={zh ? "名称、条码、批号或位置" : "Name, barcode, lot or location"} />
          </label>
          <button className="focus-ring min-h-12 rounded-[var(--ln-radius-control-lg)] border border-hairline px-4 text-sm font-medium text-moss">{zh ? "搜索" : "Search"}</button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" disabled={reading} aria-busy={reading} onClick={() => cameraInput.current?.click()}
            className="ln-key-action focus-ring flex min-h-12 flex-1 items-center justify-center gap-2 rounded-[var(--ln-radius-control-lg)] px-3 text-sm font-semibold disabled:opacity-60">
            <Camera className="h-5 w-5" aria-hidden />{reading ? (zh ? "正在识别…" : "Reading…") : (zh ? "拍照识码" : "Scan barcode")}
          </button>
          <label className="min-w-0 flex-1">
            <span className="sr-only">{zh ? "库存状态" : "Stock status"}</span>
            <select name="flag" defaultValue={filters.flag ?? ""} onChange={(event) => event.currentTarget.form?.requestSubmit()}
              className="focus-ring min-h-12 w-full rounded-[var(--ln-radius-control-lg)] border border-hairline bg-surface px-2 text-base text-ink">
              <option value="">{zh ? "全部状态" : "All states"}</option>
              {Object.entries(labels).map(([flag, label]) => <option key={flag} value={flag}>{label} ({riskCounts[flag as InventoryRiskFlag]})</option>)}
            </select>
          </label>
        </div>
      </form>
      <input ref={cameraInput} type="file" accept="image/*" capture="environment" className="sr-only" disabled={reading}
        onChange={(event) => { void scanImage(event.target.files?.[0]); event.target.value = ""; }} />
      <p className="mt-2 text-sm leading-5 text-muted">{zh ? "识别后先核对物料、批次和位置，再登记领用或补货。" : "Confirm the material, lot and location before recording stock use or receipt."}</p>
      {scanStatus ? <p role="status" aria-live="polite" className="mt-2 text-sm leading-5 text-graphite">{scanStatus}</p> : null}
    </div>
    <section aria-labelledby="recent-inventory-title">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h2 id="recent-inventory-title" className="text-base font-semibold text-ink">{filtered ? (zh ? "查找结果" : "Matches") : (zh ? "最近更新" : "Recently updated")}</h2>
        {filtered ? <Link href="/inventory" className="focus-ring flex min-h-11 items-center px-2 text-sm text-moss">{zh ? "清除筛选" : "Clear filters"}</Link> : null}
        <span className="text-sm text-muted" data-i18n-ignore>{zh ? `${items.length} 项` : `${items.length} items`}</span>
      </div>
      <div className="divide-y divide-hairline border-y border-hairline">
        {items.slice(0, visibleCount).map((item) => <Link key={item.id} href={`/inventory/${item.id}`} className="focus-ring flex min-h-20 items-center gap-3 py-3" data-mobile-inventory-item>
          <span className="min-w-0 flex-1">
            <span className="block text-base font-semibold leading-6 text-ink">{item.name}</span>
            <span className="mt-1 block text-sm text-muted">{item.location || (zh ? "位置未登记" : "No location")} · {item.subtitle}</span>
            {item.lot ? <span className="mt-1 block text-sm text-muted">{zh ? "批号" : "Lot"}: {item.lot}</span> : null}
            {item.code ? <span className="mt-1 block break-all text-xs text-muted" data-i18n-ignore>{item.code}</span> : null}
            {item.riskFlags.length ? <span className="mt-1 block text-sm font-medium text-warning">{item.riskFlags.map(flag => labels[flag]).join(" · ")}</span> : null}
          </span>
          <span className="max-w-28 shrink-0 text-right text-sm font-medium text-ink">{item.quantityRecorded ? `${formatQuantity(item.quantity)} ${item.unit}` : (zh ? "余量未登记" : "Quantity not recorded")}</span>
          <ChevronRight className="h-4 w-4 shrink-0 text-muted" aria-hidden />
        </Link>)}
        {!items.length ? <div className="py-6 text-sm leading-6 text-muted">
          {totalCount === 0 ? (zh ? "尚未登记库存。先添加物料，再使用名称或条码查找。" : "No inventory yet. Add a material, then find it by name or barcode.")
            : (zh ? "没有找到匹配物料。请检查条码或批号，也可以改用名称搜索。" : "No matching material. Check the barcode or lot number, or search by name.")}
        </div> : null}
      </div>
      {visibleCount < items.length ? <button type="button" onClick={() => setVisibleCount(count => count + 12)} className="focus-ring mt-3 min-h-12 w-full rounded-[var(--ln-radius-control-lg)] border border-hairline text-sm font-medium text-moss">{zh ? `显示更多（已显示 ${visibleCount}/${items.length}）` : `Show more (${visibleCount}/${items.length})`}</button> : null}
    </section>
  </section>;
}
