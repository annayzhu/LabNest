import { describe, expect, it } from "vitest";
import { formatProtocolImportTime } from "./protocol-import-messages";

describe("audit timestamp presentation", () => {
  it("uses a declared UTC zone instead of the server/browser default", () => {
    expect(formatProtocolImportTime("2026-09-07T10:20:00.000Z", "en")).toBe("7 Sept 2026, 10:20 UTC");
    expect(formatProtocolImportTime("2026-09-07T10:20:00.000Z", "zh")).toBe("2026年9月7日 10:20 UTC");
  });
  it("does not invent a time for absent or invalid legacy evidence", () => {
    expect(formatProtocolImportTime(null, "zh")).toBe("未记录");
    expect(formatProtocolImportTime("invalid", "en")).toBe("Not recorded");
  });
});
