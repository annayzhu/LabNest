import type { EntryAssignmentInput } from './entry-assignment';

/**
 * AI 建议: what a model proposes after reading a quick entry (stored as a pending ProposedAction). Nothing changes until
 * the author accepts it on the entry page; 采纳 goes through the entry's own 归入 (assignment), so it can do no more than
 * the author could do by hand there.
 */
const labels: Record<string, string> = {
  link_attachment: '归入实验',
  create_experiment: '新建实验',
  update_experiment: '修改实验',
  consume_inventory: '记录试剂消耗',
  create_entity: '新建条目',
  create_result: '新建结果',
  create_purchase_request: '提出采购',
  receive_purchase: '登记到货',
  link_item: '关联记录',
  create_inventory_item: '新建库存物品',
  create_protocol_run: '按规程开始实验',
};
export const suggestionLabel = (type: string) => labels[type] ?? '其他建议';

/** link_attachment puts the entry, with its images and files, under an experiment; create_experiment makes one first. */
const acceptable = ['link_attachment', 'create_experiment'] as const;
export const canAccept = (type: string): type is (typeof acceptable)[number] => (acceptable as readonly string[]).includes(type);

const text = (value: unknown) => typeof value === 'string' && value.trim() ? value.trim() : undefined;

/** What a suggestion is about, from the first named field of its payload: the experiment, item or record it names. */
export const suggestionSubject = (payload: Record<string, unknown>) =>
  ['title', 'name', 'experiment_title', 'experiment', 'target', 'inventory_item_name', 'product_name', 'entity_name'].map(key => text(payload[key])).find(Boolean);

/** The model's own title field when it gave one, else the first sentence of its reason. */
export function suggestedExperimentTitle(payload: Record<string, unknown>, reason?: string) {
  const named = ['title', 'name', 'experimentTitle', 'experiment_title', 'experiment_name'].map(key => text(payload[key])).find(Boolean);
  const sentence = (named ?? reason ?? '').split(/[。！？!?\n]|\.(?=\s|$)/)[0].trim();
  return sentence.length > 80 ? `${sentence.slice(0, 80)}…` : sentence;
}

/** The experiment a suggestion names in its payload: by run code first (EXP-…), then by a title of four characters or more. */
export function suggestedExperimentId(payload: Record<string, unknown>, experiments: { id: string; title: string; runCode: string }[]) {
  const said = JSON.stringify(payload).toLowerCase();
  return (experiments.find(experiment => experiment.runCode && said.includes(experiment.runCode.toLowerCase()))
    ?? experiments.find(experiment => experiment.title.length >= 4 && said.includes(experiment.title.toLowerCase())))?.id;
}

export type SuggestionDecision = { accept: false } | { accept: true; expectedTarget: string | null; experimentId?: string; newTitle?: string };

/** 采纳 as the request the 归入 control sends: a new experiment by title, or an existing one by id. */
export function assignmentForSuggestion(type: string, decision: Extract<SuggestionDecision, { accept: true }>): Omit<EntryAssignmentInput, 'mutationId'> {
  if (type === 'create_experiment') {
    const newTitle = decision.newTitle?.trim();
    if (!newTitle) throw new Error('请填写实验名称');
    return { type: 'experiment', expectedTarget: decision.expectedTarget, newTitle };
  }
  if (type === 'link_attachment') {
    if (!decision.experimentId) throw new Error('请选择要归入的实验');
    return { type: 'experiment', expectedTarget: decision.expectedTarget, targetId: decision.experimentId };
  }
  throw new Error('这类建议还不能直接采纳，请按建议手动处理');
}
