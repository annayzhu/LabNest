import Link from "next/link";
import { cn } from "@/lib/cn";

const sections = [
  { key: "samples", href: "/samples", label: "Samples" },
  { key: "boxes", href: "/samples/boxes", label: "Boxes" },
  { key: "types", href: "/samples/types", label: "Types" },
] as const;

/** The samples module's pages, one row under the page title (the same pattern as inventory's). */
export function SampleNav({ current }: { current: (typeof sections)[number]["key"] }) {
  return (
    <nav aria-label="Sample sections" className="flex gap-5 overflow-x-auto border-b border-hairline">
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
