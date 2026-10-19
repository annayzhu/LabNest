import { Sparkles } from "lucide-react";
import { AiLink } from "@/components/AiAssistant";
import { StructuredImportWorkspace } from "@/components/StructuredImportWorkspace";
import { buttonStyles } from "@/components/ui/Button";

/** DOCX and batch entry points share preview, confirmation and import policy. */
export function ProtocolImportForm() {
  return <><section className="mb-4 space-y-2 border-b border-hairline pb-4" aria-label="Protocol import template"><h2 className="text-base font-semibold">Write it the way you usually do, or import an existing Protocol</h2><div className="flex flex-wrap gap-3"><a href="/api/protocols/template/docx" className={buttonStyles({ variant: "primary", size: "lg" })}>Download the Word template</a><AiLink href="/protocols/import/recognize" size="lg"><Sparkles className="h-4 w-4" aria-hidden />Organize instructions or a non-template Protocol</AiLink></div><p className="text-sm text-muted">One paragraph per step, numbers written as they are; for different systems write “350/600 µL” and put the line “体系：350 µL / 600 µL” before the first step; start an operation for some samples only with “仅…：”; write what to record as “记录：浓度 ng/µL、A260/280、胶图”. On import, steps become step blocks and numbers become parameter blocks, to check in the editor. For instructions or a Protocol not written to the template (PDF, Word or pasted text), use “Organize instructions or a non-template Protocol”: it is first read as written, and organized with AI only if that reads badly.</p></section><StructuredImportWorkspace module="protocols" /></>;
}
