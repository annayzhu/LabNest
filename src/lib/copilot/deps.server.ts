import { resolveConnectedAdapter } from '../ai-server';
import { prisma } from '../db';
import { enabledAdapters, europePmcBase, fetchLimited } from '../method-sources/index.server';
import { normalizeResearchPlanDocument } from '../scientific-document';
import type { EngineDeps } from './engine';
import { paperText, searchPapers } from './literature';

/** Services the Copilot can drive with tools: OpenAI, Anthropic and anything that speaks the OpenAI interface (DeepSeek, Qwen, Gemini). */
export const supportsTools = (type: string) => type === 'openai' || type === 'anthropic' || type === 'openai_compatible';

/** What stands between a research plan and a run: the AI switch, a service that can call tools, and the Europe PMC permission. */
export async function copilotReadiness() {
  const [settings, europePmc] = await Promise.all([
    prisma.aISettings.findUnique({ where: { id: 'default' }, include: { defaultProvider: true } }),
    enabledAdapters().then(adapters => adapters.some(adapter => adapter.id === 'europe_pmc')),
  ]);
  const provider = settings?.defaultProvider;
  return { europePmc, toolsOk: Boolean(provider && supportsTools(provider.type)), providerName: provider?.name };
}

/** The real model, literature and plan reader for one step; the gate says whether the result may still be used. */
export async function prepareStep(planId: string) {
  const resolved = await resolveConnectedAdapter({ timeoutMs: 240_000 });
  if (!resolved.ok) throw new Error(resolved.error);
  const { adapter, config, gate } = resolved;
  if (!adapter.chat || !adapter.complete || !supportsTools(config.type)) throw new Error(`模型服务“${config.name}”不能按工具调用的方式工作：请在 AI 设置里换一个 DeepSeek、OpenAI、Anthropic、通义千问或 Gemini 的服务作为默认服务`);
  if (!(await enabledAdapters()).some(item => item.id === 'europe_pmc')) throw new Error('Europe PMC 检索没有开启：请先在“按目标设计”页的检索设置里打开外部方法检索并勾选 Europe PMC');
  const deps: EngineDeps = {
    now: () => new Date(),
    chat: (system, messages, tools) => adapter.chat!(system, messages, tools),
    complete: (system, user) => adapter.complete!(system, user),
    searchPapers: async query => {
      const papers = await searchPapers(query, fetchLimited, europePmcBase);
      await prisma.activityLog.create({ data: { action: 'copilot_literature_search', targetType: 'research_plan', targetId: planId, metadataJson: { source: 'europe_pmc', query: query.slice(0, 200), results: papers.length } } });
      return papers;
    },
    paperText: (paper, useFullText) => paperText(paper, fetchLimited, europePmcBase, useFullText),
    planContext: async () => {
      const plan = await prisma.researchPlan.findUnique({ where: { id: planId }, include: { project: { select: { name: true } }, results: { orderBy: { updatedAt: 'desc' }, take: 10, select: { title: true } }, experiments: { orderBy: { date: 'desc' }, take: 10, select: { title: true } } } });
      if (!plan) return '{}';
      const design = normalizeResearchPlanDocument(plan.contentJson, plan.design).sections.find(section => section.key === 'design');
      const designText = (design?.blocks ?? []).map(block => 'text' in block ? block.text : '').filter(Boolean).join('\n').slice(0, 1500);
      return JSON.stringify({ title: plan.title, project: plan.project.name, objective: plan.objective, hypothesis: plan.hypothesis, rationale: plan.rationale, design: designText, results: plan.results.map(item => item.title), experiments: plan.experiments.map(item => item.title) });
    },
  };
  return { deps, provider: config.name, assertAllowed: () => gate.assertAllowed() };
}
