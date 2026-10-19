import { optionMarks } from '@/lib/protocol-chips';
import { conditionTagLabel } from '@/lib/protocol-conditions';
import type { ProtocolSystems } from '@/lib/protocol-systems-schema';
import { SystemMark } from './SystemMark';
import { useI18n } from '../I18nProvider';

type Rule = ProtocolSystems['rules'][number];

/** "仅 ▲ 350 µL" / "仅 富脂组织": the content's stated scope, in shape and words. */
export function ConditionTags({ rules, systems }: { rules: Rule[]; systems: ProtocolSystems }) {
  // Tags render inside the document and the editable page, which the page translator skips.
  const { t } = useI18n();
  const marks = optionMarks(systems);
  const predicates = rules.flatMap(rule => [...(rule.when.all ?? []), ...(rule.when.any ?? [])]);
  if (!predicates.length) return null;
  return <span className="ln-condition-tag">{t('Only')}{predicates.map((p, index) => {
    const mark = marks.get(`${p.dimensionId}:${p.optionId}`), dimension = systems.dimensions.find(d => d.id === p.dimensionId);
    return <span key={index} className="ln-condition-tag-item" data-tone={mark?.tone}>{mark?.symbol ? <SystemMark mark={mark} /> : null}{mark?.symbol ? mark.label : conditionTagLabel(dimension?.label ?? '', mark?.label ?? '')}</span>;
  })}</span>;
}
