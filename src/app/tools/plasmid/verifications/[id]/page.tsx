import { notFound } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { VerificationReport } from "@/components/plasmid/VerificationReport";
import { loadVerification } from "@/lib/plasmid/verification.server";

export const dynamic = "force-dynamic";

/** 核查记录与报告 (C1, C2): one check, gone through item by item, confirmed, and printed as its report. */
export default async function PlasmidVerificationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const record = await loadVerification(id);
  if (!record) notFound();
  const { sequenceVersion, ...rest } = record;
  return (
    <AppShell>
      <VerificationReport record={{ ...rest, version: { id: sequenceVersion.id, label: `v${sequenceVersion.displayVersion}`, length: sequenceVersion.sequence.length, topology: sequenceVersion.topology } }} />
    </AppShell>
  );
}
