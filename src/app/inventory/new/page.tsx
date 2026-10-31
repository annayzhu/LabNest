import { AppShell } from "@/components/AppShell";
import { InventoryItemForm } from "@/components/InventoryItemForm";
import { PageHeader } from "@/components/PageHeader";
import { prisma } from "@/lib/db";
import { firstSearchParam, type PageSearchParams } from "@/lib/filters";
import { inventoryFormOptions } from "@/lib/inventory-products.server";
import { createInventoryItem } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewInventoryItemPage({ searchParams }: { searchParams?: PageSearchParams }) {
  const params = searchParams ? await searchParams : undefined;
  const [locations, options] = await Promise.all([
    prisma.inventoryLocation.findMany({ where: { status: "active" }, select: { id: true, name: true, temperature: true, status: true }, orderBy: { name: "asc" } }),
    inventoryFormOptions(prisma),
  ]);
  const productId = firstSearchParam(params, "product");

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl space-y-4">
        <PageHeader title="Register stock" />
        <InventoryItemForm action={createInventoryItem} locations={locations} {...options} initial={{ productId: options.products.some((product) => product.id === productId) ? productId : undefined }} />
      </div>
    </AppShell>
  );
}
