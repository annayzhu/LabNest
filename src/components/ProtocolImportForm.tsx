import { StructuredImportWorkspace } from "@/components/StructuredImportWorkspace";

/** DOCX and batch entry points share preview, confirmation and import policy. */
export function ProtocolImportForm() {
  return <StructuredImportWorkspace module="protocols" />;
}
