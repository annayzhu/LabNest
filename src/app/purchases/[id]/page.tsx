import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { AttachmentDeleteButton } from "@/components/AttachmentDeleteButton";
import { PageHeader } from "@/components/PageHeader";
import { PurchaseRecordForm } from "@/components/PurchaseRecordForm";
import { readAISettings } from "@/lib/ai-settings";
import { prisma } from "@/lib/db";
export const dynamic = "force-dynamic";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const id = (await params).id;
  // Pictures need the service that reads pictures; a PDF's text goes to the default service.
  const [purchase, stock, invoices, { vision: pictures, availability: text }] = await Promise.all([
    prisma.purchaseRequest.findUnique({
      where: { id },
      include: { procurementQuoteLine: { select: { specification: true } }, receipts: { orderBy: { createdAt: "asc" } } },
    }),
    prisma.inventoryItem.findMany({
      where: { status: "active" },
      select: { id: true, name: true, unit: true },
    }),
    prisma.attachmentLink.findMany({ where: { targetType: "purchase", targetId: id, linkType: "invoice" }, include: { attachment: { select: { originalFilename: true } } }, orderBy: { createdAt: "asc" } }),
    readAISettings(),
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
          invoiceReader={{ ready: pictures.ready || text.connected, reason: pictures.reason ?? text.reason }}
        />
        {invoices.length ? (
          <section className="border-t border-hairline pt-4">
            <h2 className="font-semibold">发票与送货单</h2>
            <ul className="divide-y divide-hairline">
              {invoices.map((link) => (
                <li key={link.id} className="flex items-center gap-2 py-2 text-sm">
                  <a href={`/api/attachments/${link.attachmentId}`} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate text-moss hover:underline">{link.attachment.originalFilename}</a>
                  <AttachmentDeleteButton attachmentId={link.attachmentId} linkId={link.id} filename={link.attachment.originalFilename} />
                </li>
              ))}
            </ul>
          </section>
        ) : null}
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
