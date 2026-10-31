import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * The sequence library moved into inventory (docs/modules/inventory/sequence-merge-20261031, Q187). An old link opens
 * the product that holds the sequence or pair, or else the products that have sequences.
 */
export default async function SequenceLinkPage({ params }: { params: Promise<{ path?: string[] }> }) {
  const [first, second] = (await params).path ?? [];
  if (first === "new") redirect("/inventory/products/new");
  if (first === "import") redirect("/inventory/import?source=sequences");
  const sequenceIds = first === "pairs" && second
    ? (await prisma.sequencePairMember.findMany({ where: { pairId: second }, select: { sequenceId: true } })).map((member) => member.sequenceId)
    : first && !["export", "collections", "workflows", "pairs"].includes(first) ? [first] : [];
  if (sequenceIds.length) {
    const product = await prisma.inventoryProduct.findFirst({ where: { entity: { sequenceLinks: { some: { sequenceId: { in: sequenceIds } } } } }, select: { id: true } });
    if (product) redirect(`/inventory/products/${product.id}`);
  }
  redirect("/inventory/products?flag=sequences");
}
