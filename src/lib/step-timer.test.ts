import { describe, expect, it } from "vitest";
import { remainingStepTimerSeconds } from "@/lib/step-timer";

describe("remainingStepTimerSeconds", () => {
  it("subtracts elapsed wall time from a running timer", () => {
    expect(remainingStepTimerSeconds({
      remainingSeconds: 300,
      startedAt: new Date("2026-09-04T10:00:00.000Z"),
      now: new Date("2026-09-04T10:01:15.000Z"),
    })).toBe(225);
  });

  it("keeps a paused timer stable", () => {
    expect(remainingStepTimerSeconds({ remainingSeconds: 125, startedAt: null, now: new Date() })).toBe(125);
  });

  it("never becomes negative", () => {
    expect(remainingStepTimerSeconds({
      remainingSeconds: 10,
      startedAt: new Date("2026-09-04T10:00:00.000Z"),
      now: new Date("2026-09-04T10:01:00.000Z"),
    })).toBe(0);
  });
});
