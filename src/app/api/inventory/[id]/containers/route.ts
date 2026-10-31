import {
  addInventoryContainers,
  commandInventoryContainer,
  deleteInventoryContainer,
  deleteInventoryObservation,
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
    const id = (await params).id;
    const body = await request.json();
    if (body?.action === "add") {
      await addInventoryContainers(id, body);
      return Response.json({ added: true });
    }
    if (body?.action === "delete") {
      await deleteInventoryContainer(id, String(body.containerId ?? ""));
      return Response.json({ deleted: true });
    }
    if (body?.action === "delete_observation") {
      await deleteInventoryObservation(id, String(body.observationId ?? ""));
      return Response.json({ deleted: true });
    }
    return Response.json(await commandInventoryContainer(id, body));
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
