'use client';
import Link from 'next/link';
import { ProtocolContentBlockView } from './ProtocolDocumentView';
import { ChipRenderContext, ChipText } from './protocol/ChipText';
import type { ProtocolStep } from '@/lib/types';
import type { ProtocolContentBlock } from '@/lib/protocol-document';
import type { ProtocolSystems } from '@/lib/protocol-systems-schema';
import { notesAmongSteps, type NotePlacement } from '@/lib/protocol-execution';
import './protocol/protocol.css';
import './execution-record.css';

/** A chosen Protocol's projected steps, as the new-Experiment form previews them. */
export type ProtocolExecutionPreviewData = { steps: ProtocolStep[]; commonBlocks: ProtocolContentBlock[]; notePlacement: NotePlacement; executionNeedsReview: boolean; systems?: ProtocolSystems };
type ExecutionRecordPreviewProtocol = { id: string; title: string; displayVersion: string; editHref?: string; execution: ProtocolExecutionPreviewData };

/** A new Experiment's 执行记录: one part per chosen Protocol, its steps in order. They become checkable once the Experiment is saved. */
export function ExecutionRecordPreview({ protocols }: { protocols: ExecutionRecordPreviewProtocol[] }) {
  return <div className="ln-execution-record" data-execution-record-preview>
    {protocols.map((protocol, index) => <ProtocolPart key={protocol.id} protocol={protocol} index={index} />)}
    <p className="ln-execution-record-note">保存后，可在这里逐步勾选、记录偏差。</p>
  </div>;
}

function ProtocolPart({ protocol, index }: { protocol: ExecutionRecordPreviewProtocol; index: number }) {
  const { execution } = protocol;
  // Notes stay where they were written among the steps; each stretch of steps between two notes is one list.
  const notes = notesAmongSteps(execution.commonBlocks, execution.notePlacement, execution.steps.map(stepRef));
  const stretches: Array<{ notes: ProtocolContentBlock[]; steps: ProtocolStep[] }> = [];
  for (const step of execution.steps) {
    const before = notes.before.get(stepRef(step));
    if (before || !stretches.length) stretches.push({ notes: before ?? [], steps: [step] });
    else stretches.at(-1)!.steps.push(step);
  }
  return <section className="ln-execution-protocol" aria-label={protocol.title}>
    <header className="ln-execution-protocol-heading">
      <span className="ln-execution-protocol-index" aria-hidden>{index + 1}</span>
      <h3>{protocol.title}</h3>
      <span className="ln-execution-protocol-meta">v{protocol.displayVersion} · {execution.steps.length} 步</span>
    </header>
    {execution.executionNeedsReview ? <p role="alert" className="ln-execution-protocol-alert">步骤归属尚未确认，请在规程编辑页整理并保存。{protocol.editHref ? <Link href={protocol.editHref}>整理步骤</Link> : null}</p> : null}
    <ChipRenderContext.Provider value={{ systems: execution.systems }}>
      {stretches.map(stretch => <div key={stepRef(stretch.steps[0])} className="ln-execution-stretch">
        <Notes blocks={stretch.notes} />
        <ol className="ln-execution-steps">
          {stretch.steps.map(step => <li key={stepRef(step)} className="ln-execution-step" data-preview-step>
            <span className="ln-execution-step-number">{step.order}.</span>
            <div className="ln-execution-step-body">
              {/* A step block is its body; only an authored title reads as a heading. */}
              {step.title_source === 'derived' ? null : <p className="ln-execution-step-title"><ChipText text={step.title} /></p>}
              {step.content_blocks?.map(block => <ProtocolContentBlockView key={block.id} block={block} executionContext />)}
            </div>
          </li>)}
        </ol>
      </div>)}
      <Notes blocks={notes.after} />
      {!execution.steps.length ? <p role="status" className="ln-execution-protocol-alert">仅有说明，尚未划分步骤；零步骤不代表实验已完成。</p> : null}
    </ChipRenderContext.Provider>
  </section>;
}

function Notes({ blocks }: { blocks: ProtocolContentBlock[] }) {
  return blocks.length ? <div className="ln-execution-note" data-preview-note>{blocks.map(block => <ProtocolContentBlockView key={block.id} block={block} executionContext />)}</div> : null;
}

/** A step's identity among the notes and in keys: its source reference, or its number when it has none. */
function stepRef(step: ProtocolStep) {
  return step.source_ref ?? String(step.order);
}
