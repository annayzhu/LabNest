import { StructuredImportWorkspace } from "@/components/StructuredImportWorkspace";

/** DOCX and batch entry points share preview, confirmation and import policy. */
export function ProtocolImportForm({ aiProviderName }: { aiProviderName?: string }) {
  return <><section className="mb-4 space-y-2 border-b border-hairline pb-4" aria-label="规程导入模板"><h2 className="text-base font-semibold">从模板开始，或导入现有规程</h2><div className="flex flex-wrap gap-3 text-sm"><a href="/api/protocols/template/docx?example=systems" className="focus-ring inline-flex min-h-11 items-center rounded-[var(--ln-radius-control-md)] bg-moss px-4 text-white">下载多体系 Word 模板</a><a href="/api/protocols/template/docx" className="focus-ring inline-flex min-h-11 items-center text-moss underline">普通规程模板</a><a href="/api/protocols/template/docx?example=execution" className="focus-ring inline-flex min-h-11 items-center text-moss underline">步骤结构示例</a></div><p className="text-sm text-muted">在多体系模板中分别填写体系、参数和操作；导入后预览各体系并确认步骤。AI 提取在上传后的预览中按需使用，普通导入不依赖 AI。</p></section><StructuredImportWorkspace module="protocols" aiProviderName={aiProviderName} /></>;
}
