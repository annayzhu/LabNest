import { notFound } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { InventoryProductForm } from "@/components/InventoryProductForm";
import { PageHeader } from "@/components/PageHeader";
import { prisma } from "@/lib/db";
import { productFormStart } from "@/lib/inventory-product-form.server";
import { inventoryFormOptions } from "@/lib/inventory-products.server";
import { updateInventoryProduct } from "../../actions";

export const dynamic = "force-dynamic";

export default async function EditInventoryProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [start, options] = await Promise.all([productFormStart(prisma, id), inventoryFormOptions(prisma)]);
  if (!start) notFound();
  const { product } = start;
  return (
    <AppShell>
      <div className="mx-auto max-w-5xl space-y-4">
        <PageHeader identifier={[product.brand, product.catalogNumber].filter(Boolean).join(" · ") || undefined} title={product.name} />
        <InventoryProductForm action={updateInventoryProduct} types={options.types} groups={options.groups} entities={start.entities} initial={start.initial} />
      </div>
    </AppShell>
  );
}
