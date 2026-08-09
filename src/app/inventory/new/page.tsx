import { AppShell } from "@/components/AppShell";
import { InventoryItemForm } from "@/components/InventoryItemForm";
import { PageHeader } from "@/components/PageHeader";
import { prisma } from "@/lib/db";
import { createInventoryItem } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewInventoryItemPage() {
  const locations = await prisma.inventoryLocation.findMany({
    select: { id: true, name: true, temperature: true },
    orderBy: { name: "asc" },
  });

  return (
    <AppShell>
      <div className="space-y-5">
        <PageHeader title="Register Inventory Item" />
        <InventoryItemForm action={createInventoryItem} locations={locations} />
      </div>
    </AppShell>
  );
}
