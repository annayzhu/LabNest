import Link from "next/link";
import { Boxes, House, MapPin, Package, Tags } from "lucide-react";
import { cn } from "@/lib/cn";
import { prisma } from "@/lib/db";

const sections = [
  { key: "home", href: "/inventory", label: "Inventory home", icon: House },
  { key: "list", href: "/inventory/list", label: "Stock list", icon: Boxes },
  { key: "products", href: "/inventory/products", label: "Products", icon: Package },
  { key: "types", href: "/inventory/types", label: "Types", icon: Tags },
  { key: "locations", href: "/inventory/locations", label: "Storage locations", icon: MapPin },
] as const;

/** A tab in a row of inventory tabs: the selected one has a moss label, an underline and a low tint. */
export const inventoryTabClass = (active: boolean) => cn(
  "focus-ring -mb-px inline-flex h-10 shrink-0 items-center gap-2 border-b-2 px-3 text-sm font-medium transition-colors",
  active ? "border-moss bg-sage-surface/60 text-moss" : "border-transparent text-graphite hover:bg-warm hover:text-ink",
);

/**
 * The inventory pages, one row under the page title, each with how many records it lists. Detail pages show it too,
 * with the page they belong to selected (Q179).
 */
export async function InventoryNav({ current }: { current: (typeof sections)[number]["key"] }) {
  const [list, products, types, locations] = await Promise.all([
    prisma.inventoryItem.count(),
    prisma.inventoryProduct.count(),
    prisma.scientificSchemaDefinition.count({ where: { inventoryGroupKey: { not: null } } }),
    prisma.inventoryLocation.count(),
  ]);
  const counts: Record<string, number> = { list, products, types, locations };
  return (
    <nav aria-label="Inventory sections" className="editorial-scrollbar flex gap-1 overflow-x-auto border-b border-hairline">
      {sections.map(({ key, href, label, icon: Icon }) => {
        const active = key === current;
        return (
          <Link
            key={key}
            href={href}
            aria-current={active ? "page" : undefined}
            className={inventoryTabClass(active)}
          >
            <Icon className="h-4 w-4" aria-hidden />
            <span>{label}</span>
            {counts[key] !== undefined ? <span className={cn("rounded-full px-1.5 text-xs font-semibold leading-5 tabular-nums", active ? "bg-surface text-moss" : "bg-stone text-muted")}>{counts[key]}</span> : null}
          </Link>
        );
      })}
    </nav>
  );
}
