import type { KeyboardEvent } from "react";

export const formInputClass = "focus-ring mt-[var(--ln-form-field-gap)] h-[var(--ln-control-height-lg)] w-full rounded-[var(--ln-radius-control-lg)] border border-hairline bg-warm px-[var(--ln-control-padding-x-sm)] text-[length:var(--ln-control-font-size-md)] text-ink";
export const formTextareaClass = "focus-ring mt-[var(--ln-form-field-gap)] min-h-24 w-full rounded-[var(--ln-radius-control-lg)] border border-hairline bg-warm px-[var(--ln-control-padding-x-sm)] py-2 text-[length:var(--ln-control-font-size-md)] leading-5 text-ink";
export const formFileInputClass = `${formInputClass} py-2`;
export const formMonoTextareaClass = `${formTextareaClass} font-mono text-xs leading-5`;
export const formLabelClass = "text-[length:var(--ln-ui-label-font-size)] font-semibold uppercase tracking-[0.08em] text-muted";

export function preventImplicitEnterSubmit(event: KeyboardEvent<HTMLFormElement>) {
  if (event.key !== "Enter" || event.defaultPrevented) return;
  const target = event.target as HTMLElement;
  if (target.tagName === "TEXTAREA" || target.isContentEditable || target.closest("button")) return;
  event.preventDefault();
}
