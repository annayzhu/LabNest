import { AppShell } from "@/components/AppShell";
import { InventoryLocationManager } from "@/components/InventoryLocationManager";
import { InventoryNav } from "@/components/InventoryNav";
import { PageHeader } from "@/components/PageHeader";
import { prisma } from "@/lib/db";
import { locationPaths } from "@/lib/inventory-location-lifecycle";

export const dynamic = "force-dynamic";

export default async function InventoryLocationsPage() {
  const locations = await prisma.inventoryLocation.findMany({
    include: {
      _count: { select: { items: true, itemsFrom: true, itemsTo: true, samples: true, childLocations: true } },
    },
  });
  const paths = locationPaths(locations);

  return (
    <AppShell>
      <div className="space-y-4">
        <PageHeader title="Inventory" />
        <InventoryNav current="locations" />
        <InventoryLocationManager
          // Sorted by path, so the shelves of a fridge follow the fridge.
          locations={locations.sort((a, b) => Number(a.status !== "active") - Number(b.status !== "active") || (paths.get(a.id) ?? "").localeCompare(paths.get(b.id) ?? "")).map((location) => ({
            id: location.id,
            name: location.name,
            type: location.type,
            status: location.status,
            parentLocationId: location.parentLocationId,
            path: paths.get(location.id) ?? location.name,
            temperature: location.temperature,
            description: location.description,
            counts: location._count,
          }))}
        />
      </div>
    </AppShell>
  );
}
