import Link from "next/link";
import { notFound } from "next/navigation";
import { GitMerge, Pencil, Plus } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { InventoryDocuments } from "@/components/InventoryDocuments";
import { Fact, Panel, QuantityText, Row, SideSection } from "@/components/InventoryDetail";
import { InventoryKitComponents } from "@/components/InventoryKitComponents";
import { InventoryLifecycleMenu } from "@/components/InventoryLifecycleMenu";
import { InventoryRiskBadges } from "@/components/InventoryRiskBadges";
import { PageActionsMenu } from "@/components/PageActionsMenu";
import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { buttonStyles } from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import { prisma } from "@/lib/db";
import { controlLevelName, deleteBlockers, isStrictlyControlled, lotRiskFlags, lowStockAdvice, productSafetyStock } from "@/lib/inventory";
import { inventoryGroupName, inventoryTypeFields } from "@/lib/inventory-types";
import { deleteInventoryProduct, setInventoryProductArchived } from "../actions";

export const dynamic = "force-dynamic";

const adviceText = { purchase: "Reorder this product", expand: "Grow it again from its glycerol stock or seed bank", remaining: "A sample cannot be replaced" } as const;

export default async function InventoryProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const product = await prisma.inventoryProduct.findUnique({
    where: { id },
    include: {
      type: true,
      group: true,
      entity: { select: { id: true, name: true, type: true } },
      kitComponents: { orderBy: { sortOrder: "asc" } },
      items: { include: { location: { select: { name: true } } }, orderBy: [{ status: "asc" }, { expiryDate: { sort: "asc", nulls: "last" } }] },
    },
  });
  if (!product) notFound();
  const documents = await prisma.attachmentLink.findMany({ where: { targetType: "inventory_product", targetId: id }, include: { attachment: { select: { originalFilename: true, size: true } } }, orderBy: { createdAt: "asc" } });

  const fields = product.type ? inventoryTypeFields(product.type.fieldDefinitions) : [];
  const values = product.fieldValues as Record<string, string>;
  const { total, low } = productSafetyStock(product, product.items);
  const sdsMissing = isStrictlyControlled(product.controlLevels) && !documents.some((document) => document.linkType === "sds");
  const showKit = product.type?.key === "kit" || product.kitComponents.length > 0;
  const activeLots = product.items.filter((lot) => lot.status === "active");
  const secondary = buttonStyles({ variant: "secondary", size: "md", className: "bg-surface font-medium text-moss" });
  const primary = buttonStyles({ variant: "primary", size: "md", className: "font-medium" });

  return (
    <AppShell>
      <div className="space-y-4">
        <PageHeader
          identifier={[product.brand, product.catalogNumber].filter(Boolean).join(" · ") || undefined}
          title={product.name}
          actions={<>
            {product.status === "active" ? <Link href={`/inventory/new?product=${product.id}`} className={primary}><Plus className="h-4 w-4" aria-hidden />Register stock</Link> : null}
            <Link href={`/inventory/products/${product.id}/edit`} className={secondary}><Pencil className="h-4 w-4" aria-hidden />Edit</Link>
            <PageActionsMenu>
              <Link href={`/inventory/products/merge?keep=${product.id}`}><GitMerge className="h-4 w-4" aria-hidden />Merge another product into this…</Link>
              <InventoryLifecycleMenu id={product.id} name={product.name} archived={product.status === "archived"} blockers={deleteBlockers({ lots: product.items.length })} archiveAction={setInventoryProductArchived} deleteAction={deleteInventoryProduct} />
            </PageActionsMenu>
          </>}
        />

        <section aria-label="Product summary" className="grid grid-cols-2 divide-x divide-y divide-hairline overflow-hidden rounded-[var(--ln-radius-panel)] border border-hairline bg-surface md:grid-cols-4 md:divide-y-0">
          <Fact label="Stock" value={total !== undefined ? <QuantityText quantity={total} unit={product.lowThresholdUnit} /> : <span className="text-sm text-muted">Set a safety stock to add up lots</span>} detail={product.lowThreshold != null ? <><span>Safety stock</span> <QuantityText quantity={product.lowThreshold} unit={product.lowThresholdUnit} /></> : null} />
          <Fact label="Lots" value={<span className="tabular-nums">{activeLots.length}</span>} detail={product.items.length > activeLots.length ? <><span>Archived</span> <span className="tabular-nums">{product.items.length - activeLots.length}</span></> : null} />
          <Fact label="Type" value={product.type?.label ?? (product.group ? "Not subdivided" : "To be classified")} detail={product.group ? inventoryGroupName(product.group) : null} />
          <Fact label="Attention" value={product.status === "archived" ? <span className="text-sm text-muted">Archived</span> : low || sdsMissing ? <div className="flex flex-wrap gap-1.5">{low ? <Badge tone="warning">low stock</Badge> : null}{sdsMissing ? <Badge tone="danger">SDS missing</Badge> : null}</div> : <span className="text-sm text-muted">Nothing needs attention</span>} detail={low ? adviceText[lowStockAdvice(product.groupKey)] : null} />
        </section>

        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0 space-y-4">
            <Panel title="Lots" flush>
              <DataTable
                rows={product.items}
                getRowKey={(row) => row.id}
                emptyMessage="No stock of this product yet."
                columns={[
                  { key: "lot", header: "Lot", render: (row) => <div><Link href={`/inventory/${row.id}`} className="font-semibold text-ink hover:text-moss">{row.lotNumber ?? row.aliquotCode ?? row.name}</Link>{row.vendor ? <p className="mt-0.5 text-xs text-muted">{row.vendor}</p> : null}</div> },
                  { key: "stock", header: "Stock", render: (row) => <QuantityText quantity={row.currentQuantity} unit={row.unit} recorded={row.quantityRecorded} /> },
                  { key: "expiry", header: "Expiry", render: (row) => <span className="font-mono text-xs">{row.expiryDate?.toISOString().slice(0, 10) ?? "—"}</span> },
                  { key: "location", header: "Location", render: (row) => <div><p>{row.location?.name ?? "Unassigned"}</p>{row.positionCode ? <p className="text-xs text-muted">{row.positionCode}</p> : null}</div> },
                  { key: "attention", header: "Attention", render: (row) => row.status === "archived" ? <span className="text-xs text-muted">Archived</span> : <InventoryRiskBadges flags={lotRiskFlags(row, product, product.items)} /> },
                ]}
              />
            </Panel>

            {showKit ? (
              <Panel title="Kit components">
                <InventoryKitComponents productId={product.id} components={product.kitComponents.map(({ id: componentId, name, spec, storageCondition }) => ({ id: componentId, name, spec, storageCondition }))} />
              </Panel>
            ) : null}

            <section id="documents">
              <Panel title="Documents">
                <InventoryDocuments
                  productId={product.id}
                  manualQuery={product.catalogNumber ?? product.name}
                  documents={documents.map((document) => ({ attachmentId: document.attachmentId, linkId: document.id, filename: document.attachment.originalFilename, size: document.attachment.size, kind: document.linkType }))}
                />
              </Panel>
            </section>
          </div>

          <aside aria-label="Product details" className="divide-y divide-hairline rounded-[var(--ln-radius-panel)] border border-hairline bg-surface">
            <SideSection title="Product">
              <Row label="Brand" value={product.brand} />
              <Row label="Catalog" value={product.catalogNumber} mono />
              <Row label="English name" value={product.englishName} />
              <Row label="CAS" value={product.casNumber} mono />
              {product.entity ? <Row label="Made from" value={<Link href="/entities" className="text-moss hover:underline">{product.entity.name}</Link>} /> : null}
            </SideSection>
            {fields.length ? (
              <SideSection title={product.type?.label ?? "Fields"}>
                {fields.map((field) => <Row key={field.key} label={field.label} value={values[field.key]} />)}
                {fields.every((field) => !values[field.key]) ? <p className="text-sm text-muted">Not filled in yet.</p> : null}
              </SideSection>
            ) : null}
            <SideSection title="Control level">
              {product.controlLevels.length ? <div className="flex flex-wrap gap-1.5">{product.controlLevels.map((level) => <Badge key={level} tone={isStrictlyControlled([level]) ? "danger" : "warning"}>{controlLevelName(level)}</Badge>)}</div> : <p className="text-sm text-muted">General</p>}
              {isStrictlyControlled(product.controlLevels) ? <p className="text-xs text-muted">Recorded with precise use, who took it and why; needs an SDS.</p> : null}
            </SideSection>
            {product.notes ? <SideSection title="Notes"><p className="whitespace-pre-wrap text-sm text-graphite">{product.notes}</p></SideSection> : null}
          </aside>
        </div>
      </div>
    </AppShell>
  );
}
