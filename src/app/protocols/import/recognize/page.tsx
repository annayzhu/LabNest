import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { RecognitionWorkspace } from "@/components/RecognitionWorkspace";
import { buttonStyles } from "@/components/ui/Button";
import { firstSearchParam, type PageSearchParams } from "@/lib/filters";
import { prisma } from "@/lib/db";
import { readProductSearchSettings } from "@/lib/product-manuals.server";
import { recognitionWarning } from "@/lib/recognition-fit";

export const dynamic = "force-dynamic";

/** 整理说明书或非模板规程: a vendor manual, a PDF or a Protocol not written to the template, made into a draft Protocol. */
export default async function RecognizeProtocolPage({ searchParams }: { searchParams?: PageSearchParams }) {
  const manualSettings = await readProductSearchSettings();
  // The default service organizes the manual; one below the evaluation's bar is named before anything is sent (Q299).
  const service = await prisma.aISettings.findUnique({ where: { id: "default" }, select: { enabled: true, defaultProvider: { select: { name: true, type: true } } } });
  const warning = service?.enabled ? recognitionWarning(service.defaultProvider?.type) : undefined;
  // A product page's kit manual opens here already searched.
  const manualQuery = firstSearchParam(searchParams ? await searchParams : undefined, "manual")?.trim().slice(0, 120);
  return <AppShell>
    <div className="space-y-5">
      <PageHeader eyebrow="Protocols" title="Organize instructions or a non-template Protocol" actions={<Link href="/protocols/import" className={buttonStyles({ size: "md", className: "bg-surface font-medium text-moss hover:bg-warm" })}><ArrowLeft className="h-4 w-4" aria-hidden />Back to import</Link>} />
      {warning ? <p role="note" className="rounded-[var(--ln-radius-control-lg)] border border-warning/30 bg-warning-surface px-3 py-2 text-sm leading-6 text-warning">
        <span data-i18n-ignore>{service?.defaultProvider?.name}</span><span>: not recommended for organizing manuals.</span> <span>{warning}</span> <Link href="/ai#default-provider" className="focus-ring font-medium underline">Choose another default service</Link>
      </p> : null}
      <RecognitionWorkspace manualSettings={manualSettings} manualQuery={manualQuery} />
    </div>
  </AppShell>;
}
