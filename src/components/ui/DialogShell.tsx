import type { ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";
import "./dialog.css";

/**
 * The one dialog look. Put `dialogClass()` on the element that is the dialog (a native <dialog> or a role="dialog"
 * section), then DialogHeader, a `ln-dialog-body`, and optionally a `ln-dialog-footer` inside. `data-form` picks the shape:
 * - none: a centered card at every width (confirmations, short forms).
 * - "sheet": a centered card from 744 px, a bottom sheet on a phone.
 * - "drawer": on the right edge from 744 px, a bottom sheet on a phone.
 * The owner still opens it, traps focus and closes it; this is only the surface.
 */
export function dialogClass(className?: string) {
  return cn("ln-dialog", className);
}

export function DialogHeader({ title, titleId, subtitle, onClose, closeLabel = "Close", closeDisabled, children }: {
  title: ReactNode;
  titleId?: string;
  subtitle?: ReactNode;
  onClose?: () => void;
  closeLabel?: string;
  closeDisabled?: boolean;
  /** Extra controls between the title and the close button. */
  children?: ReactNode;
}) {
  return (
    <header className="ln-dialog-header">
      <div className="ln-dialog-heading">
        <h2 id={titleId}>{title}</h2>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
      {children}
      {onClose ? (
        <button type="button" className="ln-dialog-close focus-ring" aria-label={closeLabel} disabled={closeDisabled} onClick={onClose}>
          <X aria-hidden />
        </button>
      ) : null}
    </header>
  );
}
