import { prisma } from "@/lib/db";
import { toCsv } from "@/lib/export";
import { productsFasta, strandFacts } from "@/lib/product-sequences";
import { readProductSequences } from "@/lib/product-sequences.server";

export const runtime = "nodejs";

/** The chosen products' sequences as FASTA or CSV (Q186): `?ids=a,b&format=fasta|csv`. Products without sequences are left out. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const ids = (url.searchParams.get("ids") ?? "").split(",").map((id) => id.trim()).filter(Boolean).slice(0, 500);
  const format = url.searchParams.get("format") === "csv" ? "csv" : "fasta";
  if (!ids.length) return Response.json({ error: "Choose at least one product." }, { status: 400 });
  const products = await prisma.inventoryProduct.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, entityId: true, type: { select: { key: true, label: true } } }, orderBy: { name: "asc" } });
  const withStrands = (await Promise.all(products.map(async (product) => ({ ...product, strands: await readProductSequences(prisma, product.entityId, product.type?.key) })))).filter((product) => product.strands.length);
  if (!withStrands.length) return Response.json({ error: "None of these products has a sequence." }, { status: 404 });
  const stamp = new Date().toISOString().slice(0, 10);
  const body = format === "fasta"
    ? `${productsFasta(withStrands)}\n`
    : `${toCsv(withStrands.flatMap((product) => product.strands.map((strand) => {
      const facts = strandFacts(strand.sequence, strand.molecule);
      return { Product: product.name, Type: product.type?.label, Strand: strand.label, Sequence: strand.sequence, Length: facts.length, "GC %": facts.gc?.toFixed(1) };
    })), ["Product", "Type", "Strand", "Sequence", "Length", "GC %"])}\n`;
  return new Response(body, {
    headers: {
      "Content-Type": format === "fasta" ? "text/x-fasta; charset=utf-8" : "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(`LabNest_sequences_${stamp}.${format}`)}`,
      "Cache-Control": "no-store",
    },
  });
}
