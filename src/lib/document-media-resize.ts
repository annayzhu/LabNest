/** Widths an image settles on while dragged: thirds, halves, quarters and the full column. */
const mediaWidthSnaps = [25, 33, 50, 67, 75, 100] as const;
/** One-click sizes in the image toolbar. */
export const mediaWidthPresets = [{ label: '小', width: 33 }, { label: '中', width: 50 }, { label: '大', width: 75 }, { label: '通栏', width: 100 }] as const;
const snapDistance = 2;

/** A dragged width in percent of the column: kept within 10–100, whole numbers, settling on a snap when close unless `free` (Alt held). */
export function snapMediaWidth(raw: number, free = false): { width: number; snapped: boolean } {
  const clamped = Math.min(100, Math.max(10, Number.isFinite(raw) ? raw : 100));
  if (!free) for (const snap of mediaWidthSnaps) if (Math.abs(clamped - snap) <= snapDistance) return { width: snap, snapped: true };
  return { width: Math.round(clamped), snapped: false };
}

/** Keyboard resizing on the handle: arrows step 5 (Shift 1), Home/End jump to the smallest and full width. */
export function steppedMediaWidth(current: number, key: string, fine = false): number | undefined {
  const step = fine ? 1 : 5;
  if (key === 'ArrowRight' || key === 'ArrowUp') return Math.min(100, Math.round(current) + step);
  if (key === 'ArrowLeft' || key === 'ArrowDown') return Math.max(10, Math.round(current) - step);
  if (key === 'Home') return 10;
  if (key === 'End') return 100;
  return undefined;
}

/** How wide an image reads, in the editor and the record alike: the chosen width, or the column with tall images stopping at about a page-third high. */
export function mediaDisplayWidth(block: { widthPercent?: number; imageWidth?: number; imageHeight?: number }) {
  if (block.widthPercent !== undefined) return `${block.widthPercent}%`;
  return block.imageWidth && block.imageHeight ? `min(100%, calc(28rem * ${block.imageWidth} / ${block.imageHeight}))` : '100%';
}
