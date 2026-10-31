import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { SampleNav } from "@/components/SampleNav";
import { SampleTypeManager } from "@/components/SampleTypeManager";
import { prisma } from "@/lib/db";
import { sampleTypeRef } from "@/lib/samples";
import { bySampleTypeOrder } from "@/lib/samples.server";

export const dynamic = "force-dynamic";

export default async function SampleTypesPage() {
  const types = await prisma.scientificSchemaDefinition.findMany({
    where: { objectKind: "sample" },
    include: { _count: { select: { samples: true } } },
    orderBy: { createdAt: "asc" },
  });
  return (
    <AppShell>
      <div className="space-y-4">
        <PageHeader title="Samples" />
        <SampleNav current="types" />
        <SampleTypeManager types={types.sort(bySampleTypeOrder).map((type) => ({ ...sampleTypeRef(type), enabled: type.enabled, samples: type._count.samples }))} />
      </div>
    </AppShell>
  );
}
