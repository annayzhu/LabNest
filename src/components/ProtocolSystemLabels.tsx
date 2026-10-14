import { Circle, Diamond, Square } from 'lucide-react';
import type { ProtocolCondition, ProtocolSystems } from '@/lib/structured-protocol';
import { protocolConditionLabel } from '@/lib/structured-protocol';
import './ProtocolSystems.css';

export function ProtocolSystemChoice({ systems, dimensionId, optionId }: { systems: ProtocolSystems; dimensionId: string; optionId: string }) {
  const dimension = systems.dimensions.find(d => d.id === dimensionId);
  const index = Math.max(0, dimension?.options.findIndex(o => o.id === optionId) ?? 0);
  const Shape = [Circle, Diamond, Square][index % 3];
  return <span className="protocol-system-choice" data-tone={index % 3}><Shape aria-hidden/>{dimension?.label}：{dimension?.options[index]?.label ?? '待选择'}</span>;
}
export function ProtocolSystemLegend({ systems }: { systems: ProtocolSystems }) {
  return <div className="protocol-system-legend" aria-label="体系图例">{systems.dimensions.flatMap(d => d.options.map(o => <ProtocolSystemChoice key={`${d.id}:${o.id}`} systems={systems} dimensionId={d.id} optionId={o.id}/>))}</div>;
}
export function ProtocolConditionCaption({ systems, when }: { systems: ProtocolSystems; when: ProtocolCondition }) {
  return <div className="protocol-condition-caption">适用：{protocolConditionLabel(when, systems)}</div>;
}
