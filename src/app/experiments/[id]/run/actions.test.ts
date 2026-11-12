import { expect, it, vi } from "vitest";
import { saveProtocolRunProgress } from "./actions";

const state = vi.hoisted(() => ({ steps: [
  { id: "A", order: 1, completed: true, completedAt: new Date("2026-09-01"), allowsDeviation: true },
  { id: "B", order: 2, completed: false, completedAt: null as Date | null, allowsDeviation: true },
] }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("next/navigation", () => ({ redirect: () => {} }));
vi.mock("@/lib/db", () => {
  const tx = {
    $queryRaw: async () => [],
    experiment: { findUnique: async () => ({ id: "experiment", status: "running", purpose: "", contentJson: {}, steps: state.steps }), update: async () => ({}) },
    experimentStep: { update: async ({ where, data }: { where: { id: string }; data: object }) => Object.assign(state.steps.find((step) => step.id === where.id)!, data) },
    experimentStepEvent: { create: async () => ({}) },
    activityLog: { create: async () => ({}) },
  };
  return { prisma: { $transaction: async (run: (database: typeof tx) => unknown) => run(tx) } };
});

it("completes B without reopening A when the submitted completion snapshot is stale", async () => {
  const form = new FormData();
  form.set("experimentId", "experiment");
  form.set("completedCurrentStepId", "B");
  const response = await saveProtocolRunProgress({}, form);
  expect(response.error).toBeUndefined();
  // The public action must return the saved completion state to the caller.
  expect(response).toMatchObject({ completedStepIds: ["A", "B"], completedCurrentStepId: "B" });
});

it("completing from the record keeps the saved ticks: a step unticked elsewhere is not ticked again", async () => {
  state.steps[1].completed = false; state.steps[1].completedAt = null;
  const form = new FormData();
  form.set("experimentId", "experiment");
  form.set("intent", "complete");
  form.set("checklist", "saved");
  form.append("completedStepIds", "A"); form.append("completedStepIds", "B"); // what a stale page would still show
  const response = await saveProtocolRunProgress({}, form);
  expect(response.error).toMatch(/Complete every execution step/);
  expect(state.steps[1].completed).toBe(false);
});

it("completing from the record with every step saved completes without touching the steps", async () => {
  state.steps[1].completed = true; state.steps[1].completedAt = new Date("2026-09-02");
  const form = new FormData();
  form.set("experimentId", "experiment");
  form.set("intent", "complete");
  form.set("checklist", "saved");
  const response = await saveProtocolRunProgress({}, form);
  expect(response.error).toBeUndefined();
  expect(response).toMatchObject({ message: "Run completed.", completedStepIds: ["A", "B"] });
  expect(state.steps.map((step) => step.completed)).toEqual([true, true]);
});
