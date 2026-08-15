import { AppShell } from "@/components/AppShell";
import { InventoryItemForm } from "@/components/InventoryItemForm";
import { PageHeader } from "@/components/PageHeader";
import { prisma } from "@/lib/db";
import { createInventoryItem } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewInventoryItemPage() {
  const [locations, entities] = await Promise.all([
    prisma.inventoryLocation.findMany({ where: { status: "active" }, select: { id: true, name: true, temperature: true, status: true }, orderBy: { name: "asc" } }),
    prisma.entity.findMany({ where: { status: "active" }, select: { id: true, name: true, type: true, code: true }, orderBy: [{ type: "asc" }, { name: "asc" }] }),
  ]);

  return (
    <AppShell>
      <div className="space-y-5">
        <PageHeader title="Register Inventory Item" />
        <InventoryItemForm action={createInventoryItem} locations={locations} entities={entities} />
      </div>
    </AppShell>
  );
}
