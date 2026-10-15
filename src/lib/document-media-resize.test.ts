import { describe, expect, it } from 'vitest';
import { snapMediaWidth, steppedMediaWidth } from './document-media-resize';

describe('Resizing an image by dragging its edge', () => {
  it('settles on a half, a third or the full column when the edge comes close', () => {
    expect(snapMediaWidth(51.4)).toEqual({ width: 50, snapped: true });
    expect(snapMediaWidth(34.9)).toEqual({ width: 33, snapped: true });
    expect(snapMediaWidth(98.2)).toEqual({ width: 100, snapped: true });
  });

  it('keeps any other width as a whole percent, and holding Alt never snaps', () => {
    expect(snapMediaWidth(58.6)).toEqual({ width: 59, snapped: false });
    expect(snapMediaWidth(51.4, true)).toEqual({ width: 51, snapped: false });
  });

  it('never leaves the column or shrinks below a tenth of it', () => {
    expect(snapMediaWidth(140)).toEqual({ width: 100, snapped: true });
    expect(snapMediaWidth(3)).toEqual({ width: 10, snapped: false });
  });
});

describe('Resizing an image from the keyboard', () => {
  it('steps by 5, or 1 with Shift, and jumps to the ends with Home and End', () => {
    expect(steppedMediaWidth(50, 'ArrowRight')).toBe(55);
    expect(steppedMediaWidth(50, 'ArrowLeft', true)).toBe(49);
    expect(steppedMediaWidth(98, 'ArrowUp')).toBe(100);
    expect(steppedMediaWidth(12, 'ArrowDown')).toBe(10);
    expect(steppedMediaWidth(40, 'End')).toBe(100);
    expect(steppedMediaWidth(40, 'Tab')).toBeUndefined();
  });
});
