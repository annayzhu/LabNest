import { beforeEach, expect, it, vi } from "vitest";
import { deleteInventoryType, mergeInventoryType } from "./actions";

vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

type Type = { id: string; key: string; label: string; entityType: string | null; inventoryGroupKey: string | null; enabled: boolean };
type Product = { id: string; typeId: string | null; groupKey: string | null };
const db = vi.hoisted(() => ({ types: [] as Type[], products: [] as Product[], lotsSynced: [] as string[] }));

vi.mock("@/lib/db", () => {
  const tx = {
    scientificSchemaDefinition: {
      findUnique: async ({ where }: { where: { id: string } }) => db.types.find((type) => type.id === where.id) ?? null,
      update: async ({ where, data }: { where: { id: string }; data: Partial<Type> }) => Object.assign(db.types.find((type) => type.id === where.id)!, data),
      delete: async ({ where }: { where: { id: string } }) => { db.types = db.types.filter((type) => type.id !== where.id); },
    },
    inventoryProduct: {
      count: async ({ where }: { where: { typeId: string } }) => db.products.filter((product) => product.typeId === where.typeId).length,
      findMany: async ({ where }: { where: { typeId: string } }) => db.products.filter((product) => product.typeId === where.typeId),
      updateMany: async ({ where, data }: { where: { typeId: string }; data: Partial<Product> }) => {
        const moved = db.products.filter((product) => product.typeId === where.typeId);
        moved.forEach((product) => Object.assign(product, data));
        return { count: moved.length };
      },
      findUniqueOrThrow: async ({ where }: { where: { id: string } }) => ({ ...db.products.find((product) => product.id === where.id)!, name: "x", englishName: null, brand: null, catalogNumber: null, casNumber: null, type: { key: "b" } }),
    },
    inventoryItem: { updateMany: async ({ where }: { where: { productId: string } }) => { db.lotsSynced.push(where.productId); return { count: 1 }; } },
    activityLog: { create: async () => ({}) },
  };
  return { prisma: { ...tx, $transaction: async (run: (database: typeof tx) => unknown) => run(tx) } };
});

beforeEach(() => {
  db.types = [
    { id: "t-buffer", key: "buffer", label: "Buffer", entityType: null, inventoryGroupKey: "reagent", enabled: true },
    { id: "t-solution", key: "solution", label: "Solutions & buffers", entityType: null, inventoryGroupKey: "reagent", enabled: true },
    { id: "t-probe", key: "probe", label: "Probe", entityType: "oligo", inventoryGroupKey: "reagent", enabled: true },
    { id: "t-strain", key: "strain", label: "Bacterial strain", entityType: null, inventoryGroupKey: "biological", enabled: true },
  ];
  db.products = [{ id: "p1", typeId: "t-buffer", groupKey: "reagent" }, { id: "p2", typeId: "t-buffer", groupKey: "reagent" }, { id: "p3", typeId: "t-probe", groupKey: "reagent" }];
  db.lotsSynced = [];
});

const form = (fields: Record<string, string>) => {
  const data = new FormData();
  Object.entries(fields).forEach(([key, value]) => data.set(key, value));
  return data;
};

it("moves every product of the merged type to the other type, its 大类 and lots following, and removes the merged type (Q141)", async () => {
  expect(await mergeInventoryType({}, form({ id: "t-buffer", targetId: "t-solution" }))).toMatchObject({ success: expect.any(String) });
  expect(db.products.filter((product) => product.id !== "p3")).toEqual([{ id: "p1", typeId: "t-solution", groupKey: "reagent" }, { id: "p2", typeId: "t-solution", groupKey: "reagent" }]);
  expect(db.lotsSynced).toEqual(["p1", "p2"]);
  expect(db.types.map((type) => type.id)).not.toContain("t-buffer");
});

it("keeps a sequence-library type for the library when it is merged away from inventory", async () => {
  await mergeInventoryType({}, form({ id: "t-probe", targetId: "t-strain" }));
  expect(db.products.find((product) => product.id === "p3")).toMatchObject({ typeId: "t-strain", groupKey: "biological" });
  expect(db.types.find((type) => type.id === "t-probe")).toMatchObject({ inventoryGroupKey: null });
});

it("refuses to delete a type that products use", async () => {
  expect(await deleteInventoryType({}, form({ id: "t-buffer" }))).toMatchObject({ error: expect.stringMatching(/2 products/) });
  expect(await deleteInventoryType({}, form({ id: "t-strain" }))).toMatchObject({ success: expect.any(String) });
  expect(db.types.map((type) => type.id)).not.toContain("t-strain");
});
