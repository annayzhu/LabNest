"use client";

import { ChevronDown, Download, FileJson2, FileText } from "lucide-react";

import { anchoredPopoverStyle, useAnchoredPopover } from "@/components/ui/useAnchoredPopover";

export function ProtocolExportMenu({ docxHref, jsonHref }: { docxHref: string; jsonHref: string }) {
  const { id, button, panel, close } = useAnchoredPopover();
  return (
    <div className="protocol-export-menu">
      <button ref={button} type="button" popoverTarget={id} aria-expanded={false} className="focus-ring">
        <Download aria-hidden />
        <span>Export</span>
        <ChevronDown className="protocol-export-menu-chevron" aria-hidden />
      </button>
      <div ref={panel} id={id} popover="auto" style={anchoredPopoverStyle} className="protocol-export-menu-popover" onClick={close}>
        <a download href={docxHref}><FileText aria-hidden /><span><strong>DOCX</strong><small>Editable document</small></span></a>
        <a download href={jsonHref}><FileJson2 aria-hidden /><span><strong>JSON</strong><small>Structured record</small></span></a>
      </div>
    </div>
  );
}
