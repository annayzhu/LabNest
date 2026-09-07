/** Directly invoked by a user gesture. Never report success without a successful browser operation. */
export async function copyCalculation(text: string): Promise<'clipboard' | 'compatibility' | 'manual'> {
  if (navigator.clipboard?.writeText) {
    try { await navigator.clipboard.writeText(text); return 'clipboard'; } catch { /* Permission can expire activation; the panel offers a fresh explicit retry. */ }
  }
  const previous = document.activeElement as HTMLElement | null;
  const field = document.createElement('textarea');
  field.value = text;
  field.readOnly = true;
  field.style.cssText = 'position:fixed;left:0;top:0;width:1px;height:1px;opacity:0;pointer-events:none';
  document.body.append(field);
  field.select(); field.setSelectionRange(0, text.length);
  try { return document.execCommand('copy') ? 'compatibility' : 'manual'; }
  catch { return 'manual'; }
  finally { field.remove(); previous?.focus({preventScroll: true}); }
}
