import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { PlasmidWorkbench } from "@/components/plasmid/PlasmidWorkbench";
import { buttonStyles } from "@/components/ui/Button";
import { firstSearchParam, type PageSearchParams } from "@/lib/filters";
import { listPlasmidProducts, listSequencingFolders, loadPlasmidProduct } from "@/lib/plasmid/store.server";

export const dynamic = "force-dynamic";

/** 质粒工作台 (Q271): files open in the browser and are saved only on request. */
export default async function PlasmidWorkbenchPage({ searchParams }: { searchParams: PageSearchParams }) {
  const productId = firstSearchParam(await searchParams, "product");
  const [opened, plasmids, folders] = await Promise.all([productId ? loadPlasmidProduct(productId) : null, listPlasmidProducts(), listSequencingFolders()]);
  const initial = opened?.version
    ? { record: opened.version.record, label: `${opened.version.label} · From inventory`, productId: opened.product.id, completeness: opened.version.completeness }
    : undefined;
  return (
    <AppShell>
      <div className="space-y-4">
        <PageHeader
          title="Plasmid workbench"
          actions={opened ? <Link href={`/inventory/products/${opened.product.id}`} className={buttonStyles({ size: "md", variant: "secondary" })}><ArrowLeft className="h-4 w-4" aria-hidden />Back to the plasmid</Link> : undefined}
        />
        <PlasmidWorkbench key={opened?.version?.id ?? "files"} initial={initial} plasmids={plasmids} folders={folders} />
      </div>
    </AppShell>
  );
}
