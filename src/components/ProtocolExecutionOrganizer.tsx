'use client';
import { useState } from 'react';
import { ProtocolContentBlockView } from './ProtocolDocumentView';
import { formInputClass } from './forms';
import { projectProtocolDocument, type ProtocolDocument } from '@/lib/protocol-document';
import { confirmExecutionRoles, proposeExecutionRoles, executionBlockText } from '@/lib/protocol-execution';

/** Source ownership editor; saves the same document that projects into stepsJson. */
export function ProtocolExecutionOrganizer({document,onChange}:{document:ProtocolDocument;onChange:(document:ProtocolDocument)=>void}) {
  const projection=projectProtocolDocument(document);
  const [organizing,setOrganizing]=useState(false);
  const blocks=proposeExecutionRoles(document);
  const save=(next:typeof blocks)=>onChange({...confirmExecutionRoles(document,next),executionConfirmed:false});
  return <details className="my-4 rounded-[var(--ln-radius-panel-inner)] border border-hairline p-3" data-execution-organizer>
    <summary className="focus-ring cursor-pointer font-semibold text-moss">执行步骤划分 · {projection.steps.length} 个操作{projection.executionNeedsReview?' · 待确认':''}</summary>
    <p className="my-2 text-sm leading-6 text-muted">一个操作只有一个完成状态。标题下的说明、列表、表格和图片可归入同一步；用量说明、计算依据和参考资料可标为说明。下方格式推定只用于预览，确认并保存后才可创建新实验。</p>
    {!organizing?<button type="button" className="focus-ring min-h-11 rounded-[var(--ln-radius-control-md)] border border-hairline px-3 text-sm text-moss" onClick={()=>setOrganizing(true)}>整理／拆分步骤</button>:<>
      <ol className="space-y-3" data-execution-block-list>{blocks.map((block,index)=>{
        const role=block.execution!;
        const prior=blocks.slice(0,index).filter(candidate=>candidate.execution?.role==='step');
        return <li key={block.id} className="min-w-0 rounded-[var(--ln-radius-control-md)] border border-hairline p-3">
          <div className="mb-2 flex flex-wrap gap-2"><label className="min-w-0 flex-1 text-xs">第 {index+1} 块的归属<select aria-label={`第 ${index+1} 块的归属`} className={formInputClass} value={role.role==='detail'?role.stepId:role.role} onChange={event=>{
            const value=event.target.value;
            const execution=value==='step'?{role:'step' as const,stepId:block.id,title:role.title??(block.type==='heading'||block.type==='checklist'?executionBlockText(block).replace(/^\d+[.、)]\s*/, '').trim():'')}:value==='info'?{role:'info' as const}:{role:'detail' as const,stepId:value};
            save(blocks.map(candidate=>candidate.id===block.id?{...candidate,execution}:candidate));
          }}><option value="step">独立执行步骤</option><option value="info">说明／参考（不计步）</option>{prior.map(candidate=><option key={candidate.id} value={candidate.execution?.stepId??candidate.id}>归入：{candidate.execution?.title||'Step'}</option>)}</select></label>
          {role.role==='step'?<label className="min-w-0 flex-1 text-xs">短标题（空白时使用 Step 编号）<input aria-label={`第 ${index+1} 块的步骤标题`} className={formInputClass} value={role.title??''} onChange={event=>save(blocks.map(candidate=>candidate.id===block.id?{...candidate,execution:{...role,title:event.target.value}}:candidate))}/></label>:null}</div>
          <div className="min-w-0 overflow-hidden text-sm"><ProtocolContentBlockView block={block} executionContext/></div>
        </li>;
      })}</ol>
      <button type="button" className="focus-ring mt-3 min-h-11 rounded-[var(--ln-radius-control-md)] bg-moss px-3 text-sm text-white" onClick={()=>{onChange(confirmExecutionRoles(document,blocks));setOrganizing(false);}}>确认以上划分</button>
    </>}
    {!projection.steps.length?<p role="status" className="mt-2 text-sm text-warning">尚无执行步骤。原文保留；零步骤不表示实验完成。</p>:null}
  </details>;
}
