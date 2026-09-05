import { expect, it, vi } from "vitest";
import { createEmptyProtocolDocument } from "@/lib/protocol-document";
import { saveProtocolDocument } from "./actions";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("next/navigation", () => ({ redirect: () => { throw new Error("redirect"); } }));
vi.mock("@/lib/db", () => {
  const count = async () => 0;
  const tx = {
    protocol: { update: async () => ({}) },
    protocolVersion: {
      findUnique: async () => ({ id: "version", protocolId: "protocol", reviewStage: "draft", protocol: { scope: "general" } }),
      findFirst: async () => null,
      update: async () => ({}),
      // A competing request committed Reviewed after this request read Draft.
      updateMany: async ({ where }: { where: { reviewStage?: string } }) => ({ count: where.reviewStage === "reviewed" ? 1 : 0 }),
    },
    project: { count }, experiment: { count }, result: { count }, attachment: { count },
    researchPlanProtocol: { deleteMany: async () => ({}) },
    attachmentLink: { updateMany: async () => ({}) },
    itemLink: { deleteMany: async () => ({}) },
    activityLog: { create: async () => ({}) },
  };
  return { prisma: { ...tx, $transaction: async (run: (database: typeof tx) => unknown) => run(tx) } };
});

it("rejects a stale draft save after the version has been reviewed", async () => {
  const form = new FormData();
  Object.entries({ protocolId: "protocol", versionId: "version", canonicalTitle: "Extraction", availability: "active", reviewStage: "draft", displayVersion: "1.0", uploadDraftId: "draft", contentJson: JSON.stringify(createEmptyProtocolDocument()) }).forEach(([key, value]) => form.set(key, value));
  expect(await saveProtocolDocument({}, form)).toMatchObject({ error: expect.stringMatching(/changed|conflict/i) });
});
