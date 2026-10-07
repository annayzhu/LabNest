import { StructuredImportWorkspace } from "@/components/StructuredImportWorkspace";

/** DOCX and batch entry points share preview, confirmation and import policy. */
export function ProtocolImportForm() {
  return <><p className="mb-3 text-sm text-muted">导入后请核对执行步骤归属；普通标题、编号和复选框不会自动确认操作含义。<a href="/api/protocols/template/docx?example=execution" className="ml-2 text-moss underline">下载步骤结构示例</a></p><StructuredImportWorkspace module="protocols" /></>;
}
