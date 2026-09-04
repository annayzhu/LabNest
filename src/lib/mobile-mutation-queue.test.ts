import { describe, expect, it } from "vitest";
import { mobileMutationStatusLabel } from "./mobile-mutation-queue";

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
