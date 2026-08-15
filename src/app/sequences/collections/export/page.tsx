import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";

export default function SequenceCollectionExportPage() {
  return (
    <AppShell>
      <div className="space-y-4">
        <PageHeader title="Export Sequence Collections" actions={<Link href="/sequences/collections" className="focus-ring inline-flex h-9 items-center gap-2 rounded-[7px] border border-hairline px-3 text-[13px] text-moss"><ArrowLeft className="h-4 w-4" aria-hidden />Sequence Collections</Link>} />
        <Card>
          <CardHeader title="Export status" />
          <CardBody>
            <p className="text-sm leading-6 text-graphite">Sequence collection export is not configured yet.</p>
            <p className="mt-2 text-sm text-muted">You can still use the selection controls above to run batch edit actions.</p>
          </CardBody>
        </Card>
      </div>
    </AppShell>
  );
}

