import { notFound } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { InventoryItemForm } from "@/components/InventoryItemForm";
import { PageHeader } from "@/components/PageHeader";
import { prisma } from "@/lib/db";
import { productFormStart } from "@/lib/inventory-product-form.server";
import { inventoryFormOptions, stockFormLocations } from "@/lib/inventory-products.server";
import { updateInventoryItem } from "../../actions";

export const dynamic = "force-dynamic";

/** A lot and its product edited on one page (Q192): the product's fields first, applying to all its lots, then this lot's. */
export default async function EditInventoryItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [item, locations, options] = await Promise.all([
    prisma.inventoryItem.findUnique({ where: { id } }),
    stockFormLocations(prisma),
    inventoryFormOptions(prisma),
  ]);
  if (!item) notFound();
  const start = item.productId ? await productFormStart(prisma, item.productId) : null;

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl space-y-4">
        <PageHeader identifier={item.lotNumber ? `Lot ${item.lotNumber}` : undefined} title={item.name} />
        <InventoryItemForm
          action={updateInventoryItem}
          locations={locations.filter((location) => location.status === "active" || location.id === item.locationId)}
          {...options}
          initial={item}
          product={start ? { initial: start.initial, entities: start.entities, lots: start.lots } : undefined}
        />
      </div>
    </AppShell>
  );
}
