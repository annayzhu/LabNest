import { z } from "zod";
import { acceptsRequestOrigin } from "@/lib/request-origin";
import { prisma } from "@/lib/db";
import { saveRunMaterial, confirmRunMaterials, deleteRunMaterial } from "@/lib/run-materials";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return Response.json(
    await prisma.runMaterialUse.findMany({
      where: { experimentId: (await params).id },
      orderBy: { createdAt: "asc" },
    }),
  );
}
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!acceptsRequestOrigin(request))
    return Response.json({ error: "请求来源不匹配，请从当前站点重新打开；未保存输入请保留。" }, { status: 403 });
  try {
    const input = await request.json();
    const id = (await params).id;
    if (!["save", "confirm", "delete"].includes(input.action)) return Response.json({ error: "Unknown action" }, { status: 400 });
    if (input.action === "delete") return Response.json(await deleteRunMaterial(id, input));
    return Response.json(
      input.action === "save"
        ? await saveRunMaterial(id, input)
        : input.action === "confirm"
          ? await confirmRunMaterials(id, input)
          : { error: "Unknown action" },
    );
  } catch (error) {
    return Response.json(
      { error: error instanceof z.ZodError ? "请检查名称、用量和单位；输入尚未保存。" : error && typeof error === "object" && "code" in error && error.code === "P2002" ? "该记录或更正已存在，请刷新后核对，避免重复提交。" : error instanceof Error ? error.message : "保存失败，请重试；输入仍保留。" },
      { status: 409 },
    );
  }
}
