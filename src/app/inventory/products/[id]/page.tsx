import Link from "next/link";
import { notFound } from "next/navigation";
import { GitMerge, Pencil, Plus } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { InventoryBackLink } from "@/components/InventoryBackLink";
import { InventoryDocuments } from "@/components/InventoryDocuments";
import { InventoryNav } from "@/components/InventoryNav";
import { ProductSequences } from "@/components/ProductSequences";
import { Panel, QuantityText, Row, SideSection } from "@/components/InventoryDetail";
import { InventoryKitComponents } from "@/components/InventoryKitComponents";
import { InventoryLifecycleMenu } from "@/components/InventoryLifecycleMenu";
import { InventoryRiskBadges } from "@/components/InventoryRiskBadges";
import { PageActionsMenu } from "@/components/PageActionsMenu";
import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { buttonStyles } from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import { prisma } from "@/lib/db";
import { controlLevelName, deleteBlockers, isStrictlyControlled, lotRiskFlags, lowStockAdvice, productSafetyStock, stockUnit } from "@/lib/inventory";
import { inventoryGroupName, inventoryTypeFields } from "@/lib/inventory-types";
import { sequenceKind } from "@/lib/product-sequences";
import { readProductSequences } from "@/lib/product-sequences.server";
import { labDate } from "@/lib/lab-time";
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
  const [documents, sequences] = await Promise.all([
    prisma.attachmentLink.findMany({ where: { targetType: "inventory_product", targetId: id }, include: { attachment: { select: { originalFilename: true, size: true } } }, orderBy: { createdAt: "asc" } }),
    readProductSequences(prisma, product.entityId, product.type?.key),
  ]);

  const fields = product.type ? inventoryTypeFields(product.type.fieldDefinitions) : [];
  const values = product.fieldValues as Record<string, string>;
  const { low } = productSafetyStock(product, product.items);
  const sdsMissing = isStrictlyControlled(product.controlLevels) && !documents.some((document) => document.linkType === "sds");
  const showKit = product.type?.key === "kit" || product.kitComponents.length > 0;
  const activeLots = product.items.filter((lot) => lot.status === "active");
  // What is on the shelf in all, one sum per unit: "2 box", or "2 box · 500 mL" when lots are counted differently.
  const totals = [...Map.groupBy(activeLots.filter((lot) => lot.quantityRecorded), (lot) => stockUnit(lot.unit))].map(([, lots]) => ({ unit: lots[0].unit, quantity: Number(lots.reduce((sum, lot) => sum + lot.currentQuantity, 0).toFixed(6)) }));
  const flagged = product.items.map((lot) => ({ ...lot, flags: lot.status === "archived" ? [] : lotRiskFlags(lot, product, product.items) }));
  const attention = product.status === "archived" || low || sdsMissing;
  const filled = fields.filter((field) => values[field.key]);
  const identity = product.englishName || product.casNumber || (product.entity && !sequenceKind(product.type?.key));
  const aside = identity || fields.length || product.controlLevels.length || product.notes;
  const secondary = buttonStyles({ variant: "secondary", size: "md", className: "bg-surface font-medium text-moss" });
  const primary = buttonStyles({ variant: "primary", size: "md", className: "font-medium" });

  return (
    <AppShell>
      <div className="space-y-4">
        <InventoryNav current="products" />
        <div className="space-y-1">
          <InventoryBackLink href="/inventory/products" label="Products" />
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
        </div>

        {/* One line instead of four tiles: what it is and how much there is; attention only when something needs it (Q193). */}
        <div className="-mt-2 space-y-1.5">
          <p className="flex flex-wrap items-baseline gap-x-2 text-sm text-graphite">
            <span>{product.type?.label ?? (product.group ? "Not subdivided" : "To be classified")}</span>
            {product.group ? <><span aria-hidden className="text-muted">·</span><span>{inventoryGroupName(product.group)}</span></> : null}
            {totals.length ? <><span aria-hidden className="text-muted">·</span><span><span>In all</span> {totals.map((total, index) => <span key={total.unit}>{index ? " + " : ""}<QuantityText quantity={total.quantity} unit={total.unit} /></span>)}</span></> : null}
            <span aria-hidden className="text-muted">·</span><span className="tabular-nums">{`${activeLots.length} lots`}</span>
            {product.lowThreshold != null ? <><span aria-hidden className="text-muted">·</span><span className="text-muted"><span>Safety stock</span> <QuantityText quantity={product.lowThreshold} unit={product.lowThresholdUnit} /></span></> : null}
          </p>
          {attention ? (
            <p className="flex flex-wrap items-center gap-2 text-sm text-graphite">
              {product.status === "archived" ? <Badge tone="neutral">Archived</Badge> : null}
              {low ? <Badge tone="warning">low stock</Badge> : null}
              {sdsMissing ? <Badge tone="danger">SDS missing</Badge> : null}
              {low ? <span className="text-muted">{adviceText[lowStockAdvice(product.groupKey)]}</span> : null}
            </p>
          ) : null}
        </div>

        <div className={aside ? "grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_320px]" : "grid gap-4"}>
          <div className="min-w-0 space-y-4">
            <Panel title="Lots" flush>
              <DataTable
                rows={flagged}
                getRowKey={(row) => row.id}
                emptyMessage="No stock of this product yet."
                columns={[
                  { key: "lot", header: "Lot", render: (row) => <div><Link href={`/inventory/${row.id}`} className="font-semibold text-ink hover:text-moss">{row.lotNumber ?? row.aliquotCode ?? <><span>No lot number</span><span className="font-normal text-muted">{" · "}{`Registered ${labDate(row.createdAt).slice(5)}`}</span></>}</Link>{row.vendor ? <p className="mt-0.5 text-xs text-muted">{row.vendor}</p> : null}</div> },
                  { key: "stock", header: "Stock", render: (row) => <QuantityText quantity={row.currentQuantity} unit={row.unit} recorded={row.quantityRecorded} /> },
                  { key: "expiry", header: "Expiry", render: (row) => <span className="text-xs tabular-nums">{row.expiryDate?.toISOString().slice(0, 10) ?? "—"}</span> },
                  { key: "location", header: "Location", render: (row) => <div><p>{row.location?.name ?? "Unassigned"}</p>{row.positionCode ? <p className="text-xs text-muted">{row.positionCode}</p> : null}</div> },
                  ...(flagged.some((row) => row.status === "archived" || row.flags.length) ? [{ key: "attention", header: "Attention", render: (row: (typeof flagged)[number]) => row.status === "archived" ? <span className="text-xs text-muted">Archived</span> : <InventoryRiskBadges flags={row.flags} /> }] : []),
                ]}
              />
            </Panel>

            {sequenceKind(product.type?.key) || sequences.length ? (
              <Panel title="Sequences">
                <ProductSequences productId={product.id} strands={sequences} />
              </Panel>
            ) : null}

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

          {aside ? (
            <aside aria-label="Product details" className="divide-y divide-hairline rounded-[var(--ln-radius-panel)] border border-hairline bg-surface">
              {/* Brand and catalogue number already stand above the title. */}
              {identity ? (
                <SideSection title="Product">
                  <Row label="English name" value={product.englishName} />
                  <Row label="CAS" value={product.casNumber} mono />
                  {/* A sequence product's entity only holds its strands, shown under Sequences. */}
                  {product.entity && !sequenceKind(product.type?.key) ? <Row label="Made from" value={<Link href="/entities" className="text-moss hover:underline">{product.entity.name}</Link>} /> : null}
                </SideSection>
              ) : null}
              {fields.length ? (
                <SideSection title={product.type?.label ?? "Fields"}>
                  {filled.map((field) => <Row key={field.key} label={field.label} value={values[field.key]} />)}
                  {filled.length < fields.length ? <p className="text-sm"><Link href={`/inventory/products/${product.id}/edit`} className="font-medium text-moss hover:underline">Add details</Link> <span className="text-xs text-muted">{fields.filter((field) => !values[field.key]).map((field) => field.label).join(" · ")}</span></p> : null}
                </SideSection>
              ) : null}
              {product.controlLevels.length ? (
                <SideSection title="Control level">
                  <div className="flex flex-wrap gap-1.5">{product.controlLevels.map((level) => <Badge key={level} tone={isStrictlyControlled([level]) ? "danger" : "warning"}>{controlLevelName(level)}</Badge>)}</div>
                  {isStrictlyControlled(product.controlLevels) ? <p className="text-xs text-muted">Recorded with precise use, who took it and why; needs an SDS.</p> : null}
                </SideSection>
              ) : null}
              {product.notes ? <SideSection title="Notes"><p className="whitespace-pre-wrap text-sm text-graphite">{product.notes}</p></SideSection> : null}
            </aside>
          ) : null}
        </div>
      </div>
    </AppShell>
  );
}
