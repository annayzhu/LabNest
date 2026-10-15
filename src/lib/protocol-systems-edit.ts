import type { ProtocolCondition, ProtocolSystems } from './protocol-systems-schema';

type Predicate = { dimensionId: string; optionId: string };
const predicates = (when: ProtocolCondition) => [...(when.all ?? []), ...(when.any ?? []), ...(when.not ?? [])];

/** How many values and conditions use a dimension, or one of its options: what deleting it would change. */
export function systemReferences(systems: ProtocolSystems, uses: (p: Predicate) => boolean) {
  const values = systems.parameters.filter(p => p.source.kind === 'lookup' && p.source.values.some(v => predicates(v.when).some(uses))).length;
  const conditions = systems.rules.filter(r => predicates(r.when).some(uses)).length;
  return { values, conditions, total: values + conditions };
}

/** Remove a dimension and every reference to it; by-system values keep their first option's number. */
export function withoutDimension(systems: ProtocolSystems, dimensionId: string): ProtocolSystems {
  const dimension = systems.dimensions.find(d => d.id === dimensionId);
  const first = dimension?.options[0]?.id;
  const uses = (p: Predicate) => p.dimensionId === dimensionId;
  return { ...systems, dimensions: systems.dimensions.filter(d => d.id !== dimensionId),
    presets: systems.presets.map(preset => ({ ...preset, selections: Object.fromEntries(Object.entries(preset.selections).filter(([id]) => id !== dimensionId)) })).filter(preset => Object.keys(preset.selections).length),
    rules: systems.rules.filter(rule => !predicates(rule.when).some(uses)),
    restrictions: systems.restrictions.filter(r => !predicates(r.when).some(uses)),
    parameters: systems.parameters.map(parameter => {
      if (parameter.source.kind !== 'lookup' || !parameter.source.values.some(v => predicates(v.when).some(uses))) return parameter;
      const kept = parameter.source.values.filter(v => (v.when.all ?? []).some(p => uses(p) && p.optionId === first)).map(v => ({ ...v, when: { all: (v.when.all ?? []).filter(p => !uses(p)) } }));
      return kept.length && kept.every(v => !v.when.all.length) ? { ...parameter, source: { kind: 'fixed' as const, value: kept[0].value, unit: kept[0].unit } } : { ...parameter, source: { kind: 'lookup' as const, values: kept } };
    }),
    ...(systems.splitChoices ? { splitChoices: Object.fromEntries(Object.entries(systems.splitChoices).filter(([, id]) => id !== dimensionId)) } : {}) };
}

/**
 * Remove one option: values given for it go, and conditions stop naming it, so content kept only for it becomes common.
 * Nothing is left pointing at the option, so no step waits on a choice that no longer exists.
 */
export function withoutOption(systems: ProtocolSystems, dimensionId: string, optionId: string): ProtocolSystems {
  const uses = (p: Predicate) => p.dimensionId === dimensionId && p.optionId === optionId;
  const narrowed = (when: ProtocolCondition): ProtocolCondition => Object.fromEntries((['all', 'any', 'not'] as const).flatMap(key => {
    const kept = when[key]?.filter(p => !uses(p));
    return kept?.length ? [[key, kept]] : [];
  }));
  const conditioned = (when: ProtocolCondition) => predicates(when).length > 0;
  return { ...systems,
    dimensions: systems.dimensions.map(d => d.id === dimensionId ? { ...d, options: d.options.filter(o => o.id !== optionId) } : d),
    presets: systems.presets.map(preset => ({ ...preset, selections: Object.fromEntries(Object.entries(preset.selections).filter(([d, o]) => !(d === dimensionId && o === optionId))) })).filter(preset => Object.keys(preset.selections).length),
    rules: systems.rules.flatMap(rule => {
      if (!predicates(rule.when).some(uses)) return [rule];
      const when = narrowed(rule.when);
      return conditioned(when) || rule.optional || rule.parameterIds.length || rule.actualFields.length || rule.timerParameterId ? [{ ...rule, when }] : [];
    }),
    // A forbidden combination that needed this option can no longer happen.
    restrictions: systems.restrictions.flatMap(r => { const when = narrowed(r.when); return (r.when.all ?? []).some(uses) || !conditioned(when) ? [] : [{ ...r, when }]; }),
    parameters: systems.parameters.map(parameter => {
      if (parameter.source.kind !== 'lookup' || !parameter.source.values.some(v => predicates(v.when).some(uses))) return parameter;
      const values = parameter.source.values.filter(v => !(v.when.all ?? []).some(uses)).flatMap(v => {
        const when = narrowed(v.when);
        return v.when.any?.length && !when.any?.length ? [] : [{ ...v, when }];
      });
      return { ...parameter, source: { kind: 'lookup' as const, values } };
    }) };
}
