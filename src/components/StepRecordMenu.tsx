"use client";

import Link from "next/link";
import { NotebookPen } from "lucide-react";
import { useRef } from "react";
import { useI18n } from "@/components/I18nProvider";
import { MeasurementCapture, type MeasurementCaptureHandle } from "@/components/MeasurementCapture";
import { anchoredPopoverStyle, useAnchoredPopover } from "@/components/ui/useAnchoredPopover";

/** What can be recorded at a step, as a menu: it reads as the choices of “Record”, not as more tools beside it. */
export function StepRecordMenu({ experimentId, step }: { experimentId: string; step: { id: string; title: string; order: number } }) {
  const { locale } = useI18n();
  const { id, button, panel, close } = useAnchoredPopover();
  const measurement = useRef<MeasurementCaptureHandle>(null);

  return <>
    <button ref={button} type="button" popoverTarget={id} className="focus-ring flex min-h-11 items-center justify-center gap-1 rounded-lg border border-hairline px-2 text-sm text-moss"><NotebookPen className="h-4 w-4" aria-hidden />{locale === "zh" ? "记录" : "Record"}</button>
    <div ref={panel} id={id} popover="auto" onClick={close} style={anchoredPopoverStyle} className="ln-actions-menu ln-step-record-menu min-w-44 rounded-[var(--ln-radius-panel-inner)] border border-hairline bg-surface p-1 shadow-soft">
      <Link onClick={() => window.dispatchEvent(new Event("labnest:preserve-run-draft"))} href={`/entries/new?mode=capture&experiment=${experimentId}&step=${step.id}`}>Add an observation</Link>
      <button type="button" onClick={() => measurement.current?.open()}>Measurement</button>
      <a href="#result-recording">Fill in results</a>
    </div>
    <MeasurementCapture key={step.id} ref={measurement} returnFocusTo={button} experimentId={experimentId} step={step} />
  </>;
}
