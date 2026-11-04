import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { ModalDialogProvider } from "@/components/ui/ModalDialogProvider";
import { PlasmidWorkbench } from "@/components/plasmid/PlasmidWorkbench";
import { buttonStyles } from "@/components/ui/Button";
import { firstSearchParam, type PageSearchParams } from "@/lib/filters";
import { listLibraryEntries } from "@/lib/plasmid/library.server";
import { listPlasmidProducts, listSequencingFolders, loadPlasmidProduct } from "@/lib/plasmid/store.server";
import { loadExpectedStructure } from "@/lib/plasmid/structure.server";

export const dynamic = "force-dynamic";

/** 质粒工作台 (Q271): files open in the browser and are saved only on request. */
export default async function PlasmidWorkbenchPage({ searchParams }: { searchParams: PageSearchParams }) {
  const query = await searchParams;
  const productId = firstSearchParam(query, "product");
  const embedded = firstSearchParam(query, "embed") === "record";
  const [opened, plasmids, folders, library, structure] = await Promise.all([
    productId ? loadPlasmidProduct(productId) : null,
    listPlasmidProducts(),
    listSequencingFolders(),
    listLibraryEntries(),
    productId ? loadExpectedStructure(productId) : [],
  ]);
  const initial = opened?.version
    ? { record: opened.version.record, label: `${opened.version.label} · From inventory`, productId: opened.product.id, versionId: opened.version.id, completeness: opened.version.completeness, completenessSource: opened.version.completenessSource, structure }
    : undefined;
  // Inside a record's workspace, whose header already says where you are and how to go back.
  if (embedded) return <ModalDialogProvider><main className="min-h-dvh bg-surface p-3"><PlasmidWorkbench key={opened?.version?.id ?? "files"} embedded initial={initial} plasmids={plasmids} folders={folders} library={library} /></main></ModalDialogProvider>;
  return (
    <AppShell>
      <div className="space-y-4">
        <PageHeader
          title="Plasmid workbench"
          actions={opened ? <Link href={`/inventory/products/${opened.product.id}`} className={buttonStyles({ size: "md", variant: "secondary" })}><ArrowLeft className="h-4 w-4" aria-hidden />Back to the plasmid</Link> : undefined}
        />
        <PlasmidWorkbench key={opened?.version?.id ?? "files"} initial={initial} plasmids={plasmids} folders={folders} library={library} />
      </div>
    </AppShell>
  );
}
