import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { InventoryLocationManager } from "@/components/InventoryLocationManager";
import { PageHeader } from "@/components/PageHeader";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

const actionLinkClass = "focus-ring inline-flex h-9 items-center gap-2 rounded-[var(--ln-radius-control-md)] border border-hairline bg-surface px-3 text-[13px] font-medium text-moss hover:bg-warm";

export default async function InventoryLocationsPage() {
  const locations = await prisma.inventoryLocation.findMany({
    include: {
      parentLocation: { select: { name: true } },
      _count: { select: { items: true, itemsFrom: true, itemsTo: true, sampleEventsFrom: true, sampleEventsTo: true, childLocations: true } },
    },
    orderBy: [{ status: "asc" }, { name: "asc" }],
  });

  return (
    <AppShell>
      <div className="space-y-5">
        <PageHeader
          eyebrow="Inventory configuration"
          title="Inventory locations"
          description="Create and rename storage locations. Archive referenced locations to preserve the movement ledger; only completely unused locations can be permanently deleted."
          actions={<Link href="/inventory" className={actionLinkClass}><ArrowLeft className="h-4 w-4" />Inventory</Link>}
        />
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
