import { ClipboardPaste, Dna, ReceiptText, Sheet } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { InventoryDocumentImport } from "@/components/InventoryDocumentImport";
import { PageHeader } from "@/components/PageHeader";
import { SectionTabs } from "@/components/SectionTabs";
import { SequenceProductImport } from "@/components/SequenceProductImport";
import { StructuredImportWorkspace } from "@/components/StructuredImportWorkspace";
import { readAISettings } from "@/lib/ai-settings";
import { prisma } from "@/lib/db";
import { firstSearchParam, type PageSearchParams } from "@/lib/filters";

export const dynamic = "force-dynamic";

// Each source is a tab like the inventory sections above it, with a line under the row saying what it takes (Q197).
const sources = [
  { key: "table", label: "Spreadsheet", icon: Sheet, help: "An Excel or CSV sheet, one lot per row. Download the template, or let AI match your columns." },
  { key: "documents", label: "Invoices, delivery notes, labels", icon: ReceiptText, help: "Photos or PDFs of invoices, delivery notes or labels. AI reads a draft; you check every line before anything is imported." },
  { key: "text", label: "Paste text", icon: ClipboardPaste, help: "Text from an order, invoice or email. AI reads a draft; you check every line before anything is imported." },
  { key: "sequences", label: "Sequences", icon: Dna, help: "Primer pairs, siRNA duplexes or single sequences, pasted from a sheet or read from FASTA. Each becomes a product." },
] as const;

/** One place to bring stock in: a spreadsheet, documents read by AI, or pasted text; all end in the inventory import. */
export default async function InventoryImportPage({ searchParams }: { searchParams?: PageSearchParams }) {
  const requested = firstSearchParam(searchParams ? await searchParams : undefined, "source");
  const source = sources.find((entry) => entry.key === requested) ?? sources[0];
  const [{ availability: text, vision: pictures }, locations] = await Promise.all([
    readAISettings(),
    prisma.inventoryLocation.findMany({ where: { status: "active" }, select: { name: true }, orderBy: { name: "asc" } }),
  ]);

  return (
    <AppShell>
      <div className="space-y-4">
        <PageHeader title="Import Inventory" />
        <div className="space-y-2">
          <SectionTabs name="Import source" current={source.key} tabs={sources.map(({ key, label, icon }) => ({ key, href: `/inventory/import?source=${key}`, label, icon }))} />
          <p className="text-sm text-graphite">{source.help}</p>
        </div>
        {source.key === "table"
          ? <StructuredImportWorkspace module="inventory" columnHelper={{ ready: text.connected, reason: text.reason }} />
          : source.key === "sequences" ? <SequenceProductImport />
          : <InventoryDocumentImport source={source.key} pictures={{ ready: pictures.ready, reason: pictures.reason }} text={{ ready: text.connected, reason: text.reason }} locations={locations.map((location) => location.name)} />}
      </div>
    </AppShell>
  );
}
