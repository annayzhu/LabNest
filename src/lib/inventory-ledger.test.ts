import { describe, expect, it } from "vitest";
import { ledgerEntry } from "./inventory-ledger";

const movement = { type: "transfer", quantityChange: -1, performedBy: null, notes: "Container B-07: issue; physical movement, not inferred liquid consumption." };
const snapshot = (before: object, after: object) => ({ before, after });

describe("ledger entry", () => {
  it("reads a container take-out as who took it and where it went, without the container code", () => {
    const event = { action: "issue", snapshotJson: snapshot({ holder: null, location: "4 °C fridge" }, { holder: "Anna", location: "16F bench" }) };
    expect(ledgerEntry(movement, event)).toEqual({ label: "Taken out", handler: "Anna", put: { place: "16F bench", back: false }, note: null });
  });

  it("leaves out the place when the take-out did not move the container", () => {
    const event = { action: "issue", snapshotJson: snapshot({ holder: null, location: "Box 3" }, { holder: "Anna", location: "Box 3" }) };
    expect(ledgerEntry(movement, event)).toEqual({ label: "Taken out", handler: "Anna", note: null });
  });

  it("names who had a container that came back, and where it was put back", () => {
    const event = { action: "return", snapshotJson: snapshot({ holder: "Anna", location: "16F bench" }, { holder: null, location: "4 °C fridge" }) };
    expect(ledgerEntry({ ...movement, quantityChange: 1, notes: "Container B-07: return; physical movement, not inferred liquid consumption." }, event))
      .toEqual({ label: "Returned to store", handler: "Anna", put: { place: "4 °C fridge", back: true }, note: null });
  });

  it("keeps the person recorded on the movement over the holder", () => {
    const event = { action: "empty", snapshotJson: snapshot({ holder: null }, { holder: null }) };
    expect(ledgerEntry({ ...movement, type: "discard", performedBy: "Li" }, event)).toEqual({ label: "Used up", handler: "Li", note: null });
  });

  it("reads an old note with a database ID even when its event is missing", () => {
    const old = { ...movement, notes: "Container cmh2k1q9x0001abcdxyz12345: issue; physical movement, not inferred liquid consumption." };
    expect(ledgerEntry(old)).toEqual({ label: "Taken out", handler: null, note: null });
  });

  it("reads a location change as a move", () => {
    const move = { type: "transfer", quantityChange: 0, performedBy: null, notes: "Location transfer generated from the Inventory Item edit form." };
    expect(ledgerEntry(move)).toEqual({ label: "Moved", handler: null, note: null });
  });

  it("says a container was deleted without naming it", () => {
    const deleted = { type: "adjust", quantityChange: -1, performedBy: null, notes: "Container B-07 deleted; it was registered by mistake." };
    expect(ledgerEntry(deleted)).toEqual({ label: "Container deleted", handler: null, note: null });
  });

  it("keeps what a person wrote", () => {
    const receipt = { type: "receive", quantityChange: 2, performedBy: "Anna", notes: "Sigma order 4501" };
    expect(ledgerEntry(receipt)).toEqual({ handler: "Anna", note: "Sigma order 4501" });
  });
});
