import { notFound } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { InventoryItemForm } from "@/components/InventoryItemForm";
import { PageHeader } from "@/components/PageHeader";
import { prisma } from "@/lib/db";
import { inventoryFormOptions, stockFormLocations } from "@/lib/inventory-products.server";
import { updateInventoryItem } from "../../actions";

export const dynamic = "force-dynamic";

export default async function EditInventoryItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [item, locations, options] = await Promise.all([
    prisma.inventoryItem.findUnique({ where: { id } }),
    stockFormLocations(prisma),
    inventoryFormOptions(prisma),
  ]);
  if (!item) notFound();

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl space-y-4">
        <PageHeader identifier={item.lotNumber ? `Lot ${item.lotNumber}` : undefined} title={item.name} />
        <InventoryItemForm action={updateInventoryItem} locations={locations.filter((location) => location.status === "active" || location.id === item.locationId)} {...options} initial={item} />
      </div>
    </AppShell>
  );
}
