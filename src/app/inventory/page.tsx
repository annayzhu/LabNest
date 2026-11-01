import Link from "next/link";
import { redirect } from "next/navigation";
import { FileUp, Plus } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { collectionPrimaryActionClass, collectionSecondaryActionClass } from "@/components/CollectionToolbar";
import { InventoryReturnPoint } from "@/components/InventoryBackLink";
import { InventoryCategories } from "@/components/InventoryCategories";
import { InventoryHome } from "@/components/InventoryHome";
import { InventoryInUse } from "@/components/InventoryInUse";
import { InventoryNav } from "@/components/InventoryNav";
import { PageHeader } from "@/components/PageHeader";
import { prisma } from "@/lib/db";
import { firstSearchParam, type PageSearchParams } from "@/lib/filters";
import { heldContainers, inventoryAlerts, inventoryCategories } from "@/lib/inventory-home.server";
import { stockFormLocations } from "@/lib/inventory-products.server";
import { findStock } from "@/lib/inventory-search.server";

export const dynamic = "force-dynamic";

// The stock list's filters, which links and bookmarks from before the home page put on /inventory.
const listFilters = ["q", "status", "location", "group", "type", "pi", "flag", "sort"];

/** The inventory home: find something and act on it, see what needs attention and what is out, browse by category (Q179–Q184, Q196). */
export default async function InventoryHomePage({ searchParams }: { searchParams?: PageSearchParams }) {
  const params = searchParams ? await searchParams : undefined;
  const kept = new URLSearchParams(listFilters.flatMap((key) => {
    const value = firstSearchParam(params, key);
    return value ? [[key, value]] : [];
  }));
  if (kept.size) redirect(`/inventory/list?${kept}`);

  const [recent, alerts, categories, locations, held] = await Promise.all([findStock(""), inventoryAlerts(), inventoryCategories(), stockFormLocations(prisma), heldContainers()]);
  const places = locations.filter((location) => location.status === "active").map((location) => location.name);

  return (
    <AppShell>
      <div className="space-y-4">
        <PageHeader
          title="Inventory"
          actions={<>
            <Link href="/inventory/import" className={collectionSecondaryActionClass}><FileUp className="h-4 w-4" aria-hidden />Import</Link>
            <Link href="/inventory/new" className={collectionPrimaryActionClass}><Plus className="h-4 w-4" aria-hidden />Register stock</Link>
          </>}
        />
        <InventoryNav current="home" />
        <InventoryReturnPoint href="/inventory" label="Inventory home" />
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start">
          <div className="min-w-0 space-y-4">
            <InventoryHome initial={recent} alerts={alerts} places={places} />
            {held.length ? <InventoryInUse containers={held} placesList="inventory-home-places" /> : null}
          </div>
          <InventoryCategories {...categories} />
        </div>
      </div>
    </AppShell>
  );
}
