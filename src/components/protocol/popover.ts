'use client';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';

/** What a floating panel sits next to: an element (it follows scrolling) or a fixed caret position. */
export type PopoverAnchor = HTMLElement | { top: number; left: number; bottom: number };

/** Popover placement next to its anchor: below when there is room, otherwise above; never off-screen. */
export function useAnchoredPosition(anchor: PopoverAnchor | null, panel: React.RefObject<HTMLElement | null>, deps: unknown[] = []) {
  const [style, setStyle] = useState<React.CSSProperties>({ visibility: 'hidden' });
  useLayoutEffect(() => {
    const place = () => {
      const element = panel.current;
      if (!anchor || !element || (anchor instanceof HTMLElement && !anchor.isConnected)) return;
      const rect = anchor instanceof HTMLElement ? anchor.getBoundingClientRect() : anchor, width = element.offsetWidth, height = element.offsetHeight;
      const below = rect.bottom + 6 + height <= window.innerHeight - 8 || rect.top < height + 14;
      setStyle({ top: below ? rect.bottom + 6 : Math.max(8, rect.top - height - 6), left: Math.max(8, Math.min(rect.left, window.innerWidth - width - 8)), visibility: 'visible' });
    };
    place();
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    return () => { window.removeEventListener('scroll', place, true); window.removeEventListener('resize', place); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anchor, panel, ...deps]);
  return style;
}

/** Closes on Escape or a press outside both the panel and its anchor. */
export function useDismiss(panel: React.RefObject<HTMLElement | null>, anchor: PopoverAnchor | null, onClose: () => void) {
  const close = useRef(onClose);
  useEffect(() => { close.current = onClose; });
  useEffect(() => {
    const press = (event: PointerEvent) => { const target = event.target as Node; if (!panel.current?.contains(target) && !(anchor instanceof HTMLElement && anchor.contains(target))) close.current(); };
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape') { event.preventDefault(); close.current(); } };
    document.addEventListener('pointerdown', press, true);
    document.addEventListener('keydown', key, true);
    return () => { document.removeEventListener('pointerdown', press, true); document.removeEventListener('keydown', key, true); };
  }, [panel, anchor]);
}
