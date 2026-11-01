import { describe, expect, it } from "vitest";
import { labDate, labDateTime } from "./lab-time";

describe("lab time", () => {
  it("reads a timestamp in Beijing time", () => {
    // 11:33 UTC is 19:33 in Beijing, the time the ledger showed as 11:33 before.
    expect(labDateTime(new Date("2026-10-31T11:33:00Z"))).toBe("2026-10-31 19:33");
  });

  it("moves to the next day after 16:00 UTC", () => {
    expect(labDateTime("2026-10-31T17:05:00Z")).toBe("2026-11-01 01:05");
    expect(labDate("2026-10-31T17:05:00Z")).toBe("2026-11-01");
  });

  it("writes midnight as 00, not 24", () => {
    expect(labDateTime("2026-10-31T16:00:00Z")).toBe("2026-11-01 00:00");
  });
});
