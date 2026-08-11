import { notFound } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { InventoryItemForm } from "@/components/InventoryItemForm";
import { PageHeader } from "@/components/PageHeader";
import { prisma } from "@/lib/db";
import { updateInventoryItem } from "../../actions";

export const dynamic = "force-dynamic";

export default async function EditInventoryItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [item, locations] = await Promise.all([
    prisma.inventoryItem.findUnique({ where: { id } }),
    prisma.inventoryLocation.findMany({
      where: { OR: [{ status: "active" }, { items: { some: { id } } }] },
      select: { id: true, name: true, temperature: true, status: true },
      orderBy: { name: "asc" },
    }),
  ]);
  if (!item) notFound();

  return (
    <AppShell>
      <div className="space-y-5">
        <PageHeader title={`Edit ${item.name}`} />
        <InventoryItemForm action={updateInventoryItem} locations={locations} initial={item} />
      </div>
    </AppShell>
  );
}
