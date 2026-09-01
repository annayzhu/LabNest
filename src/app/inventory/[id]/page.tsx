import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Pencil, ShoppingCart } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { InventoryRiskBadges } from "@/components/InventoryRiskBadges";
import { InventoryTransactionForm } from "@/components/InventoryTransactionForm";
import { PageHeader } from "@/components/PageHeader";
import { StatusPill } from "@/components/ui/Badge";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { ExperimentStatus, PurchaseStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";
import { getInventoryRiskFlags, inventoryCategories } from "@/lib/inventory";
import { recordInventoryTransaction } from "../actions";

export const dynamic = "force-dynamic";

const actionLinkClass = "focus-ring inline-flex h-9 items-center gap-2 rounded-[var(--ln-radius-control-md)] border border-hairline bg-surface px-3 text-[13px] font-medium text-moss hover:bg-warm";

export default async function InventoryItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [item, experiments, purchases] = await Promise.all([
    prisma.inventoryItem.findUnique({
      where: { id },
      include: {
        entity: { select: { id: true, name: true } },
        location: true,
        parentInventoryItem: { select: { id: true, name: true, aliquotCode: true } },
        childInventoryItems: { select: { id: true, name: true, aliquotCode: true, currentQuantity: true, unit: true } },
        transactions: {
          include: {
            fromLocation: { select: { name: true } },
            toLocation: { select: { name: true } },
            experiment: { select: { id: true, title: true, project: { select: { name: true } } } },
            purchase: { select: { id: true, title: true } },
          },
          orderBy: { createdAt: "desc" },
        },
      },
    }),
    prisma.experiment.findMany({
      where: { status: { in: [ExperimentStatus.planned, ExperimentStatus.running, ExperimentStatus.completed] } },
      select: { id: true, title: true, project: { select: { name: true } } },
      orderBy: { updatedAt: "desc" },
      take: 100,
    }),
    prisma.purchaseRequest.findMany({
      where: {
        OR: [
          { linkedInventoryItemId: id },
          { status: { in: [PurchaseStatus.planned, PurchaseStatus.ordered, PurchaseStatus.received] } },
        ],
      },
      select: { id: true, title: true, status: true },
      orderBy: { updatedAt: "desc" },
      take: 100,
    }),
  ]);

  if (!item) notFound();

  const riskFlags = getInventoryRiskFlags(item);
  const categoryLabel = inventoryCategories.find((category) => category.value === item.category)?.label ?? item.category ?? "Unclassified";
  const transactionAction = recordInventoryTransaction.bind(null, item.id);

  return (
    <AppShell>
      <div className="space-y-5">
        <PageHeader
          title={item.name}
          actions={(
            <>
              <Link href="/inventory" className={actionLinkClass}><ArrowLeft className="h-4 w-4" aria-hidden />Inventory</Link>
              <Link href={`/inventory/${item.id}/edit`} className={actionLinkClass}><Pencil className="h-4 w-4" aria-hidden />Edit</Link>
              <Link href="/purchases" className={actionLinkClass}><ShoppingCart className="h-4 w-4" aria-hidden />Purchases</Link>
            </>
          )}
        />

        <section className="grid gap-4 md:grid-cols-3">
          <Metric label="Current stock" value={`${item.currentQuantity} ${item.unit}`} detail={item.lowThreshold == null ? "No safety stock set" : `Safety stock ${item.lowThreshold} ${item.unit}`} />
          <Metric label="Location" value={item.location?.name ?? "Unassigned"} detail={item.positionCode ?? item.location?.temperature ?? "No position recorded"} />
          <Metric label="Risk status" value={<InventoryRiskBadges flags={riskFlags} showHealthy />} detail={item.expiryDate ? `Expires ${item.expiryDate.toLocaleDateString()}` : "No expiry date recorded"} />
        </section>

        <section className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
          <Card>
            <CardHeader title="Material record" />
            <CardBody className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
              <Field label="English name" value={item.englishName} />
              <Field label="Category" value={categoryLabel} />
              <Field label="Principal investigator (PI)" value={item.principalInvestigator} />
              <Field label="Brand" value={item.brand} />
              <Field label="Supplier" value={item.vendor} />
              <Field label="Catalog" value={item.catalogNumber} mono />
              <Field label="CAS" value={item.casNumber} mono />
              <Field label="Lot" value={item.lotNumber} mono />
              <Field label="Barcode / aliquot" value={item.aliquotCode ?? item.barcode} mono />
              <Field label="Container" value={item.containerType} />
              <Field label="Concentration" value={item.concentration} />
              <Field label="Storage" value={item.storageCondition} />
              <Field label="Lifecycle" value={<StatusPill status={item.status} />} />
              {item.entity ? <Field label="Linked sample/entity" value={<Link href="/entities" className="text-moss hover:underline">{item.entity.name}</Link>} /> : null}
              {item.parentInventoryItem ? <Field label="Parent stock" value={<Link href={`/inventory/${item.parentInventoryItem.id}`} className="text-moss hover:underline">{item.parentInventoryItem.aliquotCode ?? item.parentInventoryItem.name}</Link>} /> : null}
              {item.notes ? <div className="sm:col-span-2"><Field label="Notes" value={item.notes} /></div> : null}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Record stock movement" />
            <CardBody>
              <InventoryTransactionForm action={transactionAction} unit={item.unit} experiments={experiments} purchases={purchases} />
            </CardBody>
          </Card>
        </section>

        {item.childInventoryItems.length ? (
          <Card>
            <CardHeader title="Aliquots and child containers" />
            <CardBody>
              <DataTable
                rows={item.childInventoryItems}
                getRowKey={(row) => row.id}
                columns={[
                  { key: "name", header: "Item", render: (row) => <Link className="font-semibold text-moss" href={`/inventory/${row.id}`}>{row.name}</Link> },
                  { key: "code", header: "Aliquot", render: (row) => <span className="record-identifier text-xs">{row.aliquotCode ?? "—"}</span> },
                  { key: "quantity", header: "Stock", render: (row) => <span className="font-mono">{row.currentQuantity} {row.unit}</span> },
                ]}
              />
            </CardBody>
          </Card>
        ) : null}

        <Card>
          <CardHeader title="Movement ledger" />
          <CardBody>
            <DataTable
              rows={item.transactions}
              getRowKey={(row) => row.id}
              emptyMessage="No stock movements have been recorded."
              columns={[
                { key: "date", header: "Date", render: (row) => <span className="whitespace-nowrap font-mono text-xs">{row.createdAt.toLocaleString()}</span> },
                { key: "type", header: "Movement", render: (row) => <StatusPill status={row.type} /> },
                { key: "change", header: "Change", render: (row) => <span className={`font-mono font-semibold ${row.quantityChange < 0 ? "text-error" : "text-success"}`}>{row.quantityChange > 0 ? "+" : ""}{row.quantityChange} {row.unit}</span> },
                { key: "handler", header: "Handled by", render: (row) => row.performedBy ?? "—" },
                {
                  key: "source",
                  header: "Research / purchase link",
                  render: (row) => row.experiment ? (
                    <div><Link href={`/experiments/${row.experiment.id}`} className="font-medium text-moss hover:underline">{row.experiment.title}</Link><p className="text-xs text-muted">{row.experiment.project?.name ?? "No project"}</p></div>
                  ) : row.purchase ? <span>{row.purchase.title}</span> : "—",
                },
                { key: "location", header: "Location", render: (row) => row.toLocation?.name ?? row.fromLocation?.name ?? "—" },
                { key: "notes", header: "Notes", render: (row) => row.notes ?? "—" },
              ]}
            />
          </CardBody>
        </Card>
      </div>
    </AppShell>
  );
}

function Metric({ label, value, detail }: { label: string; value: React.ReactNode; detail: string }) {
  return (
    <div className="rounded-[var(--ln-radius-panel)] border border-hairline bg-surface p-4 shadow-paper">
      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">{label}</p>
      <div className="mt-2 min-h-7 font-serif text-xl font-medium text-ink">{value}</div>
      <p className="mt-1 text-xs text-muted">{detail}</p>
    </div>
  );
}

function Field({ label, value, mono = false }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">{label}</p>
      <div className={`mt-1 text-sm text-ink ${mono ? "font-mono text-xs" : ""}`}>{value || "—"}</div>
    </div>
  );
}
