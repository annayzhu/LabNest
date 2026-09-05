import { expect, it, vi } from "vitest";
import { updateInventoryItem } from "./actions";

vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("next/navigation", () => ({ redirect: () => { throw new Error("redirect"); } }));
vi.mock("@/lib/db", () => {
  let quantity = 10;
  const tx = {
    inventoryItem: {
      findUnique: async () => { const snapshot = { id: "item", currentQuantity: quantity, unit: "mL", locationId: null }; quantity = 8; return snapshot; },
      update: async () => { quantity = 20; },
      updateMany: async ({ where }: { where: { currentQuantity?: number } }) => ({ count: where.currentQuantity === quantity ? 1 : 0 }),
    },
    inventoryTransaction: { create: async () => ({}) },
    activityLog: { create: async () => ({}) },
  };
  return { prisma: { $transaction: async (run: (database: typeof tx) => unknown) => run(tx) } };
});

it("rejects an adjustment when stock changes after the edit reads its balance", async () => {
  const form = new FormData();
  Object.entries({ id: "item", name: "Buffer", unit: "mL", currentQuantity: "20" }).forEach(([key, value]) => form.set(key, value));
  expect(await updateInventoryItem({}, form)).toMatchObject({ error: expect.stringMatching(/changed|conflict/i) });
});
