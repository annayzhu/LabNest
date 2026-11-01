import { Boxes, House, MapPin, Package, Tags } from "lucide-react";
import { SectionTabs } from "@/components/SectionTabs";
import { prisma } from "@/lib/db";

const sections = [
  { key: "home", href: "/inventory", label: "Inventory home", icon: House },
  { key: "list", href: "/inventory/list", label: "Stock list", icon: Boxes },
  { key: "products", href: "/inventory/products", label: "Products", icon: Package },
  { key: "types", href: "/inventory/types", label: "Types", icon: Tags },
  { key: "locations", href: "/inventory/locations", label: "Storage locations", icon: MapPin },
] as const;

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
  return <SectionTabs name="Inventory sections" current={current} tabs={sections.map((section) => ({ ...section, count: counts[section.key] }))} />;
}
