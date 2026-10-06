import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { assignEntry } from "@/lib/entry-assignment.server";
import { entryAssignmentSchema, entryTargetKey } from "@/lib/entry-assignment";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!await prisma.entry.findUnique({ where: { id }, select: { id: true } })) return Response.json({ error: "快速记录不存在" }, { status: 404 });
  const [experiments, results, current] = await Promise.all([
    prisma.experiment.findMany({ where: { status: { not: "archived" } }, select: { id: true, title: true, runCode: true, researchPlan: { select: { title: true } } }, orderBy: { updatedAt: "desc" } }),
    prisma.result.findMany({ where: { status: { not: "archived" }, experimentId: { not: null } }, select: { id: true, title: true, experimentId: true }, orderBy: { updatedAt: "desc" } }),
    prisma.itemLink.findFirst({ where: { sourceType: "entry", sourceId: id, linkType: "entry_primary" } }),
  ]);
  const record = current ? current.targetType === "result" ? await prisma.result.findUnique({where:{id:current.targetId},select:{title:true,status:true}}) : await prisma.experiment.findUnique({where:{id:current.targetId},select:{title:true,status:true}}) : null;
  const recycled = current ? await prisma.deletedRecord.findFirst({where:{targetType:current.targetType,targetId:current.targetId,restoredAt:null},select:{id:true}}) : null;
  return Response.json({ experiments, results, expectedTarget: entryTargetKey(current), currentTarget: current ? {type:current.targetType,id:current.targetId,title:record?.title ?? "目标已失效",invalid:!record || record.status === "archived" || Boolean(recycled)} : null });
}
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const result = await assignEntry(id, entryAssignmentSchema.parse(await request.json()));
    ["/entries", `/entries/${id}`, "/experiments", "/results"].forEach(path => revalidatePath(path));
    revalidatePath("/experiments/[id]", "page"); revalidatePath("/results/[id]", "page");
    return Response.json(result);
  } catch (error) { return Response.json({ error: error instanceof Error ? error.message : "归入失败，原记录与归属已保留" }, { status: 409 }); }
}
