export const navigationEdgeWidthPx = 24;
export const navigationSwipeThresholdPx = 10;

export function shouldBlockBrowserBackSwipe({
  startX,
  startY,
  currentX,
  currentY,
}: {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
}) {
  if (startX > navigationEdgeWidthPx) return false;
  const horizontalDistance = currentX - startX;
  const verticalDistance = Math.abs(currentY - startY);
  return horizontalDistance >= navigationSwipeThresholdPx && horizontalDistance > verticalDistance;
}
