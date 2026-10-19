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
      <PageHeader eyebrow="实验规程" title="整理说明书或非模板规程" actions={<Link href="/protocols/import" className={buttonStyles({ size: "md", className: "bg-surface font-medium text-moss hover:bg-warm" })}><ArrowLeft className="h-4 w-4" aria-hidden />返回导入</Link>} />
      <RecognitionWorkspace />
    </div>
  </AppShell>;
}
