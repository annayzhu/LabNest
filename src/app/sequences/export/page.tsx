import Link from "next/link";
import { ArrowLeft, FileSpreadsheet, FileText } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { firstSearchParam, type PageSearchParams } from "@/lib/filters";

export default async function SequenceExportPage({ searchParams }: { searchParams: PageSearchParams }) {
  const params = await searchParams;
  const scope = firstSearchParam(params, "exportScope") ?? "filtered";
  const selectedCount = Array.isArray(params.id) ? params.id.length : params.id ? 1 : 0;
  const base = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) value.forEach((item) => base.append(key, item));
    else if (value) base.set(key, value);
  }
  const exportHref = (format: "csv" | "fasta", versions: "latest" | "all") => {
    const next = new URLSearchParams(base);
    next.set("format", format);
    next.set("versions", versions);
    return `/api/sequences/export?${next.toString()}`;
  };
  const scopeLabel = scope === "selected" ? `${selectedCount} selected ${selectedCount === 1 ? "Sequence" : "Sequences"}` : scope === "all" ? "all registered Sequences" : "the current filtered Sequence view";

  return (
    <AppShell>
      <div className="space-y-4">
        <PageHeader title="Export Sequences" actions={<Link href="/sequences" className="focus-ring inline-flex h-9 items-center gap-2 rounded-[7px] border border-hairline px-3 text-[13px] text-moss"><ArrowLeft className="h-4 w-4" aria-hidden />Sequences</Link>} />
        <Card>
          <CardHeader title="Export scope" />
          <CardBody><p className="text-sm text-graphite">This export includes {scopeLabel}. Choose whether to export only the latest version or the complete immutable version history.</p></CardBody>
        </Card>
        <div className="grid gap-4 md:grid-cols-2">
          <Card><CardHeader title="Structured CSV" /><CardBody className="space-y-3"><p className="text-sm text-muted">Includes identity, status, validation, exact sequence, checksum, Features, and modifications.</p><div className="flex flex-wrap gap-2"><Link href={exportHref("csv", "latest")} className={exportButtonClass}><FileSpreadsheet className="h-4 w-4" aria-hidden />Latest versions</Link><Link href={exportHref("csv", "all")} className={exportButtonClass}><FileSpreadsheet className="h-4 w-4" aria-hidden />All versions</Link></div></CardBody></Card>
          <Card><CardHeader title="FASTA" /><CardBody className="space-y-3"><p className="text-sm text-muted">Canonical sequence content with code, record name, version, and molecule type in each header.</p><div className="flex flex-wrap gap-2"><Link href={exportHref("fasta", "latest")} className={exportButtonClass}><FileText className="h-4 w-4" aria-hidden />Latest versions</Link><Link href={exportHref("fasta", "all")} className={exportButtonClass}><FileText className="h-4 w-4" aria-hidden />All versions</Link></div></CardBody></Card>
        </div>
      </div>
    </AppShell>
  );
}

const exportButtonClass = "focus-ring inline-flex h-9 items-center gap-2 rounded-[7px] border border-moss bg-moss px-3 text-[13px] font-medium text-warm";
