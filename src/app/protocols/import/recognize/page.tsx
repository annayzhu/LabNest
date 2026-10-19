import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { RecognitionWorkspace } from "@/components/RecognitionWorkspace";
import { buttonStyles } from "@/components/ui/Button";

export const dynamic = "force-dynamic";

/** 整理说明书或非模板规程: a vendor manual, a PDF or a Protocol not written to the template, made into a draft Protocol. */
export default function RecognizeProtocolPage() {
  return <AppShell>
    <div className="space-y-5">
      <PageHeader eyebrow="Protocols" title="Organize instructions or a non-template Protocol" actions={<Link href="/protocols/import" className={buttonStyles({ size: "md", className: "bg-surface font-medium text-moss hover:bg-warm" })}><ArrowLeft className="h-4 w-4" aria-hidden />Back to import</Link>} />
      <RecognitionWorkspace />
    </div>
  </AppShell>;
}
