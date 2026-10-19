import { Sparkles } from "lucide-react";
import { AiLink } from "@/components/AiAssistant";
import { StructuredImportWorkspace } from "@/components/StructuredImportWorkspace";
import { buttonStyles } from "@/components/ui/Button";

/** DOCX and batch entry points share preview, confirmation and import policy. */
export function ProtocolImportForm() {
  return <><section className="mb-4 space-y-2 border-b border-hairline pb-4" aria-label="规程导入模板"><h2 className="text-base font-semibold">按平常的写法写，或导入现有规程</h2><div className="flex flex-wrap gap-3"><a href="/api/protocols/template/docx" className={buttonStyles({ variant: "primary", size: "lg" })}>下载 Word 模板</a><AiLink href="/protocols/import/recognize" size="lg"><Sparkles className="h-4 w-4" aria-hidden />整理说明书或非模板规程</AiLink></div><p className="text-sm text-muted">一步一段，数值直接写；不同体系写“350/600 µL”，并在第一步前写一行“体系：350 µL / 600 µL”；只对部分样本的操作写“仅…：”；要记录的写“记录：浓度 ng/µL、A260/280、胶图”。导入后步骤成为步骤块、数值成为参数块，在编辑器里核对。说明书或没按模板写的规程（PDF、Word 或粘贴的文字），用“整理说明书或非模板规程”：先按写法读取，读得不好再用 AI 整理。</p></section><StructuredImportWorkspace module="protocols" /></>;
}
