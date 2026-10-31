import { beforeEach, expect, it, vi } from "vitest";
import { applyProductBulk, applyStockBulk, previewStockBulk } from "./bulk-actions";

vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

type Item = { id: string; name: string; status: string; locationId: string | null; principalInvestigator: string | null; unit: string; productId: string | null; managementMode: string };
type Product = { id: string; name: string; status: string; typeId: string | null; groupKey: string | null; controlLevels: string[] };
type Container = { id: string; inventoryItemId: string; state: string; holder: string | null; location: string | null; version: number };
const db = vi.hoisted(() => ({
  items: [] as Item[],
  containers: [] as Container[],
  events: [] as { containerId: string; action: string }[],
  products: [] as Product[],
  movementsByItem: {} as Record<string, number>,
  transfers: [] as { inventoryItemId: string; fromLocationId?: string; toLocationId?: string }[],
  deleted: [] as string[],
  logs: [] as { action: string; targetType: string; metadataJson: { entries: { id: string; outcome: string }[] } }[],
}));

vi.mock("@/lib/db", () => {
  const inIds = (where: { id?: { in: string[] } }) => (entry: { id: string }) => !where.id || where.id.in.includes(entry.id);
  const tx = {
    inventoryItem: {
      findMany: async ({ where }: { where: { id: { in: string[] } } }) => db.items.filter(inIds(where)).map((item) => ({ ...item, containers: db.containers.filter((container) => container.inventoryItemId === item.id && container.state === "warehouse") })),
      updateMany: async ({ where, data }: { where: { id?: { in: string[] }; productId?: string }; data: Partial<Item> }) => {
        const matched = db.items.filter((item) => (where.productId ? item.productId === where.productId : inIds(where)(item)));
        matched.forEach((item) => Object.assign(item, data));
        return { count: matched.length };
      },
      update: async ({ where, data }: { where: { id: string }; data: Partial<Item> & { currentQuantity?: unknown } }) => { const { currentQuantity: _quantity, ...rest } = data; return Object.assign(db.items.find((item) => item.id === where.id)!, rest); },
      delete: async ({ where }: { where: { id: string } }) => { db.deleted.push(where.id); db.items = db.items.filter((item) => item.id !== where.id); },
      count: async () => 0,
    },
    inventoryTransaction: {
      count: async ({ where }: { where: { inventoryItemId: string } }) => db.movementsByItem[where.inventoryItemId] ?? 0,
      create: async ({ data }: { data: { inventoryItemId: string; fromLocationId?: string; toLocationId?: string } }) => { db.transfers.push(data); return data; },
      deleteMany: async () => ({ count: 0 }),
    },
    inventoryProduct: {
      findMany: async ({ where }: { where: { id: { in: string[] } } }) => db.products.filter(inIds(where)).map((product) => {
        const lots = db.items.filter((item) => item.productId === product.id);
        return { ...product, _count: { items: lots.length }, items: lots.filter((lot) => lot.managementMode !== "precise").map((lot) => ({ id: lot.id })) };
      }),
      updateMany: async ({ where, data }: { where: { id: { in: string[] } }; data: Partial<Product> }) => { db.products.filter(inIds(where)).forEach((product) => Object.assign(product, data)); return { count: 1 }; },
      update: async ({ where, data }: { where: { id: string }; data: Partial<Product> }) => Object.assign(db.products.find((product) => product.id === where.id)!, data),
      delete: async ({ where }: { where: { id: string } }) => { db.deleted.push(where.id); db.products = db.products.filter((product) => product.id !== where.id); },
    },
    inventoryLocation: { findUnique: async ({ where }: { where: { id: string } }) => (["shelf", "freezer"].includes(where.id) ? { id: where.id } : null) },
    inventoryContainer: {
      deleteMany: async () => ({ count: 0 }),
      findUniqueOrThrow: async ({ where }: { where: { id: string } }) => {
        const container = db.containers.find((entry) => entry.id === where.id)!;
        return { ...container, label: null, openedAt: null, componentStates: null, inventoryItem: { ...db.items.find((item) => item.id === container.inventoryItemId)!, product: null } };
      },
      updateMany: async ({ where, data }: { where: { id: string }; data: Partial<Container> & { version: unknown } }) => { const { version: _version, ...rest } = data; Object.assign(db.containers.find((entry) => entry.id === where.id)!, rest); return { count: 1 }; },
    },
    attachmentLink: { deleteMany: async () => ({ count: 0 }) },
    runMaterialUse: { count: async () => 0 },
    purchaseReceipt: { count: async () => 0 },
    purchaseRequest: { count: async () => 0 },
    inventoryContainerEvent: { count: async () => 0, create: async ({ data }: { data: { containerId: string; action: string } }) => { db.events.push(data); return data; } },
    inventoryObservation: { count: async () => 0 },
    sampleLifecycleEvent: { count: async () => 0 },
    activityLog: { create: async ({ data }: { data: (typeof db.logs)[number] }) => { db.logs.push(data); return data; } },
  };
  return { prisma: { ...tx, $transaction: async (run: (client: typeof tx) => unknown) => run(tx) } };
});

beforeEach(() => {
  db.items = [
    { id: "a", name: "PBS 10x", status: "active", locationId: "shelf", principalInvestigator: null, unit: "mL", productId: "p-pbs", managementMode: "precise" },
    { id: "b", name: "Anti-CD3", status: "active", locationId: "shelf", principalInvestigator: null, unit: "µL", productId: "p-cd3", managementMode: "package" },
    { id: "c", name: "Old buffer", status: "archived", locationId: "shelf", principalInvestigator: null, unit: "mL", productId: "p-pbs", managementMode: "precise" },
  ];
  db.products = [
    { id: "p-pbs", name: "PBS 10x", status: "active", typeId: null, groupKey: "reagent", controlLevels: [] },
    { id: "p-cd3", name: "Anti-CD3", status: "active", typeId: "t-ab", groupKey: "reagent", controlLevels: [] },
    { id: "p-empty", name: "Unused", status: "active", typeId: null, groupKey: null, controlLevels: [] },
  ];
  db.containers = ["b1", "b2", "b3"].map((id) => ({ id, inventoryItemId: "b", state: "warehouse", holder: null, location: "Shelf 2", version: 0 }));
  db.events = [];
  db.movementsByItem = { b: 2 };
  db.transfers = [];
  db.deleted = [];
  db.logs = [];
});

it("previews a bulk delete without writing anything", async () => {
  const preview = await previewStockBulk({ action: "delete", ids: ["a", "b"] });
  expect(preview.entries?.map((entry) => [entry.id, entry.outcome])).toEqual([["a", "delete"], ["b", "archive"]]);
  expect(db.deleted).toEqual([]);
  expect(db.logs).toEqual([]);
});

it("deletes only after the number of selected records is typed, archiving what is still referred to (Q152)", async () => {
  expect(await applyStockBulk({ action: "delete", ids: ["a", "b"], confirmation: "1" })).toMatchObject({ error: "Enter 2 to confirm." });
  const result = await applyStockBulk({ action: "delete", ids: ["a", "b"], confirmation: "2" });
  expect(result.entries?.map((entry) => [entry.id, entry.outcome])).toEqual([["a", "delete"], ["b", "archive"]]);
  expect(db.deleted).toEqual(["a"]);
  expect(db.items.find((item) => item.id === "b")?.status).toBe("archived");
  expect(db.logs).toHaveLength(1);
  expect(db.logs[0]).toMatchObject({ action: "bulk_delete", targetType: "inventory_item_bulk" });
});

it("moves active stock with a transfer movement each and skips archived stock (Q151, Q153)", async () => {
  const result = await applyStockBulk({ action: "move", ids: ["a", "b", "c"], locationId: "freezer" });
  expect(result.entries?.map((entry) => [entry.id, entry.outcome])).toEqual([["a", "change"], ["b", "change"], ["c", "skip"]]);
  expect(db.items.filter((item) => item.locationId === "freezer").map((item) => item.id)).toEqual(["a", "b"]);
  expect(db.transfers).toEqual([expect.objectContaining({ inventoryItemId: "a", fromLocationId: "shelf", toLocationId: "freezer" }), expect.objectContaining({ inventoryItemId: "b", fromLocationId: "shelf", toLocationId: "freezer" })]);
  expect(db.logs[0].metadataJson.entries).toHaveLength(3);
});

it("takes the oldest containers out of container stock and skips stock kept by amount (Q166)", async () => {
  expect(await applyStockBulk({ action: "takeOut", ids: ["a", "b"], count: 2 })).toMatchObject({ error: "Enter who takes them." });
  const result = await applyStockBulk({ action: "takeOut", ids: ["a", "b"], count: 2, holder: "QA", place: "B302 bench" });
  expect(result.entries?.map((entry) => [entry.id, entry.outcome])).toEqual([["a", "skip"], ["b", "change"]]);
  expect(db.containers.map((container) => [container.id, container.state, container.holder, container.location])).toEqual([["b1", "held", "QA", "B302 bench"], ["b2", "held", "QA", "B302 bench"], ["b3", "warehouse", null, "Shelf 2"]]);
  expect(db.events.map((event) => [event.containerId, event.action])).toEqual([["b1", "issue"], ["b2", "issue"]]);
  expect(db.logs[0]).toMatchObject({ action: "bulk_takeOut", metadataJson: { count: 2, holder: "QA", place: "B302 bench" } });
});

it("refuses a move to a location that no longer exists", async () => {
  expect(await applyStockBulk({ action: "move", ids: ["a"], locationId: "gone" })).toMatchObject({ error: "This storage location no longer exists." });
});

it("adds a strict control level only to products whose lots are all recorded precisely", async () => {
  const result = await applyProductBulk({ action: "addControl", ids: ["p-pbs", "p-cd3"], level: "highly_toxic" });
  expect(result.entries?.map((entry) => [entry.id, entry.outcome])).toEqual([["p-pbs", "change"], ["p-cd3", "skip"]]);
  expect(db.products.find((product) => product.id === "p-pbs")?.controlLevels).toEqual(["highly_toxic"]);
  expect(db.products.find((product) => product.id === "p-cd3")?.controlLevels).toEqual([]);
});

it("deletes products without lots and archives products that have some", async () => {
  const result = await applyProductBulk({ action: "delete", ids: ["p-empty", "p-pbs"], confirmation: "2" });
  expect(result.entries?.map((entry) => [entry.id, entry.outcome])).toEqual([["p-empty", "delete"], ["p-pbs", "archive"]]);
  expect(db.deleted).toEqual(["p-empty"]);
  expect(db.products.find((product) => product.id === "p-pbs")?.status).toBe("archived");
});
