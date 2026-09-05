import { expect, it, vi } from "vitest";
import { updateResult } from "./actions";

vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("next/navigation", () => ({ redirect: () => { throw new Error("redirect"); } }));
vi.mock("@/lib/db", () => ({ prisma: {
  result: {
    findUnique: async () => ({ id: "legacy", experimentId: "experiment", templateKey: "report", resultType: "Report", sourceType: "protocol_template", datasets: [], templateSnapshotJson: { templateKey: "report", result_type: "Report", fields: [{ key: "value", label: "RNA yield" }, { key: "value", label: "Protein yield" }] } }),
    update: async () => ({}),
  },
  attachmentLink: { findMany: async () => [] },
  activityLog: { create: async () => ({}) },
  $transaction: async (operations: unknown[]) => Promise.all(operations),
} }));

it("refuses even draft saves with ambiguous legacy measurement keys", async () => {
  const form = new FormData();
  Object.entries({ id: "legacy", experimentId: "experiment", title: "Result", resultType: "Report", recordStatus: "draft", sourceType: "protocol_template", qualityStatus: "not_assessed", templateValuesJson: '{"value":12}' }).forEach(([key, value]) => form.set(key, value));
  expect(await updateResult({}, form)).toMatchObject({ error: expect.stringMatching(/duplicate.*preserv/i) });
});
