import { AppShell } from "@/components/AppShell";
import { InventoryLocationManager } from "@/components/InventoryLocationManager";
import { InventoryNav } from "@/components/InventoryNav";
import { PageHeader } from "@/components/PageHeader";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function InventoryLocationsPage() {
  const locations = await prisma.inventoryLocation.findMany({
    include: {
      parentLocation: { select: { name: true } },
      _count: { select: { items: true, itemsFrom: true, itemsTo: true, samples: true, childLocations: true } },
    },
    orderBy: [{ status: "asc" }, { name: "asc" }],
  });

  return (
    <AppShell>
      <div className="space-y-4">
        <PageHeader title="Inventory" />
        <InventoryNav current="locations" />
        <InventoryLocationManager
          locations={locations.map((location) => ({
            id: location.id,
            name: location.name,
            type: location.type,
            status: location.status,
            parentLocationId: location.parentLocationId,
            parentLocationName: location.parentLocation?.name ?? null,
            temperature: location.temperature,
            description: location.description,
            counts: location._count,
          }))}
        />
      </div>
    </AppShell>
  );
}
