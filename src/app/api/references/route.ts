import { referenceDetails } from "@/lib/record-references.server";
import type { RecordReferenceKind } from "@/lib/record-references";

export const runtime = "nodejs";

const kinds = new Set<RecordReferenceKind>(["sample", "product", "lot"]);

/** How the samples and stock a page's tags name stand now: `?refs=sample:<id>,lot:<id>` (read only). */
export async function GET(request: Request) {
  const references = (new URL(request.url).searchParams.get("refs") ?? "").split(",").slice(0, 200).flatMap((value) => {
    const [kind, id] = value.split(":");
    return kinds.has(kind as RecordReferenceKind) && /^[A-Za-z0-9_-]{1,64}$/.test(id ?? "") ? [{ kind: kind as RecordReferenceKind, id }] : [];
  });
  if (!references.length) return Response.json({ results: {} });
  return Response.json({ results: await referenceDetails(references) }, { headers: { "Cache-Control": "no-store" } });
}
