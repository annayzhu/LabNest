'use client';
import { createContext, useContext } from 'react';
import { RunChipContext, RunChipTrigger } from './RunChip';
import { protocolChipView, type ChipView } from '@/lib/protocol-chips';
import type { ProtocolSystems } from '@/lib/protocol-systems-schema';
import type { ProtocolSelection } from '@/lib/structured-protocol';
import { ProtocolChip } from './ProtocolChip';

type Resolved = { status: string; value?: number; unit: string };
/**
 * How chips read in a read-only view: across all systems, through a preview lens, or as one Run's adopted values.
 * `preview`: values that still depend on an unchosen system show all options instead of "pending".
 */
export type ChipRender = { systems?: ProtocolSystems; resolution?: Record<string, Resolved>; lens?: ProtocolSelection; preview?: boolean };
export const ChipRenderContext = createContext<ChipRender | null>(null);

const pending = (view: ChipView): boolean => view.type === 'pending' || (view.type === 'tool' && view.fields.some(field => pending(field.view)));

/** Text that may hold chip references; without a chip context it stays as written. */
export function ChipText({ text }: { text: string }) {
  const context = useContext(ChipRenderContext);
  const run = useContext(RunChipContext);
  if (!context || !text.includes('{{')) return <>{text}</>;
  return <>{text.split(/(\{\{[\w-]+\}\})/g).map((part, index) => {
    const id = /^\{\{([\w-]+)\}\}$/.exec(part)?.[1];
    if (!id) return part;
    const resolved = context.resolution ? protocolChipView(id, context.systems, context.resolution) : undefined;
    const view = resolved && !(context.preview && pending(resolved)) ? resolved : protocolChipView(id, context.systems);
    const calculated = context.systems?.parameters.find(p => p.id === id)?.source.kind === 'calculator';
    const chip = <ProtocolChip key={index} view={view} lens={resolved === view ? undefined : context.lens} calculated={calculated} />;
    return run ? <RunChipTrigger key={index} id={id} step={run}>{chip}</RunChipTrigger> : chip;
  })}</>;
}
