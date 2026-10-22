/**
 * iOS opens the keyboard only for a focus made inside a tap. ＋ focuses a hidden field during the tap; after the page
 * changes, the quick note's editor takes the focus over and the keyboard is already up, as in Notion.
 */
let held: HTMLInputElement | null = null;
let expiry: ReturnType<typeof setTimeout> | undefined;

export function holdKeyboard() {
  releaseKeyboard();
  const input = document.createElement('input');
  input.setAttribute('aria-hidden', 'true');
  input.tabIndex = -1;
  // 16px: iOS zooms the page into smaller fields.
  input.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;border:0;padding:0;font-size:16px';
  document.body.appendChild(input);
  input.focus({ preventScroll: true });
  held = input;
  expiry = setTimeout(releaseKeyboard, 5000);
}

/** Whether the hidden field still has the focus, i.e. a ＋ tap is waiting for an editor. */
export const keyboardHeld = () => held !== null && document.activeElement === held;

export function releaseKeyboard() {
  clearTimeout(expiry);
  held?.remove();
  held = null;
}
