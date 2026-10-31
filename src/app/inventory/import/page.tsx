import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { InventoryDocumentImport } from "@/components/InventoryDocumentImport";
import { PageHeader } from "@/components/PageHeader";
import { SequenceProductImport } from "@/components/SequenceProductImport";
import { StructuredImportWorkspace } from "@/components/StructuredImportWorkspace";
import { readAISettings } from "@/lib/ai-settings";
import { cn } from "@/lib/cn";
import { prisma } from "@/lib/db";
import { firstSearchParam, type PageSearchParams } from "@/lib/filters";

export const dynamic = "force-dynamic";

const sources = [
  { key: "table", label: "Spreadsheet" },
  { key: "documents", label: "Invoice, delivery note or label" },
  { key: "text", label: "Pasted text" },
  { key: "sequences", label: "Sequences" },
] as const;

/** One place to bring stock in: a spreadsheet, documents read by AI, or pasted text; all end in the inventory import. */
export default async function InventoryImportPage({ searchParams }: { searchParams?: PageSearchParams }) {
  const requested = firstSearchParam(searchParams ? await searchParams : undefined, "source");
  const source = sources.find((entry) => entry.key === requested)?.key ?? "table";
  const [{ availability: text, vision: pictures }, locations] = await Promise.all([
    readAISettings(),
    prisma.inventoryLocation.findMany({ where: { status: "active" }, select: { name: true }, orderBy: { name: "asc" } }),
  ]);

  return (
    <AppShell>
      <div className="space-y-4">
        <PageHeader title="Import Inventory" />
        <nav aria-label="Import source" className="flex gap-5 overflow-x-auto border-b border-hairline">
          {sources.map((entry) => (
            <Link key={entry.key} href={`/inventory/import?source=${entry.key}`} aria-current={entry.key === source ? "page" : undefined}
              className={cn("focus-ring -mb-px shrink-0 border-b-2 pb-2 pt-1 text-[13px] font-medium transition-colors", entry.key === source ? "border-moss text-moss" : "border-transparent text-muted hover:text-ink")}>
              {entry.label}
            </Link>
          ))}
        </nav>
        {source === "table"
          ? <StructuredImportWorkspace module="inventory" columnHelper={{ ready: text.connected, reason: text.reason }} />
          : source === "sequences" ? <SequenceProductImport />
          : <InventoryDocumentImport source={source} pictures={{ ready: pictures.ready, reason: pictures.reason }} text={{ ready: text.connected, reason: text.reason }} locations={locations.map((location) => location.name)} />}
      </div>
    </AppShell>
  );
}
