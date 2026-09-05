import { beforeEach, expect, it, vi } from "vitest";
import { POST } from "./route";
import { GET } from "./[id]/route";

const state = vi.hoisted(() => ({
  files: new Map<string, Buffer>(),
  attachment: null as Record<string, unknown> | null,
}));
vi.mock("node:fs/promises", () => ({
  mkdir: async () => {},
  writeFile: async (path: string, bytes: Buffer) => { state.files.set(path, bytes); },
  unlink: async (path: string) => { state.files.delete(path); },
  readFile: async (path: string) => {
    if (!state.files.has(path)) throw Object.assign(new Error("Missing"), { code: "ENOENT" });
    return state.files.get(path);
  },
}));
vi.mock("@/lib/db", () => {
  const database = {
    attachment: {
      create: async ({ data }: { data: Record<string, unknown> }) => (state.attachment = { ...data, id: "attachment-1" }),
      findUnique: async () => state.attachment,
    },
    result: { findUnique: async () => { throw new Error("Validation database unavailable"); } },
    attachmentLink: { findMany: async () => [] },
    activityLog: { create: async () => ({}) },
  };
  return { prisma: { ...database, $transaction: async (run: (tx: typeof database) => unknown) => run(database) } };
});
beforeEach(() => { state.files.clear(); state.attachment = null; });

it("keeps a committed original downloadable and replayable when Result validation fails", async () => {
  const request = () => {
    const form = new FormData();
    form.set("file", new File(["original measurement"], "raw.txt", { type: "text/plain" }));
    form.set("targetType", "result");
    form.set("targetId", "result-1");
    form.set("clientMutationId", "00000000-0000-4000-8000-000000000050");
    return new Request("http://test/api/attachments", { method: "POST", body: form });
  };
  const response = await POST(request());
  expect(response.status).toBe(201);
  const download = await GET(new Request("http://test/api/attachments/attachment-1"), { params: Promise.resolve({ id: "attachment-1" }) });
  expect(await download.text()).toBe("original measurement");
  expect(await (await POST(request())).json()).toMatchObject({ replay: true, attachment: { id: "attachment-1" } });
});
