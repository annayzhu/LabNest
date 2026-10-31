import Link from "next/link";
import { notFound } from "next/navigation";
import { FileText, Pencil, ShoppingCart } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { InventoryContainers } from "@/components/InventoryContainers";
import { InventoryLifecycleMenu } from "@/components/InventoryLifecycleMenu";
import { InventoryRiskBadges } from "@/components/InventoryRiskBadges";
import { InventoryTransactionForm } from "@/components/InventoryTransactionForm";
import { PageActionsMenu } from "@/components/PageActionsMenu";
import { PageHeader } from "@/components/PageHeader";
import { ReverseMovementButton } from "@/components/ReverseMovementButton";
import { Badge, StatusPill } from "@/components/ui/Badge";
import { buttonStyles } from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import { Fact, Panel, QuantityText, Row, SideSection } from "@/components/InventoryDetail";
import { ExperimentStatus, PurchaseStatus } from "@/generated/prisma/enums";
import { formatQuantity } from "@/lib/calculators/quantity-format";
import { prisma } from "@/lib/db";
import {
  controlLevelName, inventoryNoteText, isStrictlyControlled, lotRiskFlags, lowStockAdvice, managementModeLabels,
  movementReversalProblem, observationUnits, productDocumentKindNames,
} from "@/lib/inventory";
import { stockItemBlockers } from "@/lib/inventory-products.server";
import { inventoryGroupName, inventoryTypeFields } from "@/lib/inventory-types";
import { deleteInventoryItem, recordInventoryTransaction, setInventoryItemArchived } from "../actions";

export const dynamic = "force-dynamic";


export default async function InventoryItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const item = await prisma.inventoryItem.findUnique({
    where: { id },
    include: {
      product: { include: { type: true, group: true, kitComponents: { orderBy: { sortOrder: "asc" } }, items: { select: { currentQuantity: true, unit: true, quantityRecorded: true, status: true } } } },
      containers: { include: { observations: { orderBy: { createdAt: "desc" } }, events: { orderBy: { createdAt: "desc" } } }, orderBy: { createdAt: "asc" } },
      location: true,
      parentInventoryItem: { select: { id: true, name: true, aliquotCode: true } },
      childInventoryItems: { select: { id: true, name: true, aliquotCode: true, currentQuantity: true, unit: true, quantityRecorded: true } },
      transactions: {
        include: {
          fromLocation: { select: { name: true } },
          toLocation: { select: { name: true } },
          experiment: { select: { id: true, runCode: true, title: true, project: { select: { name: true } } } },
          purchase: { select: { id: true, title: true } },
          materialUse: { select: { id: true } },
          reversedBy: { select: { id: true } },
          reverses: { select: { type: true, createdAt: true } },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });
  if (!item) notFound();

  const [experiments, purchases, documents, blockers] = await Promise.all([
    prisma.experiment.findMany({ where: { status: { in: [ExperimentStatus.planned, ExperimentStatus.running, ExperimentStatus.completed] } }, select: { id: true, title: true, project: { select: { name: true } } }, orderBy: { updatedAt: "desc" }, take: 100 }),
    prisma.purchaseRequest.findMany({ where: { OR: [{ linkedInventoryItemId: id }, { status: { in: [PurchaseStatus.planned, PurchaseStatus.ordered, PurchaseStatus.received] } }] }, select: { id: true, title: true, status: true }, orderBy: { updatedAt: "desc" }, take: 100 }),
    item.productId ? prisma.attachmentLink.findMany({ where: { targetType: "inventory_product", targetId: item.productId }, include: { attachment: { select: { originalFilename: true } } }, orderBy: { createdAt: "asc" } }) : Promise.resolve([]),
    stockItemBlockers(prisma, id),
  ]);

  const product = item.product;
  const riskFlags = lotRiskFlags(item, product, product?.items ?? []);
  const strict = isStrictlyControlled(product?.controlLevels ?? []);
  const advice = lowStockAdvice(product?.groupKey);
  const fields = product?.type ? inventoryTypeFields(product.type.fieldDefinitions) : [];
  const fieldValues = (product?.fieldValues ?? {}) as Record<string, string>;
  const transactionAction = recordInventoryTransaction.bind(null, item.id);
  const sdsMissing = strict && !documents.some((document) => document.linkType === "sds");
  const secondary = buttonStyles({ variant: "secondary", size: "md", className: "bg-surface font-medium text-moss" });

  return (
    <AppShell>
      <div className="space-y-4">
        <PageHeader
          identifier={item.lotNumber ? `Lot ${item.lotNumber}` : item.aliquotCode ?? undefined}
          title={item.name}
          actions={<>
            <Link href={`/inventory/${item.id}/edit`} className={secondary}><Pencil className="h-4 w-4" aria-hidden />Edit</Link>
            <PageActionsMenu>
              <Link href={`/purchases/new?inventory=${item.id}`}><ShoppingCart className="h-4 w-4" aria-hidden />Purchase</Link>
              <InventoryLifecycleMenu id={item.id} name={item.name} archived={item.status === "archived"} blockers={blockers} archiveAction={setInventoryItemArchived} deleteAction={deleteInventoryItem} />
            </PageActionsMenu>
          </>}
        />

        <section aria-label="Stock summary" className="grid grid-cols-2 divide-x divide-y divide-hairline overflow-hidden rounded-[var(--ln-radius-panel)] border border-hairline bg-surface md:grid-cols-4 md:divide-y-0">
          <Fact label="Current stock" value={<QuantityText quantity={item.currentQuantity} unit={item.unit} recorded={item.quantityRecorded} />} detail={product?.lowThreshold != null ? <><span>Safety stock</span> <QuantityText quantity={product.lowThreshold} unit={product.lowThresholdUnit} /></> : <span>No safety stock</span>} />
          <Fact label="Location" value={item.location?.name ?? "Unassigned"} detail={item.positionCode ?? item.location?.temperature ?? "—"} />
          <Fact label="Expiry" value={<span className="font-mono">{item.expiryDate?.toISOString().slice(0, 10) ?? "—"}</span>} detail={<span>{managementModeLabels[item.managementMode] ?? item.managementMode}</span>} />
          <Fact label="Attention" value={item.status === "archived" ? <span className="text-sm text-muted">Archived</span> : riskFlags.length || sdsMissing ? <div className="flex flex-wrap gap-1.5"><InventoryRiskBadges flags={riskFlags} />{sdsMissing ? <Badge tone="danger">SDS missing</Badge> : null}</div> : <span className="text-sm text-muted">Nothing needs attention</span>} detail={item.status === "active" && (riskFlags.includes("low") || riskFlags.includes("depleted")) ? <AdviceText advice={advice} item={item} /> : null} />
        </section>

        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0 space-y-4">
            {item.status === "archived" ? (
              <p className="rounded-[var(--ln-radius-panel)] border border-hairline bg-surface px-4 py-3 text-sm text-graphite">Archived: restore it from ⋯ to record movements again.</p>
            ) : item.managementMode === "package" ? (
              <Panel title="Containers">
                <InventoryContainers
                  itemId={item.id}
                  unit={item.unit}
                  observationUnits={observationUnits(product?.type?.key)}
                  kitComponents={product?.kitComponents.map((component) => ({ id: component.id, name: component.name, spec: component.spec, storageCondition: component.storageCondition })) ?? []}
                  containers={JSON.parse(JSON.stringify(item.containers))}
                />
              </Panel>
            ) : (
              <Panel title="Record stock movement">
                {item.managementMode === "precise" && item.quantityRecorded
                  ? <InventoryTransactionForm action={transactionAction} inventoryItemId={item.id} unit={item.unit} experiments={experiments} purchases={purchases} strict={strict} />
                  : <p className="text-sm text-graphite"><span>The remaining amount is not managed. To deduct use, edit the item and enter a counted balance.</span> <Link href={`/inventory/${item.id}/edit`} className="text-moss underline">Edit</Link></p>}
              </Panel>
            )}

            <Panel title="Movement ledger" flush>
              <DataTable
                rows={item.transactions}
                getRowKey={(row) => row.id}
                emptyMessage="No stock movements have been recorded."
                columns={[
                  { key: "date", header: "Date", render: (row) => <span className="whitespace-nowrap font-mono text-xs">{row.createdAt.toISOString().slice(0, 16).replace("T", " ")}{row.deviceCreatedAt ? <span className="block text-muted">{row.deviceCreatedAt.toISOString().slice(0, 10)}</span> : null}</span> },
                  { key: "type", header: "Movement", render: (row) => <div className="space-y-1"><StatusPill status={row.type} />{row.reversedBy ? <p className="text-xs text-muted">Reversed</p> : null}{row.reverses ? <p className="whitespace-nowrap text-xs text-muted"><span>Reverses</span> <span className="font-mono">{row.reverses.createdAt.toISOString().slice(0, 10)}</span></p> : null}</div> },
                  { key: "change", header: "Change", render: (row) => <span className={`whitespace-nowrap font-semibold ${row.reversedBy ? "text-muted line-through" : row.quantityChange < 0 ? "text-error" : "text-success"}`}><span className="font-mono">{row.quantityChange > 0 ? "+" : ""}{formatQuantity(row.quantityChange)}</span> <span>{row.unit}</span></span> },
                  { key: "handler", header: "Handled by", render: (row) => row.performedBy ?? "—" },
                  { key: "source", header: "Link", render: (row) => row.experiment ? <Link href={`/experiments/${row.experiment.id}`} className="text-moss hover:underline">{row.experiment.runCode}</Link> : row.purchase ? <span>{row.purchase.title}</span> : "—" },
                  { key: "notes", header: "Note", render: (row) => <span className="text-xs">{inventoryNoteText(row.notes, row.experiment) ?? "—"}</span> },
                  { key: "reverse", header: <span className="sr-only">Reverse</span>, render: (row) => movementReversalProblem(row, item) ? null : <ReverseMovementButton id={row.id} /> },
                ]}
              />
            </Panel>

            {item.childInventoryItems.length ? (
              <Panel title="Aliquots" flush>
                <DataTable
                  rows={item.childInventoryItems}
                  getRowKey={(row) => row.id}
                  columns={[
                    { key: "name", header: "Item", render: (row) => <Link className="font-semibold text-moss" href={`/inventory/${row.id}`}>{row.name}</Link> },
                    { key: "code", header: "Aliquot", render: (row) => <span className="record-identifier text-xs">{row.aliquotCode ?? "—"}</span> },
                    { key: "quantity", header: "Stock", render: (row) => <QuantityText quantity={row.currentQuantity} unit={row.unit} recorded={row.quantityRecorded} /> },
                  ]}
                />
              </Panel>
            ) : null}
          </div>

          <aside aria-label="Item details" className="divide-y divide-hairline rounded-[var(--ln-radius-panel)] border border-hairline bg-surface">
            <SideSection title="Product">
              {product ? <>
                <Link href={`/inventory/products/${product.id}`} className="font-semibold text-moss hover:underline">{product.name}</Link>
                <Row label="Type" value={product.type?.label ?? (product.group ? "Not subdivided" : "To be classified")} />
                {product.group ? <Row label="Inventory group" value={inventoryGroupName(product.group)} /> : null}
                <Row label="Brand" value={product.brand} />
                <Row label="Catalog" value={product.catalogNumber} mono />
                <Row label="CAS" value={product.casNumber} mono />
                {fields.map((field) => <Row key={field.key} label={field.label} value={fieldValues[field.key]} />)}
                {product.controlLevels.length ? <div className="flex flex-wrap gap-1.5 pt-1">{product.controlLevels.map((level) => <Badge key={level} tone={isStrictlyControlled([level]) ? "danger" : "warning"}>{controlLevelName(level)}</Badge>)}</div> : null}
              </> : <p className="text-sm text-muted">Saved before products existed. Choose its product in Edit.</p>}
            </SideSection>
            {[item.lotNumber, item.expiryDate, item.containerType, item.concentration, item.barcode, item.aliquotCode, item.parentInventoryItem].some(Boolean) ? <SideSection title="This lot">
              <Row label="Lot number" value={item.lotNumber} mono />
              <Row label="Expiry date" value={item.expiryDate?.toISOString().slice(0, 10)} mono />
              <Row label="Container type" value={item.containerType} />
              <Row label="Concentration" value={item.concentration} />
              <Row label="Barcode" value={item.barcode} mono />
              <Row label="Aliquot code" value={item.aliquotCode} mono />
              {item.parentInventoryItem ? <Row label="Parent stock" value={<Link href={`/inventory/${item.parentInventoryItem.id}`} className="text-moss hover:underline">{item.parentInventoryItem.aliquotCode ?? item.parentInventoryItem.name}</Link>} /> : null}
            </SideSection> : null}
            <SideSection title="Storage">
              <Row label="Location" value={item.location?.name} />
              <Row label="Position" value={item.positionCode} />
              <Row label="Storage condition" value={item.storageCondition} />
            </SideSection>
            {item.vendor || item.principalInvestigator ? <SideSection title="Source">
              <Row label="Supplier" value={item.vendor} />
              <Row label="Principal investigator (PI)" value={item.principalInvestigator} />
            </SideSection> : null}
            <SideSection title="Documents">
              {documents.length ? <ul className="space-y-1.5">{documents.map((document) => (
                <li key={document.id} className="flex min-w-0 items-center gap-2 text-sm">
                  <FileText className="h-4 w-4 shrink-0 text-muted" aria-hidden />
                  <a href={`/api/attachments/${document.attachmentId}`} target="_blank" rel="noreferrer" className="focus-ring min-w-0 flex-1 truncate text-moss hover:underline">{document.attachment.originalFilename}</a>
                  <span className="shrink-0 text-xs text-muted">{productDocumentKindNames[document.linkType as keyof typeof productDocumentKindNames] ?? document.linkType}</span>
                </li>
              ))}</ul> : <p className="text-sm text-muted">No documents on this product.</p>}
              {product ? <Link href={`/inventory/products/${product.id}#documents`} className="text-xs text-moss underline">Manage documents on the product</Link> : null}
            </SideSection>
            {item.notes ? <SideSection title="Notes"><p className="whitespace-pre-wrap text-sm text-graphite">{item.notes}</p></SideSection> : null}
          </aside>
        </div>
      </div>
    </AppShell>
  );
}

function AdviceText({ advice, item }: { advice: "purchase" | "expand" | "remaining"; item: { id: string; currentQuantity: number; unit: string } }) {
  if (advice === "expand") return <span>Grow it again from its glycerol stock or seed bank</span>;
  if (advice === "remaining") return <span><span>A sample cannot be replaced; left:</span> <QuantityText quantity={item.currentQuantity} unit={item.unit} /></span>;
  return <Link href={`/purchases/new?inventory=${item.id}`} className="text-moss underline">Reorder</Link>;
}
