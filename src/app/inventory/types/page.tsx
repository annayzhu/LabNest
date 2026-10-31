import { AppShell } from "@/components/AppShell";
import { InventoryNav } from "@/components/InventoryNav";
import { InventoryTypeManager } from "@/components/InventoryTypeManager";
import { PageHeader } from "@/components/PageHeader";
import { prisma } from "@/lib/db";
import { inventoryGroupName, inventoryGroupNames, inventoryTypeDefaults, inventoryTypeFields, isInventoryGroupKey } from "@/lib/inventory-types";

export const dynamic = "force-dynamic";

export default async function InventoryTypesPage() {
  const [groups, types, productsByGroup, unclassified] = await Promise.all([
    prisma.inventoryGroup.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.scientificSchemaDefinition.findMany({ where: { inventoryGroupKey: { not: null } }, include: { _count: { select: { inventoryProducts: true } } }, orderBy: { label: "asc" } }),
    prisma.inventoryProduct.groupBy({ by: ["groupKey"], where: { typeId: null }, _count: { _all: true } }),
    prisma.inventoryProduct.count({ where: { groupKey: null } }),
  ]);
  const notSubdivided = new Map(productsByGroup.map((row) => [row.groupKey, row._count._all]));

  return (
    <AppShell>
      <div className="space-y-4">
        <PageHeader title="Inventory" />
        <InventoryNav current="types" />
        <InventoryTypeManager
          unclassified={unclassified}
          groups={groups.map((group) => ({ key: group.key, name: inventoryGroupName(group), label: group.label, builtInName: isInventoryGroupKey(group.key) ? inventoryGroupNames[group.key] : group.key, hidden: group.hidden, notSubdivided: notSubdivided.get(group.key) ?? 0 }))}
          types={types.map((type) => ({ id: type.id, label: type.label, groupKey: type.inventoryGroupKey!, fields: inventoryTypeFields(type.fieldDefinitions), defaults: inventoryTypeDefaults(type.defaultSettings), enabled: type.enabled, shared: type.entityType !== null, products: type._count.inventoryProducts }))}
        />
      </div>
    </AppShell>
  );
}
