import { afterEach, describe, expect, it, vi } from "vitest";
import { enqueueMobileMutation, mobileMutationStatusLabel } from "./mobile-mutation-queue";
import { saveEntryDraft } from "./entry-draft-store";

afterEach(() => vi.unstubAllGlobals());
it.each(["queue", "draft"])("waits for the %s transaction and rejects an abort after request success", async (kind) => {
  const request: { result: string; onsuccess?: () => void } = { result: "key" };
  const transaction: { onabort?: () => void; oncomplete?: () => void; error: Error; objectStore: () => object } = {
    error: new Error("Transaction aborted"), objectStore: () => ({ put: () => request }),
  };
  vi.stubGlobal("window", { dispatchEvent: () => {} });
  vi.stubGlobal("indexedDB", { open: () => {
    const open: { result: object; onsuccess?: () => void } = { result: { close: () => {}, transaction: () => transaction } };
    queueMicrotask(() => open.onsuccess?.());
    return open;
  } });
  let settled = false;
  const write = kind === "queue" ? enqueueMobileMutation({ clientMutationId: "test", actionType: "step.complete", state: "pending", retryCount: 0, deviceCreatedAt: "2026-09-06", payload: { experimentId: "experiment", experimentStepId: "step" } }) : saveEntryDraft("key", { fields: {}, newFiles: [], mediaOrder: [], savedAt: "2026-09-06" });
  write.then(() => { settled = true; }, () => { settled = true; });
  await new Promise<void>((resolve) => setImmediate(resolve));
  request.onsuccess?.();
  await new Promise<void>((resolve) => setImmediate(resolve));
  expect(settled).toBe(false);
  const rejected = expect(write).rejects.toThrow(/aborted/);
  transaction.onabort?.();
  await rejected;
});

describe("mobile mutation status labels", () => {
  it("uses explicit non-color-only wording for every persistence state", () => {
    expect(["local_only", "pending", "syncing", "synced", "conflict"].map((state) => mobileMutationStatusLabel(state as never))).toEqual([
      "Saved on this device",
      "Waiting to sync",
      "Syncing",
      "Synced",
      "Sync conflict",
    ]);
  });
});
