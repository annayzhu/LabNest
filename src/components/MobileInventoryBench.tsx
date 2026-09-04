"use client";

import { AlertTriangle, Camera, ChevronRight, PackageSearch, Search } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

type MobileInventoryItem = {
  id: string;
  name: string;
  subtitle: string;
  code: string;
  quantity: number;
  unit: string;
  location: string;
  risk: boolean;
};

type BarcodeDetectorConstructor = new (options?: { formats?: string[] }) => {
  detect(source: ImageBitmapSource): Promise<Array<{ rawValue: string }>>;
};

export function MobileInventoryBench({ items, query, attentionCount }: { items: MobileInventoryItem[]; query?: string; attentionCount: number }) {
  const router = useRouter();
  const cameraInput = useRef<HTMLInputElement>(null);
  const [scanStatus, setScanStatus] = useState("");

  async function scanImage(file?: File) {
    if (!file) return;
    const Detector = (window as unknown as { BarcodeDetector?: BarcodeDetectorConstructor }).BarcodeDetector;
    if (!Detector) {
      setScanStatus("Automatic barcode reading is unavailable here. Enter the barcode or lot number below.");
      return;
    }
    try {
      setScanStatus("Reading code…");
      const bitmap = await createImageBitmap(file);
      const codes = await new Detector({ formats: ["qr_code", "code_128", "data_matrix", "ean_13", "ean_8"] }).detect(bitmap);
      bitmap.close();
      if (!codes[0]?.rawValue) throw new Error("No code found");
      router.push(`/inventory?q=${encodeURIComponent(codes[0].rawValue)}`);
    } catch {
      setScanStatus("No readable code was found. Try again or enter it manually.");
    }
  }

  return (
    <section className="space-y-4 lg:hidden" aria-label="Bench inventory">
      <div>
        <h1 className="font-serif text-2xl font-medium tracking-[-0.02em] text-ink">Inventory at the bench</h1>
        <p className="mt-1 text-sm text-muted">Scan or search first, then confirm the material before recording a movement.</p>
      </div>

      <div className="rounded-[var(--ln-radius-panel)] border border-hairline bg-surface p-3">
        <button type="button" onClick={() => cameraInput.current?.click()} className="focus-ring flex min-h-13 w-full items-center justify-center gap-2 rounded-[var(--ln-radius-control-lg)] bg-action px-4 text-sm font-semibold text-white">
          <Camera className="h-5 w-5" aria-hidden /> Scan barcode
        </button>
        <input ref={cameraInput} type="file" accept="image/*" capture="environment" className="sr-only" onChange={(event) => { void scanImage(event.target.files?.[0]); event.target.value = ""; }} />
        <form action="/inventory" className="relative mt-3">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
          <input name="q" defaultValue={query} className="focus-ring h-12 w-full rounded-[var(--ln-radius-control-lg)] border border-hairline bg-warm pl-10 pr-20 text-base text-ink" placeholder="Barcode, lot, name…" aria-label="Search inventory" />
          <button className="focus-ring absolute inset-y-1 right-1 rounded-[var(--ln-radius-control-md)] px-3 text-sm font-semibold text-moss">Search</button>
        </form>
        {scanStatus ? <p role="status" className="mt-2 text-xs leading-5 text-muted">{scanStatus}</p> : null}
      </div>

      {attentionCount ? <Link href="/inventory?flag=low" className="focus-ring flex min-h-12 items-center gap-3 rounded-[var(--ln-radius-panel)] border border-warning/30 bg-warning-surface px-4 text-sm text-graphite"><AlertTriangle className="h-4 w-4 shrink-0 text-warning" aria-hidden /><span className="flex-1"><strong className="font-semibold text-ink">Needs attention</strong><span className="ml-2">{attentionCount} stock or expiry risks</span></span><ChevronRight className="h-4 w-4" aria-hidden /></Link> : null}

      <section aria-labelledby="recent-inventory-title">
        <div className="mb-2 flex items-center justify-between"><h2 id="recent-inventory-title" className="text-base font-semibold text-ink">{query ? "Matches" : "Recently updated"}</h2><span className="text-xs text-muted">{items.length} shown</span></div>
        <div className="divide-y divide-hairline overflow-hidden rounded-[var(--ln-radius-panel)] border border-hairline bg-surface">
          {items.length ? items.map((item) => <Link key={item.id} href={`/inventory/${item.id}`} className="focus-ring flex min-h-16 items-center gap-3 px-4 py-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-warm text-moss"><PackageSearch className="h-4 w-4" aria-hidden /></span>
            <span className="min-w-0 flex-1"><span className="line-clamp-1 block text-sm font-semibold text-ink">{item.name}</span><span className="mt-1 block truncate text-xs text-muted">{item.subtitle} · {item.location}</span>{item.code ? <span className="record-identifier mt-1 block truncate text-[10px] text-muted">{item.code}</span> : null}</span>
            <span className="shrink-0 text-right"><span className="block font-mono text-xs text-ink">{item.quantity} {item.unit}</span>{item.risk ? <span className="mt-1 block text-[10px] font-semibold text-warning">Review</span> : null}</span>
          </Link>) : <p className="px-4 py-8 text-center text-sm text-muted">No inventory item matches this code or search.</p>}
        </div>
      </section>
    </section>
  );
}
