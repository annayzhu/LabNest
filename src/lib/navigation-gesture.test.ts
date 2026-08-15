import { describe, expect, it } from "vitest";
import { shouldBlockBrowserBackSwipe } from "./navigation-gesture";

describe("mobile browser back-swipe guard", () => {
  it("blocks a rightward swipe that starts at the left screen edge", () => {
    expect(shouldBlockBrowserBackSwipe({ startX: 8, startY: 120, currentX: 60, currentY: 126 })).toBe(true);
  });

  it("keeps ordinary horizontal scrolling away from the screen edge", () => {
    expect(shouldBlockBrowserBackSwipe({ startX: 80, startY: 120, currentX: 150, currentY: 124 })).toBe(false);
  });

  it("keeps vertical scrolling and taps at the screen edge", () => {
    expect(shouldBlockBrowserBackSwipe({ startX: 8, startY: 120, currentX: 14, currentY: 190 })).toBe(false);
    expect(shouldBlockBrowserBackSwipe({ startX: 8, startY: 120, currentX: 12, currentY: 121 })).toBe(false);
  });
});
