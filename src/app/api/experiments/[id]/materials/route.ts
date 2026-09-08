import { prisma } from "@/lib/db";
import { saveRunMaterial, confirmRunMaterials } from "@/lib/run-materials";
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
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin)
    return Response.json({ error: "Origin mismatch" }, { status: 403 });
  try {
    const input = await request.json();
    const id = (await params).id;
    if (!["save", "confirm"].includes(input.action)) return Response.json({ error: "Unknown action" }, { status: 400 });
    return Response.json(
      input.action === "save"
        ? await saveRunMaterial(id, input)
        : input.action === "confirm"
          ? await confirmRunMaterials(id, input)
          : { error: "Unknown action" },
    );
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Save failed" },
      { status: 409 },
    );
  }
}
