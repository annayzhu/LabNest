import { convert, normalizeUnit, units } from './calculators/quantities';
import { chipAmount, parameterLongName } from './protocol-chips';
import type { ProtocolDocument } from './protocol-document';
import { blankProtocolSystems, type ProtocolSystems } from './protocol-systems-schema';

export type ScaleRule = 'linear' | 'kept' | 'manual';
export type ScaleChange = { parameterId: string; label: string; before: string; after: string; rule: ScaleRule; note?: string };
export type ScaleTarget = { value: number; unit: string };

export const scaleRuleLabels: Record<ScaleRule, string> = { linear: '按比例', kept: '保持', manual: '请人工确认' };
/** "Tris：20 µL → 10 µL", with the rule when the amount did not simply scale, and the note. */
export const describeScaleChange = (change: ScaleChange) => `${change.label}：${change.before} → ${change.after}${change.rule === 'linear' ? '' : `（${scaleRuleLabels[change.rule]}）`}${change.note ? `，${change.note}` : ''}`;
const scaleRuleNames: Record<ScaleRule, string> = { linear: 'in proportion', kept: 'kept', manual: 'confirm by hand' };
/** The notes scaleProtocol writes, as they read on screen. */
const scaleNoteLine = (note: string) => note
  .replace(/^低于移液下限 (\S+) µL，建议配预混液或换体系$/, 'below the pipetting minimum of $1 µL; use a premix or another system')
  .replace(/^细胞数、酶活单位等不按比例换算，请人工确认$/, 'cell numbers, enzyme units and the like don’t scale; confirm by hand');
/** describeScaleChange on screen, in the interface's English source text (the Chinese interface reads describeScaleChange's wording). */
export const scaleChangeLine = (change: ScaleChange) => `${change.label}: ${change.before} → ${change.after}${change.rule === 'linear' ? '' : ` (${scaleRuleNames[change.rule]})`}${change.note ? `, ${scaleNoteLine(change.note)}` : ''}`;

/** Amounts of material scale with the reaction; settings, times, temperatures and concentrations do not; cell and unit counts need a person. */
const ruleFor = (unit: string): ScaleRule => {
  const dimension = units[normalizeUnit(unit)]?.dimension;
  if (dimension === 'volume' || dimension === 'mass' || dimension === 'amount') return 'linear';
  if (dimension === 'cells' || dimension === 'count' || dimension === 'wells' || /U\/mL|IU\/mL|TU\/mL|PFU\/mL|TCID50\/mL|VG\/mL/.test(unit)) return 'manual';
  return 'kept';
};
const round = (value: number) => Number(value.toPrecision(4));

/**
 * 体系调整: a new 反应体系 dimension with the original and the new scale; every fixed amount in the Protocol gets one value
 * per option, scaled linearly. Everything else keeps its value, and what must not scale linearly (cell numbers, enzyme units) is
 * listed for a person. Lookup values (350/600 µL → 50/80 µL) are never touched: they are the author's own table.
 */
export function scaleProtocol(document: ProtocolDocument, from: ScaleTarget, to: ScaleTarget, options: { label?: string; minPipetteUl?: number; newId: (prefix: string) => string }): { document: ProtocolDocument; changes: ScaleChange[]; dimensionId: string } {
  const factor = convert(to.value, to.unit, from.unit) / from.value;
  if (!Number.isFinite(factor) || factor <= 0) throw new Error('The new system must be a positive number in a unit that converts from the original’s');
  const next: ProtocolDocument = JSON.parse(JSON.stringify(document));
  const systems: ProtocolSystems = next.systems ?? blankProtocolSystems();
  next.systems = systems;
  const dimensionId = options.newId('dimension'), original = options.newId('option'), scaled = options.newId('option');
  systems.dimensions.push({ id: dimensionId, label: options.label ?? '反应体系', kind: 'system', options: [{ id: original, label: chipAmount(from.value, from.unit), symbol: 'triangle', tone: 0 }, { id: scaled, label: chipAmount(to.value, to.unit), symbol: 'square', tone: 1 }] });
  const changes: ScaleChange[] = [];
  const minPipette = options.minPipetteUl ?? 0.5;
  for (const parameter of systems.parameters) {
    if (parameter.source.kind !== 'fixed' || parameter.source.value === null || parameter.source.value === undefined || parameter.ownerToolId) continue;
    const label = parameterLongName(parameter, systems), before = chipAmount(parameter.source.value, parameter.source.unit);
    const rule = ruleFor(parameter.source.unit);
    if (rule === 'linear') {
      const value = round(parameter.source.value * factor);
      const tooSmall = units[normalizeUnit(parameter.source.unit)]?.dimension === 'volume' && convert(value, parameter.source.unit, 'µL') < minPipette;
      parameter.source = { kind: 'lookup', values: [{ id: options.newId('value'), when: { all: [{ dimensionId, optionId: original }] }, value: parameter.source.value, unit: parameter.source.unit }, { id: options.newId('value'), when: { all: [{ dimensionId, optionId: scaled }] }, value, unit: parameter.source.unit }] };
      changes.push({ parameterId: parameter.id, label, before, after: chipAmount(value, parameter.source.values[1].unit), rule, ...(tooSmall ? { note: `低于移液下限 ${minPipette} µL，建议配预混液或换体系` } : {}) });
    } else changes.push({ parameterId: parameter.id, label, before, after: before, rule, ...(rule === 'manual' ? { note: '细胞数、酶活单位等不按比例换算，请人工确认' } : {}) });
  }
  return { document: next, changes, dimensionId };
}

/** The model only explains: why each amount scaled or stayed, and what to check; it never produces a number. */
export function buildScalingPrompt(input: { from: ScaleTarget; to: ScaleTarget; changes: ScaleChange[]; goal?: string }) {
  const system = '你是实验方法助手。下面是把一个反应体系按比例换算的结果，数值已由程序确定，不要给出新的数值。用中文简要说明：哪些按比例换算是合理的、哪些保持不变的理由、哪些需要人工确认及为什么，并指出常见风险（如移液下限、酶量、细胞数）。150 字以内，分条。';
  const user = `研究目标：${input.goal ?? '未说明'}\n原体系：${chipAmount(input.from.value, input.from.unit)} → 新体系：${chipAmount(input.to.value, input.to.unit)}\n换算结果：\n${input.changes.map(change => `- ${change.label}：${change.before} → ${change.after}（${scaleRuleLabels[change.rule]}${change.note ? `；${change.note}` : ''}）`).join('\n')}`;
  return { system, user };
}
