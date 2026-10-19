import { optionMarks } from '@/lib/protocol-chips';
import { systemLabelText } from '@/lib/protocol-conditions';
import type { ProtocolSystems } from '@/lib/structured-protocol';
import { SystemMark } from './protocol/SystemMark';
import './ProtocolSystems.css';
import './protocol/protocol.css';

/** The adopted option of one dimension, marked exactly as in the Protocol's legend: symbol, colour and words. */
export function ProtocolSystemChoice({ systems, dimensionId, optionId }: { systems: ProtocolSystems; dimensionId: string; optionId: string }) {
  const dimension = systems.dimensions.find(d => d.id === dimensionId);
  const option = dimension?.options.find(o => o.id === optionId);
  const mark = optionMarks(systems).get(`${dimensionId}:${optionId}`);
  return <span className="protocol-system-choice">{mark?.symbol ? <SystemMark mark={mark} /> : null}{systemLabelText(dimension?.label ?? '')}{`: ${option ? systemLabelText(option.label) : 'not chosen'}`}</span>;
}
