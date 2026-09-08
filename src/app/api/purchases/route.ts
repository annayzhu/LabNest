import { createIndependentPurchase } from "@/lib/purchase-records";
export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin)
    return Response.json({ error: "Origin mismatch" }, { status: 403 });
  try {
    return Response.json(
      await createIndependentPurchase(await request.json()),
      { status: 201 },
    );
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Purchase failed" },
      { status: 409 },
    );
  }
}
