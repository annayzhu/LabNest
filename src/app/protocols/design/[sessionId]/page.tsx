import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { MethodDesignWorkspace } from "@/components/MethodDesignWorkspace";
import { PageHeader } from "@/components/PageHeader";
import { buttonStyles } from "@/components/ui/Button";
import { prisma } from "@/lib/db";
import { loadDesignSession } from "@/lib/method-design.server";

export const dynamic = "force-dynamic";

export default async function DesignSessionPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  const session = await loadDesignSession(sessionId);
  if (!session) notFound();
  const draft = session.draftVersionId ? await prisma.protocolVersion.findUnique({ where: { id: session.draftVersionId }, include: { protocol: { select: { id: true, humanCode: true, canonicalTitle: true, title: true } } } }) : null;
  const inputs = (session.inputsJson && typeof session.inputsJson === "object" ? session.inputsJson : {}) as { query?: string; errors?: string[] };
  return <AppShell>
    <div className="space-y-5">
      <PageHeader identifier="Method design" title={session.goal}
        actions={<Link href="/protocols/design" className={buttonStyles({ size: "md", className: "bg-surface font-medium text-moss hover:bg-warm" })}>New design</Link>} />
      {session.sampleType || session.conditions ? <p className="text-sm text-muted">{[session.sampleType ? `Sample: ${session.sampleType}` : "", session.conditions ? `Conditions: ${session.conditions}` : ""].filter(Boolean).join(" · ")}</p> : null}
      <MethodDesignWorkspace sessionId={session.id} hits={session.hits} cards={session.cards} chosen={session.chosen} searchErrors={inputs.errors ?? []} lastQuery={inputs.query ?? session.goal}
        draft={draft ? { protocolId: draft.protocol.id, versionId: draft.id, humanCode: draft.protocol.humanCode, title: draft.protocol.canonicalTitle ?? draft.protocol.title, displayVersion: draft.displayVersion, reviewStage: draft.reviewStage } : null} />
    </div>
  </AppShell>;
}
