import { prisma } from '../../db';
import { documentPlainText, normalizeResearchPlanDocument } from '../../scientific-document';
import type { ProtocolChoice } from './prompts';
import type { ContextItem } from './spec';

/**
 * The LabNest records a context card starts from (Q301), read without any model: the plan itself, the experiments and
 * results of the plan and its project, the linked Protocols, and inventory and samples named in the purpose. Only
 * these one-line summaries can be sent, never files or raw data; the author unticks what should stay.
 */
export async function gatherContext(planId: string, purpose: string): Promise<ContextItem[]> {
  const plan = await prisma.researchPlan.findUniqueOrThrow({ where: { id: planId }, include: { project: { select: { id: true, name: true } }, protocols: { include: { protocol: { select: { id: true, humanCode: true, title: true, canonicalTitle: true } } } } } });
  const terms = searchTerms(`${purpose} ${plan.title}`);
  const nameMatch = terms.flatMap(term => [{ name: { contains: term, mode: 'insensitive' as const } }, { englishName: { contains: term, mode: 'insensitive' as const } }]);
  const [experiments, results, products, looseItems, samples] = await Promise.all([
    prisma.experiment.findMany({ where: { OR: [{ researchPlanId: planId }, { projectId: plan.projectId }], status: { not: 'archived' } }, orderBy: { date: 'desc' }, take: 12, select: { id: true, runCode: true, title: true, status: true, date: true, researchPlanId: true } }),
    prisma.result.findMany({ where: { OR: [{ researchPlanId: planId }, { projectId: plan.projectId }], status: 'active' }, orderBy: { updatedAt: 'desc' }, take: 10, select: { id: true, title: true, resultType: true, numericValue: true, unit: true, textValue: true, qualityStatus: true } }),
    terms.length ? prisma.inventoryProduct.findMany({ where: { status: 'active', OR: nameMatch }, take: 12, select: { id: true, name: true, englishName: true, brand: true, catalogNumber: true, fieldValues: true, type: { select: { label: true } }, _count: { select: { items: { where: { status: 'active' } } } } } }) : [],
    terms.length ? prisma.inventoryItem.findMany({ where: { status: 'active', productId: null, OR: nameMatch }, take: 8, select: { id: true, name: true, lotNumber: true, currentQuantity: true, unit: true } }) : [],
    terms.length ? prisma.sample.findMany({ where: { status: { not: 'discarded' }, OR: terms.flatMap(term => [{ name: { contains: term, mode: 'insensitive' as const } }, { code: { contains: term, mode: 'insensitive' as const } }]) }, take: 8, select: { id: true, code: true, name: true, type: { select: { label: true } } } }) : [],
  ]);
  const document = documentPlainText(normalizeResearchPlanDocument(plan.contentJson, plan.design)).replace(/\s+/g, ' ').trim();
  const premise = [plan.objective && `目的：${plan.objective}`, plan.hypothesis && `假设：${plan.hypothesis}`, plan.rationale && `依据：${plan.rationale}`, plan.keyInformation && `关键信息：${plan.keyInformation}`].filter(Boolean).join('；');
  const items: ContextItem[] = [];
  if (premise) items.push({ id: 'plan-premise', kind: 'plan', label: `研究方案 ${plan.code}（项目：${plan.project.name}）`, detail: premise.slice(0, 1200), included: true, href: `/research-plans/${plan.id}` });
  if (document) items.push({ id: 'plan-body', kind: 'plan', label: '方案正文', detail: document.slice(0, 1500), included: true, href: `/research-plans/${plan.id}` });
  for (const row of experiments) items.push({ id: `experiment-${row.id}`, kind: 'experiment', label: `${row.runCode ? `${row.runCode} ` : ''}${row.title}`, detail: `${row.researchPlanId === planId ? '本方案' : '同项目'} · ${row.status} · ${row.date.toISOString().slice(0, 10)}`, included: row.researchPlanId === planId, href: `/experiments/${row.id}` });
  for (const row of results) items.push({ id: `result-${row.id}`, kind: 'result', label: row.title, detail: [row.resultType, row.numericValue !== null ? `${row.numericValue}${row.unit ? ` ${row.unit}` : ''}` : row.textValue?.slice(0, 120), `质控 ${row.qualityStatus}`].filter(Boolean).join(' · '), included: true, href: `/results/${row.id}` });
  for (const link of plan.protocols) items.push({ id: `protocol-${link.protocol.id}`, kind: 'protocol', label: `${link.protocol.humanCode} ${link.protocol.canonicalTitle ?? link.protocol.title}`, detail: link.isPrimary ? '主要规程' : '关联规程', included: true, href: `/protocols/${link.protocol.id}` });
  for (const row of products) items.push({ id: `inventory-${row.id}`, kind: 'inventory', label: `${row.name}${row.englishName && row.englishName !== row.name ? `（${row.englishName}）` : ''}`, detail: [row.type?.label, [row.brand, row.catalogNumber].filter(Boolean).join(' '), `在库 ${row._count.items} 份`, verification(row.fieldValues)].filter(Boolean).join(' · '), included: true, href: `/inventory/products/${row.id}` });
  for (const row of looseItems) items.push({ id: `inventory-item-${row.id}`, kind: 'inventory', label: row.name, detail: [row.lotNumber && `批号 ${row.lotNumber}`, `${row.currentQuantity} ${row.unit}`].filter(Boolean).join(' · '), included: true, href: `/inventory/${row.id}` });
  for (const row of samples) items.push({ id: `sample-${row.id}`, kind: 'sample', label: `${row.code} ${row.name}`, detail: row.type.label, included: true, href: `/samples/${row.id}` });
  return items;
}

/** The Protocols a design card may point to: the plan's own first, then ones named like the study, then recent ones. */
export async function protocolChoices(planId: string, purpose: string): Promise<ProtocolChoice[]> {
  const terms = searchTerms(purpose);
  const rows = await prisma.protocol.findMany({
    where: { availability: { in: ['active', 'draft'] }, versions: { some: {} } },
    orderBy: { updatedAt: 'desc' }, take: 200,
    select: { id: true, humanCode: true, title: true, canonicalTitle: true, englishTitle: true, researchPlans: { where: { researchPlanId: planId }, select: { researchPlanId: true } } },
  });
  const score = (row: typeof rows[number]) => (row.researchPlans.length ? 100 : 0) + terms.filter(term => `${row.title} ${row.canonicalTitle ?? ''} ${row.englishTitle ?? ''}`.toLowerCase().includes(term.toLowerCase())).length;
  return rows.map((row, index) => ({ row, index, score: score(row) })).sort((a, b) => b.score - a.score || a.index - b.index).slice(0, 40)
    .map(({ row }) => ({ id: row.id, code: row.humanCode, title: row.canonicalTitle ?? row.title }));
}

const generic = new Set(['the', 'and', 'with', 'for', 'from', 'into', 'cell', 'cells', 'line', 'lines', 'protein', 'gene', 'effect', 'role', 'study', 'assay', 'test', 'using', 'via', 'rna', 'dna', 'mrna']);
/** Names worth looking up: gene, cell-line and reagent words (SRGN, KYSE150, siRNA), not common English. */
export function searchTerms(text: string) {
  const words = text.match(/[A-Za-z][A-Za-z0-9-]{2,}|[A-Za-z]{2,}\d+[A-Za-z0-9-]*/g) ?? [];
  return [...new Set(words.map(word => word.replace(/-+$/, '')).filter(word => !generic.has(word.toLowerCase())))].slice(0, 12);
}

/** A plasmid's sequence check as the product fields record it, when they do. */
function verification(fields: unknown) {
  if (!fields || typeof fields !== 'object') return '';
  const entry = Object.entries(fields as Record<string, unknown>).find(([key]) => /核查|测序|verif|sequenc/i.test(key));
  return entry && entry[1] !== null && entry[1] !== '' ? `${entry[0]}：${String(entry[1]).slice(0, 60)}` : '';
}
