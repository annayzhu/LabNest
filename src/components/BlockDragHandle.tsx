"use client";

import { GripVertical } from "lucide-react";

export function BlockDragHandle({
  onDragStart,
  onDragEnd,
}: {
  onDragStart: (event: React.DragEvent<HTMLButtonElement>) => void;
  onDragEnd: () => void;
}) {
  return <button
    type="button"
    draggable
    data-block-drag-handle
    onDragStart={onDragStart}
    onDragEnd={onDragEnd}
    aria-label="Drag to reorder block"
    title="Drag to reorder block"
    className="focus-ring cursor-grab touch-none rounded-[5px] p-1 text-muted hover:bg-stone hover:text-ink active:cursor-grabbing"
  >
    <GripVertical className="h-3.5 w-3.5" aria-hidden />
  </button>;
}
