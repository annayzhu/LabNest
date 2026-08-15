"use client";

import { useEffect } from "react";
import { navigationEdgeWidthPx, shouldBlockBrowserBackSwipe } from "@/lib/navigation-gesture";

export function MobileBackGestureGuard() {
  useEffect(() => {
    let startX = 0;
    let startY = 0;
    let startedAtLeftEdge = false;

    const reset = () => {
      startedAtLeftEdge = false;
    };

    const onTouchStart = (event: TouchEvent) => {
      if (event.touches.length !== 1) {
        reset();
        return;
      }
      const touch = event.touches[0];
      startX = touch.clientX;
      startY = touch.clientY;
      startedAtLeftEdge = startX <= navigationEdgeWidthPx;
    };

    const onTouchMove = (event: TouchEvent) => {
      if (!startedAtLeftEdge || event.touches.length !== 1) return;
      const touch = event.touches[0];
      if (shouldBlockBrowserBackSwipe({ startX, startY, currentX: touch.clientX, currentY: touch.clientY })) {
        event.preventDefault();
      }
    };

    document.addEventListener("touchstart", onTouchStart, { passive: true, capture: true });
    document.addEventListener("touchmove", onTouchMove, { passive: false, capture: true });
    document.addEventListener("touchend", reset, { passive: true, capture: true });
    document.addEventListener("touchcancel", reset, { passive: true, capture: true });
    return () => {
      document.removeEventListener("touchstart", onTouchStart, true);
      document.removeEventListener("touchmove", onTouchMove, true);
      document.removeEventListener("touchend", reset, true);
      document.removeEventListener("touchcancel", reset, true);
    };
  }, []);

  return null;
}
