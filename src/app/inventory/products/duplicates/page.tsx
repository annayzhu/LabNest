import Link from "next/link";
import { GitMerge } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Panel, QuantityText } from "@/components/InventoryDetail";
import { InventoryNav } from "@/components/InventoryNav";
import { NotDuplicateButton } from "@/components/NotDuplicateButton";
import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { buttonStyles } from "@/components/ui/Button";
import { prisma } from "@/lib/db";
import type { DuplicateReason } from "@/lib/inventory-duplicates";
import { duplicateOverview } from "@/lib/inventory-products.server";

export const dynamic = "force-dynamic";

const reasonNames: Record<DuplicateReason, string> = { catalogue: "Same catalogue number", cas: "Same CAS number", name: "Same name" };

/** Products and stock lots that may be the same, to merge or to mark as different; nothing here changes on its own. */
export default async function InventoryDuplicatesPage() {
  const { products, productPairs, lotGroups } = await duplicateOverview(prisma);
  const productNames = new Map(products.map((product) => [product.id, product.name]));
  const mergeLink = buttonStyles({ variant: "secondary", size: "sm", className: "font-medium" });

  return (
    <AppShell>
      <div className="space-y-4">
        <PageHeader title="Duplicate check" />
        <InventoryNav current="products" />

        <Panel title="Products that may be the same" flush>
          {productPairs.length ? (
            <ul className="divide-y divide-hairline">
              {productPairs.map((pair) => (
                <li key={`${pair.first.id}|${pair.second.id}`} className="grid gap-x-4 gap-y-2 px-4 py-3 text-sm md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_21rem] md:items-center">
                  {[pair.first, pair.second].map((product) => (
                    <div key={product.id} className="min-w-0">
                      <Link href={`/inventory/products/${product.id}`} className="font-semibold text-ink hover:text-moss">{product.name}</Link>
                      <p className="mt-0.5 truncate text-xs text-muted">
                        <span>{[product.brand, product.catalogNumber].filter(Boolean).join(" · ") || product.englishName || "—"}</span>
                        {" · "}<span>Lots</span> <span className="tabular-nums">{product._count.items}</span>
                        {product.status === "archived" ? <>{" · "}<span>Archived</span></> : null}
                      </p>
                    </div>
                  ))}
                  <div className="flex flex-wrap items-center gap-2 md:justify-end">
                    {pair.exact ? <Badge tone="warning">Same brand and catalogue number</Badge> : null}
                    {pair.reasons.filter((reason) => !(pair.exact && reason === "catalogue")).map((reason) => <Badge key={reason}>{reasonNames[reason]}</Badge>)}
                    <Link href={`/inventory/products/merge?keep=${pair.first.id}&other=${pair.second.id}`} className={mergeLink}><GitMerge className="h-3.5 w-3.5" aria-hidden />Merge…</Link>
                    <NotDuplicateButton ids={[pair.first.id, pair.second.id]} />
                  </div>
                </li>
              ))}
            </ul>
          ) : <p className="px-4 py-3 text-sm text-muted">No products look the same.</p>}
        </Panel>

        <Panel title="Lots that may be registered twice" flush>
          {lotGroups.length ? (
            <ul className="divide-y divide-hairline">
              {lotGroups.map((group) => (
                <li key={group.map((lot) => lot.id).join("|")} className="grid gap-x-4 gap-y-2 px-4 py-3 text-sm md:grid-cols-[minmax(0,1fr)_21rem] md:items-center">
                  <div className="min-w-0">
                    <p>
                      <Link href={`/inventory/products/${group[0].productId}`} className="font-semibold text-ink hover:text-moss">{productNames.get(group[0].productId ?? "") ?? group[0].name}</Link>
                      <span className="text-muted"> · <span>Lot number</span> <span className="font-mono text-xs">{group[0].lotNumber}</span> · <span>{group[0].location?.name ?? "Unassigned"}</span></span>
                    </p>
                    <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
                      {group.map((lot) => <Link key={lot.id} href={`/inventory/${lot.id}`} className="text-moss hover:underline"><QuantityText quantity={lot.currentQuantity} unit={lot.unit} recorded={lot.quantityRecorded} /></Link>)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 md:justify-end"><NotDuplicateButton ids={group.map((lot) => lot.id)} /></div>
                </li>
              ))}
            </ul>
          ) : <p className="px-4 py-3 text-sm text-muted">No lots look registered twice.</p>}
        </Panel>

        <p className="text-xs text-muted">Nothing here is merged automatically. Lots are never merged: open one to correct, archive or delete it.</p>
      </div>
    </AppShell>
  );
}
