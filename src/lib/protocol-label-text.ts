import { protocolLabelsZh } from './i18n';
import { parameterDisplayName, toolSpecs } from './protocol-chips';
import type { ProtocolSystems } from './protocol-systems-schema';

type Parameter = ProtocolSystems['parameters'][number];
const englishLabels = new Map(Object.entries(protocolLabelsZh).map(([english, chinese]) => [chinese, english]));

/**
 * A chip label as the interface shows it: LabNest's own Chinese labels (体积, 离心, 离心力／转速, 母液浓度, 涡旋混匀…) in English,
 * anything the author typed as is. Display only: the stored label stays, and the Chinese interface translates it back.
 */
export const protocolLabelText = (label: string) => englishLabels.get(label) ?? label;

/** parameterDisplayName for display. */
export const parameterNameText = (parameter: Parameter) => protocolLabelText(parameterDisplayName(parameter));

/** parameterLongName for display: "Centrifuge · Spin speed" for a tool field, otherwise the parameter's name. */
export function parameterLongNameText(parameter: Parameter, systems: Pick<ProtocolSystems, 'tools'>) {
  const tool = parameter.ownerToolId ? systems.tools?.find(t => t.id === parameter.ownerToolId) : undefined;
  if (!tool) return parameterNameText(parameter);
  const field = toolSpecs[tool.kind].fields.find(f => f.key === tool.fields.find(item => item.parameterId === parameter.id)?.key);
  return `${protocolLabelText(tool.method?.trim() || toolSpecs[tool.kind].label)} · ${field ? protocolLabelText(field.label) : parameterNameText(parameter)}`;
}
