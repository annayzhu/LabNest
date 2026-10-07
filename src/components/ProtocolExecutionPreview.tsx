import Link from 'next/link';
import { ProtocolContentBlockView } from './ProtocolDocumentView';
import type { ProtocolStep } from '@/lib/types';
import type { ProtocolContentBlock } from '@/lib/protocol-document';
export type ProtocolExecutionPreviewData = {steps:ProtocolStep[];commonBlocks:ProtocolContentBlock[];executionNeedsReview:boolean};
export function ProtocolExecutionPreview({execution,editHref}:{execution:ProtocolExecutionPreviewData;editHref?:string}) {
  return <section data-protocol-execution-preview className="min-w-0 space-y-3 rounded-[var(--ln-radius-panel-inner)] border border-hairline p-3">
    <p className="font-semibold">{execution.steps.length} 个执行操作 · 新实验全部未完成</p>
    {execution.executionNeedsReview?<p role="alert" className="text-sm text-warning">步骤归属尚未确认，请在规程编辑页整理并保存。{editHref?<Link href={editHref} className="ml-2 underline">整理步骤</Link>:null}</p>:null}
    {execution.commonBlocks.length?<details open><summary className="focus-ring cursor-pointer text-sm text-moss">规程说明与参考（不计步）</summary><div className="mt-2 space-y-3">{execution.commonBlocks.map(block=><ProtocolContentBlockView key={block.id} block={block} executionContext/>)}</div></details>:null}
    <ol className="space-y-4">{execution.steps.map(step=><li key={step.source_ref??step.order} data-preview-step className="min-w-0"><h3 className="font-semibold">{step.order}. {step.title}</h3><div className="mt-2 min-w-0 space-y-2">{step.content_blocks?.map(block=><ProtocolContentBlockView key={block.id} block={block} executionContext/>)}</div></li>)}</ol>
    {!execution.steps.length?<p role="status" className="text-sm text-warning">仅有说明或尚未划分操作，零步骤不代表实验已完成。</p>:null}
  </section>;
}
