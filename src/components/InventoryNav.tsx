import Link from "next/link";
import { cn } from "@/lib/cn";

const sections = [
  { key: "stock", href: "/inventory", label: "Stock" },
  { key: "products", href: "/inventory/products", label: "Products" },
  { key: "types", href: "/inventory/types", label: "Types" },
  { key: "locations", href: "/inventory/locations", label: "Storage locations" },
] as const;

/** The inventory module's four pages, one row under the page title. */
export function InventoryNav({ current }: { current: (typeof sections)[number]["key"] }) {
  return (
    <nav aria-label="Inventory sections" className="flex gap-5 overflow-x-auto border-b border-hairline">
      {sections.map((section) => (
        <Link
          key={section.key}
          href={section.href}
          aria-current={section.key === current ? "page" : undefined}
          className={cn(
            "focus-ring -mb-px shrink-0 border-b-2 pb-2 pt-1 text-[13px] font-medium transition-colors",
            section.key === current ? "border-moss text-moss" : "border-transparent text-muted hover:text-ink",
          )}
        >
          {section.label}
        </Link>
      ))}
    </nav>
  );
}
