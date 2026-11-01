import { describe, expect, it } from "vitest";
import { formatStepTimer, remainingStepTimerSeconds } from "@/lib/step-timer";

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

describe("formatStepTimer", () => {
  it("reads minutes and seconds under an hour, hours and days beyond (Q269)", () => {
    expect(formatStepTimer(299)).toBe("04:59");
    expect(formatStepTimer(5 * 3600 + 20 * 60 + 9)).toBe("5 h 20 min");
    expect(formatStepTimer(5 * 3600 + 20 * 60, true)).toBe("5 小时 20 分");
    expect(formatStepTimer(24 * 3600)).toBe("1 d 0 h");
    expect(formatStepTimer(51 * 3600, true)).toBe("2 天 3 小时");
  });
});
