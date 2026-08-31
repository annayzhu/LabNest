import { notFound } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { ResultForm } from "@/components/ResultForm";
import { prisma } from "@/lib/db";
import { EXPERIMENT_RESULT_REPORT_KEY } from "@/lib/experiment-results";
import { normalizeResultDocument } from "@/lib/scientific-document";
import { updateResult } from "../../actions";

export const dynamic = "force-dynamic";
export default async function EditResultPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await prisma.result.findUnique({ where: { id } });
  if (!result || !result.experimentId) notFound();
  const [experiments, storedResultTypes] = await Promise.all([
    prisma.experiment.findMany({ where: { id: result.experimentId }, include: { project: { select: { name: true } }, researchPlan: { select: { code: true, title: true } } } }),
    prisma.resultTypeDefinition.findMany({ orderBy: [{ sortOrder: "asc" }, { label: "asc" }] }),
  ]);
  const resultTypes = storedResultTypes.some((item) => item.label === result.resultType) ? storedResultTypes : [{ id: `historical-${result.id}`, key: `historical-${result.id}`, label: result.resultType, description: "Historical Result type; add it again in Manage types to keep it available for new Results.", sortOrder: -1, createdAt: result.createdAt, updatedAt: result.updatedAt }, ...storedResultTypes];
  const isExperimentReport = result.templateKey === EXPERIMENT_RESULT_REPORT_KEY;
  return <AppShell><div className="space-y-6"><PageHeader eyebrow={isExperimentReport ? undefined : result.resultType} title={isExperimentReport ? "编辑实验结果" : `Edit ${result.title}`} description={isExperimentReport ? undefined : "先填写实验规程定义的结果字段和数据表，再补充分析与解释；实验来源保持锁定。"} /><ResultForm action={updateResult} experiments={experiments} resultTypes={resultTypes} lockedExperiment initial={{ ...result, document: normalizeResultDocument(result.contentJson) }} /></div></AppShell>;
}
