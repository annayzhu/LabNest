import { chipAmount } from './protocol-chips';
import { translateUiText } from './i18n';
import { preparationKindLabels, type PreparationChecklist, type PreparationState } from './run-preparation';
import { mixState, stepMixes, type StructuredRunView } from './structured-run';

export type WorkbookSheet = { name: string; rows: string[][]; widths: number[] };

/**
 * A run's 操作工作簿: the preparation checklist with what is already ticked, every mix card's amounts per reaction and
 * in total, and what still needs care before or during the run. Pure; the page writes it to an xlsx file.
 */
export function preparationWorkbook(view: Pick<StructuredRunView, 'steps' | 'plan' | 'versions'>, list: PreparationChecklist, ticks: Record<string, PreparationState | undefined>): WorkbookSheet[] {
  const checklist = [['类别', '项目', '说明', '提醒', '已备', '备注'], ...list.items.map(item => [
    translateUiText(preparationKindLabels[item.kind], 'zh'), item.label, item.detail ?? '', item.warning ?? '', ticks[item.key]?.done ? '是' : '', ticks[item.key]?.note ?? '',
  ])];
  const mixes: string[][] = [];
  for (const item of list.items) {
    if (item.kind !== 'mix' || !item.stepId) continue;
    const mix = stepMixes(view, item.stepId).find(entry => item.key === `mix:${item.stepId}:${entry.id}`);
    if (!mix) continue;
    const { live } = mixState(view, item.stepId, mix);
    if (mixes.length) mixes.push([]);
    mixes.push([item.label, item.detail ?? '', `预混余量 ${live.overagePercent}%`], ['组分', '加法', '每反应', '总量']);
    for (const line of live.lines) mixes.push([line.name, line.mode === 'premix' ? '预混' : '单独加',
      line.perReaction === undefined ? line.pending ?? '—' : chipAmount(line.perReaction, line.unit), line.total === undefined ? '—' : chipAmount(line.total, line.unit)]);
    if (live.aliquot) mixes.push(['分装', live.aliquot]);
    for (const warning of live.warnings) mixes.push(['注意', warning]);
  }
  const notes = [['类型', '内容'], ...list.warnings.map(text => ['开始前要处理', text])];
  return [
    { name: '准备清单', rows: checklist, widths: [12, 36, 48, 28, 8, 24] },
    ...(mixes.length ? [{ name: '配液卡', rows: mixes, widths: [32, 22, 18, 18] }] : []),
    { name: '注意事项', rows: notes, widths: [14, 80] },
  ];
}
