import Link from "next/link";
import { Grid3x3, Tags, TestTube2, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import { prisma } from "@/lib/db";

const sections = [
  { key: "samples", href: "/samples", label: "Samples", icon: TestTube2 },
  { key: "boxes", href: "/samples/boxes", label: "Boxes", icon: Grid3x3 },
  { key: "types", href: "/samples/types", label: "Types", icon: Tags },
] as const satisfies readonly { key: string; href: string; label: string; icon: LucideIcon }[];

/**
 * The samples pages, one row under the page title, each with how many records it lists; the same tab bar as inventory's.
 * Detail pages show it too, with the page they belong to selected.
 */
export async function SampleNav({ current }: { current: (typeof sections)[number]["key"] }) {
  const [samples, boxes, types] = await Promise.all([
    prisma.sample.count(),
    prisma.inventoryLocation.count({ where: { status: "active" } }),
    prisma.scientificSchemaDefinition.count({ where: { objectKind: "sample" } }),
  ]);
  const counts = { samples, boxes, types };
  return (
    <nav aria-label="Sample sections" className="editorial-scrollbar flex gap-1 overflow-x-auto border-b border-hairline">
      {sections.map(({ key, href, label, icon: Icon }) => {
        const active = key === current;
        return (
          <Link
            key={key}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "focus-ring -mb-px inline-flex h-10 shrink-0 items-center gap-2 border-b-2 px-3 text-sm font-medium transition-colors",
              active ? "border-moss bg-sage-surface/60 text-moss" : "border-transparent text-graphite hover:bg-warm hover:text-ink",
            )}
          >
            <Icon className="h-4 w-4" aria-hidden />
            <span>{label}</span>
            <span className={cn("rounded-full px-1.5 text-xs font-semibold leading-5 tabular-nums", active ? "bg-surface text-moss" : "bg-stone text-muted")}>{counts[key]}</span>
          </Link>
        );
      })}
    </nav>
  );
}
