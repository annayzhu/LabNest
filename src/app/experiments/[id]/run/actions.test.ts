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
