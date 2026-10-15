import { newClientMutationId } from './client-mutation-id';
import type { ProtocolSystems } from './protocol-systems-schema';

type Rule = ProtocolSystems['rules'][number];
const predicates = (rule: Rule) => [...(rule.when.all ?? []), ...(rule.when.any ?? [])];

/** Toggle "仅…" for a step or block: one rule per dimension; several options of one dimension read as "any of", different dimensions must all hold. */
export function toggleScope(systems: ProtocolSystems, target: { kind: 'step' | 'block'; id: string }, dimensionId: string, optionId: string, newId = () => `rule-${newClientMutationId()}`): ProtocolSystems {
  const own = systems.rules.filter(rule => rule.target === target.kind && rule.targetId === target.id);
  const existing = own.find(rule => predicates(rule).length && predicates(rule).every(p => p.dimensionId === dimensionId) && !rule.when.not?.length);
  const chosen = new Set(existing ? predicates(existing).map(p => p.optionId) : []);
  if (chosen.has(optionId)) chosen.delete(optionId); else chosen.add(optionId);
  const list = [...chosen].map(id => ({ dimensionId, optionId: id }));
  const when = list.length > 1 ? { any: list } : { all: list };
  if (!list.length) return { ...systems, rules: systems.rules.filter(rule => rule !== existing) };
  if (existing) return { ...systems, rules: systems.rules.map(rule => rule === existing ? { ...rule, when } : rule) };
  return { ...systems, rules: [...systems.rules, { id: newId(), target: target.kind, targetId: target.id, when, parameterIds: [], actualFields: [], optional: false }] };
}
