import Link from "next/link";
import { ChevronDown, Download, FileJson2, FileText } from "lucide-react";

export function ProtocolExportMenu({ docxHref, jsonHref }: { docxHref: string; jsonHref: string }) {
  return (
    <details className="protocol-export-menu">
      <summary className="focus-ring">
        <Download aria-hidden />
        <span>Export</span>
        <ChevronDown className="protocol-export-menu-chevron" aria-hidden />
      </summary>
      <div className="protocol-export-menu-popover">
        <Link href={docxHref}><FileText aria-hidden /><span><strong>DOCX</strong><small>Editable document</small></span></Link>
        <Link href={jsonHref}><FileJson2 aria-hidden /><span><strong>JSON</strong><small>Structured record</small></span></Link>
      </div>
    </details>
  );
}
