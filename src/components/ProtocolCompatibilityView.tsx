import { protocolCompatibilityIssue } from '@/lib/protocol-compatibility';

export function ProtocolCompatibilityView({ value }: { value: unknown }) {
  return <section className="min-w-0 space-y-3 p-4" aria-label="规程兼容视图">
    <p role="alert" className="text-warning">{protocolCompatibilityIssue(value)}</p>
    <p>可查看并导出完整原始内容。需先完成兼容转换并核对，再建立新版本。</p>
    <details open><summary>完整原始内容（含稳定标识与附件引用）</summary><pre className="max-h-[70vh] overflow-auto whitespace-pre-wrap break-all text-sm">{JSON.stringify(value, null, 2)}</pre></details>
  </section>;
}
