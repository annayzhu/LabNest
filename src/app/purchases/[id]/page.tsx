import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { PurchaseRecordForm } from "@/components/PurchaseRecordForm";
import { prisma } from "@/lib/db";
export const dynamic = "force-dynamic";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [purchase, stock] = await Promise.all([
    prisma.purchaseRequest.findUnique({
      where: { id: (await params).id },
      include: { receipts: { orderBy: { createdAt: "asc" } } },
    }),
    prisma.inventoryItem.findMany({
      where: { status: "active" },
      select: { id: true, name: true, unit: true },
    }),
  ]);
  if (!purchase) notFound();
  return (
    <AppShell>
      <div className="space-y-5">
        <PageHeader
          title={purchase.title}
          actions={<Link href="/purchases">返回采购</Link>}
        />
        <dl className="grid gap-3 sm:grid-cols-3">
          <div>
            <dt>购买数量</dt>
            <dd>
              {purchase.quantity} {purchase.unit}
            </dd>
          </div>
          <div>
            <dt>实际总金额</dt>
            <dd>
              {purchase.actualAmount?.toFixed(2) ?? "金额未记录"}{" "}
              {purchase.currency}
            </dd>
          </div>
          <div>
            <dt>发票</dt>
            <dd>
              {purchase.invoiceStatus === "pending"
                ? "待补"
                : purchase.invoiceStatus === "available"
                  ? "已备齐"
                  : "无需"}{" "}
              · {purchase.invoiceReference ?? "编号未记录"}
            </dd>
          </div>
        </dl>
        <PurchaseRecordForm
          purchase={JSON.parse(JSON.stringify(purchase))}
          stock={stock}
        />
        <section className="border-t border-hairline pt-4">
          <h2 className="font-semibold">收货记录</h2>
          {purchase.receipts.length ? (
            <ul className="divide-y divide-hairline">
              {purchase.receipts.map((r) => (
                <li key={r.id} className="py-3">
                  {r.createdAt.toLocaleString()} · {r.quantity} {purchase.unit}{" "}
                  ·{" "}
                  {r.inventoryItemId ? (
                    <Link
                      className="text-moss"
                      href={`/inventory/${r.inventoryItemId}`}
                    >
                      查看入库物料
                    </Link>
                  ) : (
                    "未加入库存"
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-3">
              {purchase.status === "received"
                ? "历史已收货记录，未补造分批明细。"
                : "尚未收货"}
            </p>
          )}
        </section>
      </div>
    </AppShell>
  );
}
