import {
  commandInventoryContainer,
  readInventoryContainers,
} from "@/lib/inventory-containers";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    return Response.json(await readInventoryContainers((await params).id));
  } catch {
    return Response.json(
      { error: "Inventory item not found" },
      { status: 404 },
    );
  }
}
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin)
    return Response.json({ error: "Origin mismatch" }, { status: 403 });
  try {
    return Response.json(
      await commandInventoryContainer((await params).id, await request.json()),
    );
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "操作失败 / Action failed",
      },
      { status: 409 },
    );
  }
}
