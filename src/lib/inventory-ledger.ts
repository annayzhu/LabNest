// How a stock movement reads in a lot's ledger (Q195). A container's take-out, return or emptying is joined to its
// container event through the mutation key both share, so the row names who had it and where it was put. A change of
// location reads as a move. The notes the system wrote itself, which carried a container's code or even its database
// ID, are left out; the records keep them unchanged.

type Movement = { type: string; quantityChange: number; performedBy: string | null; notes: string | null };
type ContainerEvent = { action: string; snapshotJson: unknown };
type Side = { holder?: string | null; location?: string | null };

export type LedgerEntry = {
  /** Replaces the movement type's name; absent, the type is shown. */
  label?: string;
  handler: string | null;
  /** Where a container was put on its way out, or back. */
  put?: { place: string; back: boolean };
  /** What someone wrote; null when only a generated note was there. */
  note: string | null;
};

const containerLabels: Record<string, string> = { issue: "Taken out", return: "Returned to store", empty: "Used up", return_supplier: "Returned to supplier" };
const containerNote = /^Container .+: ([a-z_]+); physical movement, not inferred liquid consumption\.$/;
const deletedNote = /^Container .+ deleted; it was registered by mistake\.$/;
const moveNotes = new Set(["Location transfer generated from the Inventory Item edit form.", "Location transfer from a bulk move."]);

export function ledgerEntry(movement: Movement, event?: ContainerEvent | null): LedgerEntry {
  const notes = movement.notes?.trim() ?? "";
  const action = event?.action ?? notes.match(containerNote)?.[1];
  if (action && containerLabels[action]) {
    const { before = {}, after = {} } = (event?.snapshotJson ?? {}) as { before?: Side; after?: Side };
    const taker = action === "issue" ? after.holder : before.holder;
    const moved = after.location && after.location !== before.location;
    return {
      label: containerLabels[action],
      handler: movement.performedBy ?? taker ?? null,
      ...(moved && (action === "issue" || action === "return") ? { put: { place: after.location!, back: action === "return" } } : {}),
      note: null,
    };
  }
  if (deletedNote.test(notes)) return { label: "Container deleted", handler: movement.performedBy, note: null };
  if (movement.type === "transfer" && movement.quantityChange === 0) return { label: "Moved", handler: movement.performedBy, note: moveNotes.has(notes) ? null : notes || null };
  return { handler: movement.performedBy, note: notes || null };
}
