import { beforeEach, expect, it, vi } from "vitest";
import { mergeInventoryProducts, setNotDuplicate } from "./actions";

vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("next/navigation", () => ({ redirect: (href: string) => { throw new Error(`redirect ${href}`); } }));

type Product = { id: string; name: string; englishName: string | null; brand: string | null; catalogNumber: string | null; casNumber: string | null; typeId: string | null; groupKey: string | null; entityId: string | null; fieldValues: Record<string, string>; controlLevels: string[]; lowThreshold: number | null; lowThresholdUnit: string | null; notes: string | null; type: { key: string } | null };
type Lot = { id: string; productId: string; name: string; managementMode: string };
type Link = { id: string; attachmentId: string; linkType: string; targetType: string; targetId: string };
type Component = { id: string; productId: string; name: string; sortOrder: number };
const db = vi.hoisted(() => ({
  products: [] as Product[],
  lots: [] as Lot[],
  links: [] as Link[],
  components: [] as Component[],
  dismissals: [] as { firstId: string; secondId: string }[],
  logs: [] as { action: string }[],
}));

vi.mock("@/lib/db", () => {
  const product = (id: string) => db.products.find((entry) => entry.id === id) ?? null;
  const tx = {
    inventoryProduct: {
      findUnique: async ({ where }: { where: { id: string } }) => product(where.id),
      findUniqueOrThrow: async ({ where }: { where: { id: string } }) => product(where.id)!,
      update: async ({ where, data }: { where: { id: string }; data: Partial<Product> }) => Object.assign(product(where.id)!, data),
      delete: async ({ where }: { where: { id: string } }) => { db.products = db.products.filter((entry) => entry.id !== where.id); },
    },
    inventoryItem: {
      updateMany: async ({ where, data }: { where: { productId: string }; data: Partial<Lot> }) => {
        const lots = db.lots.filter((lot) => lot.productId === where.productId);
        lots.forEach((lot) => Object.assign(lot, data));
        return { count: lots.length };
      },
      count: async ({ where }: { where: { productId: { in: string[] } } }) => db.lots.filter((lot) => where.productId.in.includes(lot.productId) && lot.managementMode !== "precise").length,
    },
    attachmentLink: {
      findMany: async ({ where }: { where: { targetId: string } }) => db.links.filter((link) => link.targetId === where.targetId),
      deleteMany: async ({ where }: { where: { id: { in: string[] } } }) => { db.links = db.links.filter((link) => !where.id.in.includes(link.id)); return { count: 0 }; },
      updateMany: async ({ where, data }: { where: { targetId: string }; data: { targetId: string } }) => {
        const links = db.links.filter((link) => link.targetId === where.targetId);
        links.forEach((link) => Object.assign(link, data));
        return { count: links.length };
      },
    },
    inventoryKitComponent: {
      findFirst: async ({ where }: { where: { productId: string } }) => db.components.filter((entry) => entry.productId === where.productId).sort((a, b) => b.sortOrder - a.sortOrder)[0] ?? null,
      updateMany: async ({ where, data }: { where: { productId: string }; data: { productId: string; sortOrder: { increment: number } } }) => {
        const components = db.components.filter((entry) => entry.productId === where.productId);
        components.forEach((entry) => Object.assign(entry, { productId: data.productId, sortOrder: entry.sortOrder + data.sortOrder.increment }));
        return { count: components.length };
      },
    },
    inventoryDuplicateDismissal: {
      deleteMany: async () => ({ count: 0 }),
      createMany: async ({ data }: { data: { firstId: string; secondId: string }[] }) => {
        const fresh = data.filter((pair) => !db.dismissals.some((entry) => entry.firstId === pair.firstId && entry.secondId === pair.secondId));
        db.dismissals.push(...fresh);
        return { count: fresh.length };
      },
    },
    activityLog: { create: async ({ data }: { data: { action: string } }) => { db.logs.push(data); return data; } },
  };
  return { prisma: { ...tx, $transaction: async (run: unknown) => (typeof run === "function" ? run(tx) : Promise.all(run as Promise<unknown>[])) } };
});

const form = (fields: Record<string, string | string[]>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) for (const entry of [value].flat()) data.append(key, entry);
  return data;
};
const product = (id: string, fields: Partial<Product> = {}): Product => ({
  id, name: id, englishName: null, brand: null, catalogNumber: null, casNumber: null, typeId: null, groupKey: "reagent", entityId: null,
  fieldValues: {}, controlLevels: [], lowThreshold: null, lowThresholdUnit: null, notes: null, type: null, ...fields,
});

beforeEach(() => {
  db.products = [
    product("keep", { name: "Anti-CD3", brand: "BioLegend", catalogNumber: "300438", controlLevels: ["hazardous"] }),
    product("other", { name: "anti CD3 (old)", brand: "biolegend", catalogNumber: "300-438", casNumber: "x", lowThreshold: 50, lowThresholdUnit: "µL" }),
  ];
  db.lots = [
    { id: "lot-1", productId: "keep", name: "Anti-CD3", managementMode: "precise" },
    { id: "lot-2", productId: "other", name: "anti CD3 (old)", managementMode: "precise" },
  ];
  db.links = [
    { id: "l1", attachmentId: "sds", linkType: "sds", targetType: "inventory_product", targetId: "keep" },
    { id: "l2", attachmentId: "sds", linkType: "sds", targetType: "inventory_product", targetId: "other" },
    { id: "l3", attachmentId: "manual", linkType: "product_manual", targetType: "inventory_product", targetId: "other" },
  ];
  db.components = [{ id: "k1", productId: "keep", name: "Buffer A", sortOrder: 1 }, { id: "k2", productId: "other", name: "Buffer B", sortOrder: 1 }];
  db.dismissals = [];
  db.logs = [];
});

it("moves the other product's lots, documents and components onto the kept one and removes it (Q155)", async () => {
  await expect(mergeInventoryProducts({}, form({ keepId: "keep", otherId: "other" }))).rejects.toThrow("redirect /inventory/products/keep");
  expect(db.products.map((entry) => entry.id)).toEqual(["keep"]);
  expect(db.products[0]).toMatchObject({ name: "Anti-CD3", casNumber: "x", lowThreshold: 50, lowThresholdUnit: "µL", controlLevels: ["hazardous"] });
  expect(db.lots.map((lot) => [lot.id, lot.productId, lot.name])).toEqual([["lot-1", "keep", "Anti-CD3"], ["lot-2", "keep", "Anti-CD3"]]);
  expect(db.links.map((link) => [link.id, link.targetId])).toEqual([["l1", "keep"], ["l3", "keep"]]);
  expect(db.components.map((entry) => [entry.name, entry.productId, entry.sortOrder])).toEqual([["Buffer A", "keep", 1], ["Buffer B", "keep", 2]]);
  expect(db.logs.map((log) => log.action)).toEqual(["merge"]);
});

it("asks which safety stock stays when both products set a different one", async () => {
  db.products[0].lowThreshold = 20; db.products[0].lowThresholdUnit = "µL";
  expect(await mergeInventoryProducts({}, form({ keepId: "keep", otherId: "other" }))).toMatchObject({ error: "Choose which safety stock to keep." });
  expect(db.products).toHaveLength(2);
  await expect(mergeInventoryProducts({}, form({ keepId: "keep", otherId: "other", safetyStock: "other" }))).rejects.toThrow("redirect");
  expect(db.products[0]).toMatchObject({ lowThreshold: 50, lowThresholdUnit: "µL" });
});

it("refuses a merge that would make imprecisely recorded stock strictly controlled", async () => {
  db.products[1].controlLevels = ["highly_toxic"];
  db.lots[0].managementMode = "package";
  expect(await mergeInventoryProducts({}, form({ keepId: "keep", otherId: "other" }))).toMatchObject({ error: expect.stringMatching(/precise/) });
  expect(db.products).toHaveLength(2);
});

it("marks every pair in a group as not duplicates, once", async () => {
  expect(await setNotDuplicate({}, form({ id: ["lot-b", "lot-a", "lot-c"] }))).toMatchObject({ success: expect.any(String) });
  await setNotDuplicate({}, form({ id: ["lot-a", "lot-b"] }));
  expect(db.dismissals).toEqual([{ firstId: "lot-a", secondId: "lot-b" }, { firstId: "lot-b", secondId: "lot-c" }, { firstId: "lot-a", secondId: "lot-c" }]);
});
