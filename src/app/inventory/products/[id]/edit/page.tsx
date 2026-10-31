import { notFound } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { InventoryProductForm } from "@/components/InventoryProductForm";
import { PageHeader } from "@/components/PageHeader";
import { prisma } from "@/lib/db";
import { inventoryFormOptions } from "@/lib/inventory-products.server";
import { readProductSequences } from "@/lib/product-sequences.server";
import { updateInventoryProduct } from "../../actions";

export const dynamic = "force-dynamic";

export default async function EditInventoryProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [product, options, entities] = await Promise.all([
    prisma.inventoryProduct.findUnique({ where: { id }, include: { type: { select: { key: true } } } }),
    inventoryFormOptions(prisma),
    prisma.entity.findMany({ where: { OR: [{ status: "active" }, { inventoryProducts: { some: { id } } }] }, select: { id: true, name: true, type: true, code: true }, orderBy: [{ type: "asc" }, { name: "asc" }] }),
  ]);
  if (!product) notFound();
  const sequences = await readProductSequences(prisma, product.entityId, product.type?.key);
  return (
    <AppShell>
      <div className="mx-auto max-w-5xl space-y-4">
        <PageHeader identifier={[product.brand, product.catalogNumber].filter(Boolean).join(" · ") || undefined} title={product.name} />
        <InventoryProductForm action={updateInventoryProduct} types={options.types} groups={options.groups} entities={entities} initial={{ ...product, fieldValues: product.fieldValues as Record<string, string>, sequences: Object.fromEntries(sequences.map((strand) => [strand.role, strand.sequence])) }} />
      </div>
    </AppShell>
  );
}
