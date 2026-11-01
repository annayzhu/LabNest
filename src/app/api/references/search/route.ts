import { searchInventoryReferences, searchSampleReferences } from "@/lib/record-references.server";

export const runtime = "nodejs";

/** What the "/样本" and "/库存物品" pickers offer (read only): `?kind=sample&q=&type=&inStorage=1&experiment=` or `?kind=inventory&q=`. */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const query = params.get("q") ?? undefined;
  const headers = { "Cache-Control": "no-store" };
  if (params.get("kind") === "inventory") return Response.json(await searchInventoryReferences({ query }), { headers });
  if (params.get("kind") !== "sample") return Response.json({ error: "Unknown kind." }, { status: 400 });
  return Response.json(await searchSampleReferences({ query, typeId: params.get("type") || undefined, inStorage: params.get("inStorage") === "1", experimentId: params.get("experiment") || undefined }), { headers });
}
