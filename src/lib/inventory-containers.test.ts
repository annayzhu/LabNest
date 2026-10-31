import { beforeEach, expect, it, vi } from "vitest";
import { addInventoryContainers, commandInventoryContainer, deleteInventoryContainer } from "./inventory-containers";

type Container = { id: string; inventoryItemId: string; state: string; label: string | null; holder: string | null; location: string | null; openedAt: Date | null; componentStates: Record<string, unknown>; version: number };
const db = vi.hoisted(() => ({
  item: { id: "gas", status: "active", managementMode: "package", unit: "cylinder", currentQuantity: 1, product: { kitComponents: [] as { id: string; name: string }[] } },
  containers: [] as Container[],
  transactions: [] as { type: string; quantityChange: number; notes?: string }[],
  observations: [] as { unit: string; remaining: number }[],
  events: [] as { containerId: string; action: string; clientMutationId: string }[],
  history: { events: 0, observations: 0, materialUses: 0 },
}));

vi.mock("@/lib/db", () => {
  const tx = {
    inventoryContainerEvent: {
      findUnique: async ({ where }: { where: { clientMutationId: string } }) => db.events.find((event) => event.clientMutationId === where.clientMutationId) ?? null,
      create: async ({ data }: { data: { containerId: string; action: string; clientMutationId: string } }) => { db.events.push(data); return data; },
      count: async () => db.history.events,
    },
    inventoryContainer: {
      findUniqueOrThrow: async ({ where }: { where: { id: string } }) => ({ ...db.containers.find((container) => container.id === where.id)!, inventoryItem: db.item }),
      findFirst: async ({ where }: { where: { id: string } }) => { const container = db.containers.find((entry) => entry.id === where.id); return container ? { ...container, inventoryItem: db.item } : null; },
      updateMany: async ({ where, data }: { where: { id: string; version: number }; data: Partial<Container> & { version: unknown } }) => {
        const container = db.containers.find((entry) => entry.id === where.id && entry.version === where.version);
        if (!container) return { count: 0 };
        Object.assign(container, data, { version: container.version + 1 });
        return { count: 1 };
      },
      createMany: async ({ data }: { data: Omit<Container, "id" | "version" | "componentStates" | "holder" | "openedAt" | "state">[] }) => {
        data.forEach((entry, index) => db.containers.push({ id: `new${index}`, state: "warehouse", holder: null, openedAt: null, componentStates: {}, version: 0, ...entry }));
        return { count: data.length };
      },
      delete: async ({ where }: { where: { id: string } }) => { db.containers = db.containers.filter((container) => container.id !== where.id); },
    },
    inventoryItem: {
      findUnique: async () => db.item,
      update: async ({ data }: { data: { currentQuantity: { increment: number } } }) => { db.item.currentQuantity += data.currentQuantity.increment; },
    },
    inventoryTransaction: {
      findUnique: async () => null,
      create: async ({ data }: { data: { type: string; quantityChange: number; notes?: string } }) => { db.transactions.push(data); return data; },
    },
    inventoryObservation: {
      create: async ({ data }: { data: { unit: string; remaining: number } }) => { db.observations.push(data); return data; },
      count: async () => db.history.observations,
    },
    runMaterialUse: { count: async () => db.history.materialUses },
    experiment: { findUniqueOrThrow: async () => ({ id: "e" }) },
    activityLog: { create: async () => ({}) },
  };
  return { prisma: { ...tx, $transaction: async (run: (database: typeof tx) => unknown) => run(tx) } };
});

const cylinder = (state: string): Container => ({ id: "c1", inventoryItemId: "gas", state, label: "CO2-07", holder: null, location: "Cylinder rack", openedAt: null, componentStates: {}, version: 0 });
let key = 0;
const mutation = () => `00000000-0000-4000-8000-${String(++key).padStart(12, "0")}`;

beforeEach(() => {
  db.item.currentQuantity = 1;
  db.item.product.kitComponents = [];
  db.containers = [];
  db.transactions = [];
  db.observations = [];
  db.events = [];
  db.history = { events: 0, observations: 0, materialUses: 0 };
});

it("returns an empty cylinder to the supplier without touching stock, and a full one leaving stock (Q146)", async () => {
  db.containers = [cylinder("empty")];
  await commandInventoryContainer("gas", { action: "return_supplier", containerId: "c1", clientMutationId: mutation() });
  expect(db.containers[0].state).toBe("returned");
  expect(db.transactions).toEqual([]);

  db.containers = [cylinder("warehouse")];
  await commandInventoryContainer("gas", { action: "return_supplier", containerId: "c1", clientMutationId: mutation() });
  expect(db.containers[0].state).toBe("returned");
  expect(db.item.currentQuantity).toBe(0);
  expect(db.transactions).toMatchObject([{ quantityChange: -1 }]);
  await expect(commandInventoryContainer("gas", { action: "issue", containerId: "c1", holder: "Wang", clientMutationId: mutation() })).rejects.toThrow(/returned/i);
});

it("reads remaining gas in MPa or percent and a kit in reactions, and nothing unknown (Q146)", async () => {
  db.containers = [cylinder("held")];
  await commandInventoryContainer("gas", { action: "observe", containerId: "c1", remaining: 6.5, unit: "MPa", performedBy: "Li", clientMutationId: mutation() });
  await commandInventoryContainer("gas", { action: "observe", containerId: "c1", remaining: 40, unit: "%", performedBy: "Li", clientMutationId: mutation() });
  await commandInventoryContainer("gas", { action: "observe", containerId: "c1", remaining: 30, unit: "reactions", performedBy: "Li", clientMutationId: mutation() });
  expect(db.observations.map((entry) => entry.unit)).toEqual(["MPa", "%", "reactions"]);
  await expect(commandInventoryContainer("gas", { action: "observe", containerId: "c1", remaining: 1, unit: "psi", performedBy: "Li", clientMutationId: mutation() })).rejects.toThrow();
});

it("marks a kit component missing in one box and puts it back (Q144)", async () => {
  db.item.product.kitComponents = [{ id: "enzyme", name: "Enzyme mix" }];
  db.containers = [cylinder("warehouse")];
  await commandInventoryContainer("gas", { action: "component", containerId: "c1", componentId: "enzyme", componentState: "missing", clientMutationId: mutation() });
  expect(db.containers[0].componentStates).toEqual({ enzyme: { state: "missing" } });
  await commandInventoryContainer("gas", { action: "component", containerId: "c1", componentId: "enzyme", componentState: "present", componentLocation: "-20 °C freezer B", clientMutationId: mutation() });
  expect(db.containers[0].componentStates).toEqual({ enzyme: { state: "present", location: "-20 °C freezer B" } });
  await expect(commandInventoryContainer("gas", { action: "component", containerId: "c1", componentId: "other", componentState: "missing", clientMutationId: mutation() })).rejects.toThrow(/component/i);
});

it("relabels a container and moves it without changing its state", async () => {
  db.containers = [cylinder("held")];
  await commandInventoryContainer("gas", { action: "edit", containerId: "c1", label: "CO2-08", location: "Incubator 2", clientMutationId: mutation() });
  expect(db.containers[0]).toMatchObject({ state: "held", label: "CO2-08", location: "Incubator 2" });
});

it("adds containers with their stock movement, and deletes only one nobody has handled", async () => {
  await addInventoryContainers("gas", { count: 2, location: "Cylinder rack", clientMutationId: mutation() });
  expect(db.containers).toHaveLength(2);
  expect(db.item.currentQuantity).toBe(3);
  expect(db.transactions.at(-1)).toMatchObject({ type: "receive", quantityChange: 2 });

  db.history.events = 1;
  await expect(deleteInventoryContainer("gas", "new0")).rejects.toThrow(/1 container action/);
  db.history.events = 0;
  await deleteInventoryContainer("gas", "new0");
  expect(db.containers.map((container) => container.id)).toEqual(["new1"]);
  expect(db.item.currentQuantity).toBe(2);
  expect(db.transactions.at(-1)).toMatchObject({ type: "adjust", quantityChange: -1 });
});
