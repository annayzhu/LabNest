export type BlockDropEdge = "before" | "after";

export function reorderBlocks<T>(
  items: T[],
  sourceIndex: number,
  targetIndex: number,
  edge: BlockDropEdge,
) {
  if (
    sourceIndex < 0
    || targetIndex < 0
    || sourceIndex >= items.length
    || targetIndex >= items.length
  ) return items;

  const insertionPoint = targetIndex + (edge === "after" ? 1 : 0);
  const adjustedIndex = sourceIndex < insertionPoint ? insertionPoint - 1 : insertionPoint;
  if (adjustedIndex === sourceIndex) return items;

  const next = [...items];
  const [moved] = next.splice(sourceIndex, 1);
  next.splice(adjustedIndex, 0, moved);
  return next;
}
