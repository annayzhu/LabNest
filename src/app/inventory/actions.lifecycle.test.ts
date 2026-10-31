import { beforeEach, expect, it, vi } from "vitest";
import { createInventoryItem, deleteInventoryItem, recordInventoryTransaction, reverseInventoryTransaction } from "./actions";

vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("next/navigation", () => ({ redirect: (href: string) => { throw new Error(`redirect ${href}`); } }));

type Movement = { id: string; inventoryItemId: string; type: string; quantityChange: number; unit: string; notes: string | null; purchaseId: string | null; reversesTransactionId: string | null; createdAt: Date };
const db = vi.hoisted(() => ({
  item: { id: "i1", name: "PBS 10x", currentQuantity: 10, unit: "mL", managementMode: "precise", quantityRecorded: true, status: "active", locationId: null as string | null, productId: "p1" },
  movements: [] as Movement[],
  counts: { materialUses: 0, receipts: 0, purchases: 0, containerActions: 0, observations: 0, aliquots: 0, sampleEvents: 0 },
  deleted: [] as string[],
}));

vi.mock("@/lib/db", () => {
  const tx = {
    inventoryItem: {
      findUnique: async () => ({ ...db.item, product: { controlLevels: [] } }),
      updateMany: async ({ where, data }: { where: { currentQuantity: number }; data: { currentQuantity: number } }) => {
        if (where.currentQuantity !== db.item.currentQuantity) return { count: 0 };
        db.item.currentQuantity = data.currentQuantity;
        return { count: 1 };
      },
      count: async () => db.counts.aliquots,
      delete: async () => { db.deleted.push("item"); },
      findFirst: async () => null,
      create: async ({ data }: { data: Record<string, unknown> }) => ({ ...data, id: "i2" }),
    },
    inventoryProduct: {
      findUnique: async () => ({ id: "p1", name: "PBS 10x", englishName: null, brand: "Gibco", catalogNumber: "10010", casNumber: null, groupKey: "reagent", status: "active", controlLevels: [], type: null }),
    },
    inventoryTransaction: {
      findUnique: async ({ where }: { where: { id: string } }) => {
        const movement = db.movements.find((entry) => entry.id === where.id);
        return movement ? { ...movement, reversedBy: db.movements.find((entry) => entry.reversesTransactionId === movement.id) ?? null, materialUse: null } : null;
      },
      count: async ({ where }: { where: { OR?: unknown } }) => db.movements.filter((entry) => !where.OR || !entry.notes?.startsWith("Opening balance")).length,
      create: async ({ data }: { data: Omit<Movement, "id" | "createdAt"> }) => {
        const movement = { ...data, id: `m${db.movements.length + 1}`, createdAt: new Date() } as Movement;
        db.movements.push(movement);
        return movement;
      },
      deleteMany: async () => { db.deleted.push("movements"); return { count: db.movements.length }; },
    },
    runMaterialUse: { count: async () => db.counts.materialUses },
    purchaseReceipt: { count: async () => db.counts.receipts },
    purchaseRequest: { count: async () => db.counts.purchases },
    inventoryContainerEvent: { count: async () => db.counts.containerActions },
    inventoryObservation: { count: async () => db.counts.observations },
    sampleLifecycleEvent: { count: async () => db.counts.sampleEvents },
    inventoryContainer: { deleteMany: async () => ({ count: 0 }) },
    attachmentLink: { deleteMany: async () => ({ count: 0 }) },
    activityLog: { create: async () => ({}) },
  };
  return { prisma: { ...tx, $transaction: async (run: (database: typeof tx) => unknown) => run(tx) } };
});

beforeEach(() => {
  db.item.currentQuantity = 10;
  db.item.unit = "mL";
  db.movements = [{ id: "m0", inventoryItemId: "i1", type: "receive", quantityChange: 10, unit: "mL", notes: "Opening balance recorded when the item was registered.", purchaseId: null, reversesTransactionId: null, createdAt: new Date() }];
  db.counts = { materialUses: 0, receipts: 0, purchases: 0, containerActions: 0, observations: 0, aliquots: 0, sampleEvents: 0 };
  db.deleted = [];
});

const form = (fields: Record<string, string>) => {
  const data = new FormData();
  Object.entries(fields).forEach(([key, value]) => data.set(key, value));
  return data;
};

it("deletes a stock item that has nothing but its opening balance, once its name is typed (Q149)", async () => {
  expect(await deleteInventoryItem({}, form({ id: "i1", confirmation: "PBS" }))).toMatchObject({ error: expect.stringMatching(/Enter PBS 10x/) });
  await expect(deleteInventoryItem({}, form({ id: "i1", confirmation: "PBS 10x" }))).rejects.toThrow("redirect /inventory");
  expect(db.deleted).toContain("item");
});

it("refuses to delete a stock item with movements or experiment use, and says to archive it", async () => {
  db.movements.push({ id: "m1", inventoryItemId: "i1", type: "consume", quantityChange: -2, unit: "mL", notes: null, purchaseId: null, reversesTransactionId: null, createdAt: new Date() });
  db.counts.materialUses = 1;
  expect(await deleteInventoryItem({}, form({ id: "i1", confirmation: "PBS 10x" }))).toMatchObject({ error: expect.stringMatching(/1 stock movement, 1 experiment material use.*Archive/) });
  expect(db.deleted).toEqual([]);
});

it("reverses a movement with the opposite quantity, links the two, restores the balance, and only once (Q150)", async () => {
  db.movements.push({ id: "m1", inventoryItemId: "i1", type: "consume", quantityChange: -4, unit: "mL", notes: null, purchaseId: null, reversesTransactionId: null, createdAt: new Date() });
  db.item.currentQuantity = 6;
  expect(await reverseInventoryTransaction({}, form({ id: "m1", reason: "Wrong bottle" }))).toMatchObject({ success: expect.any(String) });
  expect(db.item.currentQuantity).toBe(10);
  expect(db.movements.at(-1)).toMatchObject({ type: "adjust", quantityChange: 4, unit: "mL", reversesTransactionId: "m1", notes: expect.stringContaining("Wrong bottle") });
  expect(await reverseInventoryTransaction({}, form({ id: "m1" }))).toMatchObject({ error: expect.stringMatching(/already been reversed/) });
});

it("refuses an amount finer than its unit keeps, and lets the shown amount take a finer remainder (Q172)", async () => {
  db.item.unit = "瓶";
  expect(await recordInventoryTransaction("i1", {}, form({ type: "consume", quantity: "2.000001" }))).toMatchObject({ error: "瓶: whole numbers only." });
  db.item.unit = "mL";
  db.item.currentQuantity = 4.4725;
  expect(await recordInventoryTransaction("i1", {}, form({ type: "consume", quantity: "4.473" }))).toMatchObject({ success: expect.any(String) });
  expect(db.item.currentQuantity).toBe(0);
  expect(db.movements.at(-1)).toMatchObject({ type: "consume", quantityChange: -4.4725 });
});

it("records a new lot as an arrival, or as stock counted here (Q178)", async () => {
  const lot = (opening: string) => form({ productId: "p1", managementMode: "precise", currentQuantity: "3", unit: "mL", opening });
  await expect(createInventoryItem({}, lot("arrival"))).rejects.toThrow("redirect /inventory/i2");
  expect(db.movements.at(-1)).toMatchObject({ type: "receive", quantityChange: 3, notes: "Opening balance recorded when the item was registered." });
  await expect(createInventoryItem({}, lot("count"))).rejects.toThrow("redirect /inventory/i2");
  expect(db.movements.at(-1)).toMatchObject({ type: "adjust", quantityChange: 3, notes: "Opening balance counted when the item was registered." });
  expect(await createInventoryItem({}, form({ productId: "p1", managementMode: "precise", currentQuantity: "1.2345", unit: "mL" }))).toMatchObject({ error: "mL: at most 3 decimal places." });
});
