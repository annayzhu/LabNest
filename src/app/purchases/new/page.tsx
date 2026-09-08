import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { PurchaseRecordForm } from "@/components/PurchaseRecordForm";
import { prisma } from "@/lib/db";
export const dynamic = "force-dynamic";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ inventory?: string; quote?: string }>;
}) {
  const query = await searchParams;
  let initial: Record<string, string> = {};
  if (query.inventory) {
    const item = await prisma.inventoryItem.findUnique({
      where: { id: query.inventory },
    });
    if (item)
      initial = {
        title: item.name,
        unit: item.unit,
        vendor: item.vendor ?? "",
        linkedInventoryItemId: item.id,
      };
  }
  if (query.quote) {
    const quote = await prisma.procurementQuoteLine.findUnique({
      where: { id: query.quote },
    });
    if (quote)
      initial = {
        title: quote.productName,
        quantity: String(quote.quantity),
        unit: quote.packageUnit,
        vendor: quote.supplierName ?? "",
        procurementQuoteLineId: quote.id,
      };
  }
  return (
    <AppShell>
      <div className="space-y-5">
        <PageHeader title="登记购买" />
        <PurchaseRecordForm initial={initial} />
      </div>
    </AppShell>
  );
}
