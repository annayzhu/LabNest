import { describe, expect, it } from "vitest";
import { backupAlert, isBackupDue, snapshotsToKeep } from "./policy";

const at = (value: string) => new Date(value);
const stamp = (id: string, createdAt: string) => ({ id, createdAt: at(createdAt) });

describe("snapshotsToKeep", () => {
  it("keeps every backup from the last 7 days that have one, including several on the same day", () => {
    const snapshots = [
      stamp("d1-early", "2026-10-20T02:00:00"), stamp("d1", "2026-10-20T03:00:00"),
      stamp("d2", "2026-10-19T03:00:00"), stamp("d3", "2026-10-18T03:00:00"), stamp("d4", "2026-10-17T03:00:00"),
      stamp("d5", "2026-10-16T03:00:00"), stamp("d6", "2026-10-15T03:00:00"), stamp("d7", "2026-10-14T03:00:00"),
    ];
    expect([...snapshotsToKeep(snapshots)].sort()).toEqual(["d1", "d1-early", "d2", "d3", "d4", "d5", "d6", "d7"]);
  });

  it("keeps one backup per week for the 4 weeks before those days, and drops older ones", () => {
    const days = Array.from({ length: 60 }, (_, index) => {
      const date = new Date(2026, 9, 20, 3);
      date.setDate(date.getDate() - index);
      return { id: `d${index}`, createdAt: date };
    });
    const kept = snapshotsToKeep(days);
    // 7 daily copies: d0–d6 (Tue Oct 20 – Wed Oct 14). Weeks start on Monday; the newest copy left in each of the next
    // 4 weeks: d7 (Tue Oct 13, week of Oct 12), d9 (Sun Oct 11), d16 (Sun Oct 4), d23 (Sun Sep 27).
    expect([...kept].sort()).toEqual(["d0", "d1", "d2", "d3", "d4", "d5", "d6", "d7", "d9", "d16", "d23"].sort());
  });

  it("keeps a backup that is about to be restored, even when the policy would drop it", () => {
    const days = Array.from({ length: 20 }, (_, index) => ({ id: `d${index}`, createdAt: new Date(2026, 9, 20 - index, 3) }));
    expect(snapshotsToKeep(days).has("d12")).toBe(false);
    expect(snapshotsToKeep(days, ["d12"]).has("d12")).toBe(true);
  });

  it("never drops everything when backups stopped for a long time", () => {
    const old = [stamp("june", "2026-06-01T03:00:00"), stamp("may", "2026-05-01T03:00:00")];
    expect([...snapshotsToKeep(old)].sort()).toEqual(["june", "may"]);
  });
});

describe("isBackupDue", () => {
  const now = at("2026-10-20T09:00:00");
  it("is due when nothing has been backed up yet", () => expect(isBackupDue(null, null, now)).toBe(true));
  it("is not due after today's 03:00 backup", () => expect(isBackupDue(at("2026-10-20T03:00:05"), null, now)).toBe(false));
  it("catches up after sleeping through 03:00", () => expect(isBackupDue(at("2026-10-19T03:00:05"), null, now)).toBe(true));
  it("before 03:00, yesterday's backup is still current", () => expect(isBackupDue(at("2026-10-19T03:00:05"), null, at("2026-10-20T02:30:00"))).toBe(false));
  it("waits an hour before retrying a failed attempt", () => {
    expect(isBackupDue(at("2026-10-19T03:00:05"), { at: at("2026-10-20T08:30:00"), ok: false }, now)).toBe(false);
    expect(isBackupDue(at("2026-10-19T03:00:05"), { at: at("2026-10-20T07:59:00"), ok: false }, now)).toBe(true);
  });
});

describe("backupAlert", () => {
  const now = at("2026-10-20T12:00:00");
  it("is quiet within 36 hours of a good backup", () => expect(backupAlert({ lastSuccessAt: at("2026-10-19T03:00:00"), lastAttempt: { at: at("2026-10-19T03:00:00"), ok: true } }, now)).toBeNull());
  it("warns after 36 hours without a good backup", () => expect(backupAlert({ lastSuccessAt: at("2026-10-18T23:00:00"), lastAttempt: { at: at("2026-10-18T23:00:00"), ok: true } }, now)).toBe("stale"));
  it("warns when there has never been a backup", () => expect(backupAlert({ lastSuccessAt: null, lastAttempt: null }, now)).toBe("stale"));
  it("warns when the latest attempt failed, even if an older backup is recent", () => expect(backupAlert({ lastSuccessAt: at("2026-10-19T03:00:00"), lastAttempt: { at: at("2026-10-20T03:00:00"), ok: false } }, now)).toBe("failed"));
});
