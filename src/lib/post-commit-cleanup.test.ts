import { describe, expect, it, vi } from "vitest";
import { runPostCommitCleanup } from "./post-commit-cleanup";

describe("post-commit cleanup", () => {
  it("returns the committed outcome with a retry warning when cleanup fails", async () => {
    const onFailure = vi.fn().mockResolvedValue(undefined);
    const run = vi.fn().mockRejectedValue(new Error("disk unavailable"));
    const warnings = await runPostCommitCleanup([
      { name: "remove stored file", run },
      { name: "refresh validation", run: async () => undefined },
    ], onFailure, { attempts: 3, retryDelayMs: 0 });

    expect(warnings).toEqual(["remove stored file failed after 3 attempts; manual cleanup is required."]);
    expect(run).toHaveBeenCalledTimes(3);
    expect(onFailure).toHaveBeenCalledWith("remove stored file", expect.any(Error));
  });
});
