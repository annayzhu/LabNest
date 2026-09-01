import { describe, expect, it, vi } from "vitest";
import { runPostCommitCleanup } from "./post-commit-cleanup";

describe("post-commit cleanup", () => {
  it("returns the committed outcome with a retry warning when cleanup fails", async () => {
    const onFailure = vi.fn().mockResolvedValue(undefined);
    const warnings = await runPostCommitCleanup([
      { name: "remove stored file", run: async () => { throw new Error("disk unavailable"); } },
      { name: "refresh validation", run: async () => undefined },
    ], onFailure);

    expect(warnings).toEqual(["remove stored file is pending retry."]);
    expect(onFailure).toHaveBeenCalledWith("remove stored file", expect.any(Error));
  });
});
