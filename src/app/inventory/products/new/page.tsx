import { AppShell } from "@/components/AppShell";
import { InventoryProductForm } from "@/components/InventoryProductForm";
import { PageHeader } from "@/components/PageHeader";
import { prisma } from "@/lib/db";
import { inventoryFormOptions } from "@/lib/inventory-products.server";
import { createInventoryProduct } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewInventoryProductPage() {
  const [options, entities] = await Promise.all([
    inventoryFormOptions(prisma),
    prisma.entity.findMany({ where: { status: "active" }, select: { id: true, name: true, type: true, code: true }, orderBy: [{ type: "asc" }, { name: "asc" }] }),
  ]);
  return (
    <AppShell>
      <div className="mx-auto max-w-5xl space-y-4">
        <PageHeader title="New product" />
        <InventoryProductForm action={createInventoryProduct} types={options.types} groups={options.groups} entities={entities} />
      </div>
    </AppShell>
  );
}
