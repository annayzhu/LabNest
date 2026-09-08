import { prisma } from "@/lib/db";
import { updateIndependentPurchase } from "@/lib/purchase-records";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const record = await prisma.purchaseRequest.findUnique({
    where: { id: (await params).id },
    include: { receipts: { orderBy: { createdAt: "asc" } } },
  });
  return Response.json(record ?? { error: "Not found" }, {
    status: record ? 200 : 404,
  });
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
      await updateIndependentPurchase((await params).id, await request.json()),
    );
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Purchase update failed",
      },
      { status: 409 },
    );
  }
}
