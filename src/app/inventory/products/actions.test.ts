import { beforeEach, expect, it, vi } from "vitest";
import { deleteInventoryProduct, updateInventoryProduct } from "./actions";

vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("next/navigation", () => ({ redirect: (href: string) => { throw new Error(`redirect ${href}`); } }));

type Lot = { id: string; productId: string; name: string; brand: string | null; catalogNumber: string | null; managementMode: string; category: string | null };
const db = vi.hoisted(() => ({
  products: new Map<string, Record<string, unknown>>(),
  lots: [] as Lot[],
  deleted: [] as string[],
  counts: { lots: 0 },
}));

vi.mock("@/lib/db", () => {
  const tx = {
    inventoryProduct: {
      findUnique: async ({ where }: { where: { id: string } }) => db.products.get(where.id) ?? null,
      findUniqueOrThrow: async ({ where }: { where: { id: string } }) => db.products.get(where.id)!,
      findFirst: async () => null,
      findMany: async () => [],
      update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const next = { ...db.products.get(where.id), ...data };
        db.products.set(where.id, next);
        return next;
      },
      delete: async ({ where }: { where: { id: string } }) => { db.deleted.push(where.id); db.products.delete(where.id); },
    },
    inventoryItem: {
      findMany: async ({ where }: { where: { productId: string } }) => db.lots.filter((lot) => lot.productId === where.productId),
      count: async ({ where }: { where: { productId: string; managementMode?: { not: string } } }) => where.managementMode ? db.lots.filter((lot) => lot.productId === where.productId && lot.managementMode !== where.managementMode?.not).length : db.counts.lots,
      updateMany: async ({ where, data }: { where: { productId: string }; data: Partial<Lot> }) => {
        const lots = db.lots.filter((lot) => lot.productId === where.productId);
        lots.forEach((lot) => Object.assign(lot, data));
        return { count: lots.length };
      },
    },
    scientificSchemaDefinition: { findUnique: async () => ({ id: "t-ab", key: "antibody", inventoryGroupKey: "reagent", enabled: true }) },
    inventoryKitComponent: { deleteMany: async () => ({ count: 0 }) },
    attachmentLink: { count: async () => 0, deleteMany: async () => ({ count: 0 }) },
    activityLog: { create: async () => ({}) },
  };
  return { prisma: { ...tx, $transaction: async (run: (database: typeof tx) => unknown) => run(tx) } };
});

beforeEach(() => {
  db.products.clear();
  db.products.set("p1", { id: "p1", name: "Anti-CD3", englishName: null, brand: "BioLegend", catalogNumber: "100202", casNumber: null, groupKey: "reagent", typeId: "t-ab", type: { key: "antibody" }, controlLevels: [], status: "active", updatedAt: new Date(0) });
  db.lots = [
    { id: "a", productId: "p1", name: "Anti-CD3", brand: "BioLegend", catalogNumber: "100202", managementMode: "precise", category: "antibody" },
    { id: "b", productId: "p1", name: "Anti-CD3", brand: "BioLegend", catalogNumber: "100202", managementMode: "precise", category: "antibody" },
    { id: "c", productId: "p2", name: "PBS", brand: null, catalogNumber: null, managementMode: "information", category: "reagent" },
  ];
  db.deleted = [];
  db.counts.lots = 0;
});

const form = (fields: Record<string, string | string[]>) => {
  const data = new FormData();
  Object.entries(fields).forEach(([key, value]) => [value].flat().forEach((entry) => data.append(key, entry)));
  return data;
};

it("writes a renamed product's identity onto every one of its lots, and only its lots", async () => {
  await expect(updateInventoryProduct({}, form({ id: "p1", name: "Anti-human CD3", brand: "BioLegend", catalogNumber: "300438", typeId: "t-ab" }))).rejects.toThrow("redirect /inventory/products/p1");
  expect(db.lots.filter((lot) => lot.productId === "p1").map((lot) => [lot.name, lot.catalogNumber])).toEqual([["Anti-human CD3", "300438"], ["Anti-human CD3", "300438"]]);
  expect(db.lots.find((lot) => lot.id === "c")?.name).toBe("PBS");
});

it("refuses a highly toxic level while a lot is not recorded precisely (Q143)", async () => {
  db.lots[1].managementMode = "package";
  expect(await updateInventoryProduct({}, form({ id: "p1", name: "Anti-CD3", typeId: "t-ab", controlLevel: ["highly_toxic"] }))).toMatchObject({ error: expect.stringMatching(/precise/i) });
});

it("refuses to delete a product that still has lots, and deletes an unused one after its name is typed (Q149)", async () => {
  db.counts.lots = 2;
  expect(await deleteInventoryProduct({}, form({ id: "p1", confirmation: "Anti-CD3" }))).toMatchObject({ error: expect.stringMatching(/2 lots/) });
  db.counts.lots = 0;
  expect(await deleteInventoryProduct({}, form({ id: "p1", confirmation: "Anti" }))).toMatchObject({ error: expect.stringMatching(/Enter Anti-CD3/) });
  await expect(deleteInventoryProduct({}, form({ id: "p1", confirmation: "Anti-CD3" }))).rejects.toThrow("redirect /inventory/products");
  expect(db.deleted).toEqual(["p1"]);
});
