import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeftRight } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { QuantityText, Row, SideSection } from "@/components/InventoryDetail";
import { InventoryNav } from "@/components/InventoryNav";
import { PageHeader } from "@/components/PageHeader";
import { ProductMergeForm } from "@/components/ProductMergeForm";
import { formInlineInputClass } from "@/components/forms";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { prisma } from "@/lib/db";
import { firstSearchParam, type PageSearchParams } from "@/lib/filters";
import { controlLevelName, isStrictlyControlled } from "@/lib/inventory";
import { mergeProductPlan } from "@/lib/inventory-duplicates";
import { inventoryGroupName } from "@/lib/inventory-types";

export const dynamic = "force-dynamic";

const summary = { type: { select: { label: true } }, group: true, _count: { select: { items: true, kitComponents: true } } } as const;
const findProduct = (id: string) => prisma.inventoryProduct.findUnique({ where: { id }, include: summary });
type Summary = NonNullable<Awaited<ReturnType<typeof findProduct>>>;
const safetyStock = (product: Summary) => ({ quantity: product.lowThreshold ?? 0, unit: product.lowThresholdUnit });

/** Two products side by side before one is merged into the other; without a second product, choose it first. */
export default async function MergeProductsPage({ searchParams }: { searchParams?: PageSearchParams }) {
  const params = searchParams ? await searchParams : undefined;
  const keepId = firstSearchParam(params, "keep");
  const otherId = firstSearchParam(params, "other");
  const keep = keepId ? await findProduct(keepId) : null;
  if (!keep) notFound();
  const other = otherId && otherId !== keep.id ? await findProduct(otherId) : null;
  const documents = new Map((await prisma.attachmentLink.groupBy({ by: ["targetId"], where: { targetType: "inventory_product", targetId: { in: [keep.id, ...(other ? [other.id] : [])] } }, _count: { _all: true } })).map((row) => [row.targetId, row._count._all]));
  const candidates = other ? [] : await prisma.inventoryProduct.findMany({ where: { id: { not: keep.id } }, select: { id: true, name: true, brand: true, catalogNumber: true }, orderBy: { name: "asc" } });
  const plan = other ? mergeProductPlan(keep, other) : null;

  const card = (product: Summary, title: string) => (
    <section aria-label={title} className="divide-y divide-hairline rounded-[var(--ln-radius-panel)] border border-hairline bg-surface">
      <div className="px-4 py-3">
        <p className="text-xs text-muted">{title}</p>
        <Link href={`/inventory/products/${product.id}`} className="mt-1 block font-semibold text-ink hover:text-moss">{product.name}</Link>
      </div>
      <SideSection title="Product">
        <Row label="Brand" value={product.brand} />
        <Row label="Catalog" value={product.catalogNumber} mono />
        <Row label="CAS" value={product.casNumber} mono />
        <Row label="Type" value={product.type?.label ?? (product.group ? "Not subdivided" : "To be classified")} />
        {product.group ? <Row label="Inventory group" value={inventoryGroupName(product.group)} /> : null}
        <Row label="Safety stock" value={product.lowThreshold != null ? <QuantityText quantity={product.lowThreshold} unit={product.lowThresholdUnit} /> : null} />
        {product.controlLevels.length ? <div className="flex flex-wrap gap-1.5 pt-1">{product.controlLevels.map((level) => <Badge key={level} tone={isStrictlyControlled([level]) ? "danger" : "warning"}>{controlLevelName(level)}</Badge>)}</div> : null}
      </SideSection>
      <SideSection title="Moves with it">
        <Row label="Lots" value={String(product._count.items)} />
        <Row label="Documents" value={String(documents.get(product.id) ?? 0)} />
        <Row label="Kit components" value={String(product._count.kitComponents)} />
      </SideSection>
    </section>
  );

  return (
    <AppShell>
      <div className="space-y-4">
        <PageHeader title="Merge products" />
        <InventoryNav current="products" />
        {other && plan ? <>
          <div className="grid items-start gap-4 md:grid-cols-2">
            {card(keep, "Keep")}
            {card(other, "Merge into it, then remove")}
          </div>
          <div className="flex justify-end">
            <Link href={`/inventory/products/merge?keep=${other.id}&other=${keep.id}`} className="inline-flex items-center gap-1.5 text-sm text-moss hover:underline"><ArrowLeftRight className="h-4 w-4" aria-hidden />Keep the other one instead</Link>
          </div>
          <ProductMergeForm keepId={keep.id} otherId={other.id} safetyStocks={plan.needsSafetyStockChoice ? { keep: safetyStock(keep), other: safetyStock(other) } : null} />
        </> : <>
          <div className="grid items-start gap-4 md:grid-cols-2">{card(keep, "Keep")}</div>
          <form method="get" className="flex flex-wrap items-center gap-2 rounded-[var(--ln-radius-panel)] border border-hairline bg-surface px-4 py-3">
            <input type="hidden" name="keep" value={keep.id} />
            <label className="text-sm text-graphite" htmlFor="merge-other">Merge into it</label>
            <select id="merge-other" name="other" required defaultValue="" className={`${formInlineInputClass} h-9 w-auto max-w-full`}>
              <option value="" disabled>Choose a product…</option>
              {candidates.map((product) => <option key={product.id} value={product.id}>{[product.name, product.brand, product.catalogNumber].filter(Boolean).join(" · ")}</option>)}
            </select>
            <Button type="submit" size="sm">Compare</Button>
          </form>
        </>}
      </div>
    </AppShell>
  );
}
