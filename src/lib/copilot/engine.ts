import { runAgent, type AgentModel, type AgentTool } from './agent';
import { paperDigest } from './literature';
import { checkDesign, clarificationPrompt, parseClarification, designPrompt, extractPrompt, parseDesign, parseExtraction, parseSelection, parseSubQuestions, searchPrompt, splitPrompt } from './stages';
import { buildSuggestions } from './suggestions';
import { copilotLimits, MAX_LOG_EVENTS, type CopilotEvent, type CopilotRunView, type CopilotStage, type Paper } from './types';

/** What a step needs from outside: the model, the literature, and a look at the plan. Real ones in production, fakes in tests. */
export type EngineDeps = {
  complete: (system: string, user: string) => Promise<{ text: string; model?: string }>;
  chat: AgentModel;
  searchPapers: (query: string, fallbackToPubMed?: boolean, onNotice?: (text: string) => void) => Promise<Paper[]>;
  paperText: (paper: Paper, useFullText: boolean) => Promise<{ text: string; basis: 'fulltext' | 'abstract' }>;
  planContext: () => Promise<string>;
  now: () => Date;
};

const nextStage: Record<CopilotStage, CopilotStage | undefined> = { clarify: 'split', split: 'search', search: 'extract', extract: 'design', design: 'write', write: undefined };

/**
 * One step of a run: the whole stage for splitting, searching, designing and writing, one paper for reading. The run
 * comes back changed (never mutated): the stage's result in its state, what happened in its log, and where it goes next.
 * It stops between stages when the author asked to look at each one first.
 */
export async function runUnit(input: CopilotRunView, deps: EngineDeps): Promise<CopilotRunView> {
  const run: CopilotRunView = structuredClone(input);
  const log = (kind: CopilotEvent['kind'], text: string) => { run.log.push({ at: deps.now().toISOString(), stage: run.stage, kind, text }); if (run.log.length > MAX_LOG_EVENTS) run.log.splice(0, run.log.length - MAX_LOG_EVENTS); };
  const counted = {
    complete: async (system: string, user: string) => { run.modelCalls += 1; const answer = await deps.complete(system, user); run.model ??= answer.model; return answer; },
    chat: (async (system, messages, tools) => { run.modelCalls += 1; const turn = await deps.chat(system, messages, tools); run.model ??= turn.model; return turn; }) as AgentModel,
  };
  /** A structured answer is read once more when its first reading fails: the model is shown what was wrong. */
  const structured = async <T,>(system: string, user: string, read: (text: string) => T): Promise<T> => {
    const first = await counted.complete(system, user);
    try { return read(first.text); } catch (error) {
      log('note', `The answer could not be read (${error instanceof Error ? error.message.slice(0, 120) : 'unknown'}); asked again`);
      const second = await counted.complete(system, `${user}\n\n你上一次的回答无法解析：${error instanceof Error ? error.message.slice(0, 300) : ''}\n请只输出要求的 JSON 对象，不要其他文字。`);
      return read(second.text);
    }
  };
  const state = run.state;
  const finish = (stage: CopilotStage) => {
    state.done.push(stage);
    const next = nextStage[stage];
    if (!next) { run.status = 'done'; log('stage', 'Finished'); return; }
    run.stage = next;
    run.status = run.autoContinue ? 'ready' : 'paused';
    log('stage', `${stage} finished`);
  };
  run.error = undefined;
  run.status = 'ready';
  const validIds = new Set((state.subQuestions ?? []).map(question => question.id));

  const requireEvidence = () => {
    if (!state.extractions?.some(item => item.experiments.some(experiment => experiment.verified && experiment.subQuestionIds.some(id => validIds.has(id))))) {
      throw new Error('未取得可核对的相关文献摘录，已暂停。请检查检索词或来源后重试，暂不生成方案。');
    }
  };
  try {
  if (run.stage === 'clarify') {
    if (!state.clarification) {
      log('stage', '正在核对术语、研究对象和样本');
      const prompt = clarificationPrompt(run.purpose, run.inputs);
      state.clarification = await structured(prompt.system, prompt.user, parseClarification);
    }
    // Only the author-confirmation endpoint advances this stage, never the model.
    run.status = 'paused';
    log('note', '请确认研究信息后再开始检索；待定项会保留在方案中。');
  } else if (run.stage === 'split') {
    log('stage', 'Splitting the purpose into questions');
    const prompt = splitPrompt(run.purpose, run.inputs);
    const tools: AgentTool[] = [{ name: 'read_plan_context', description: '读取这份研究方案和它所在项目里已有的内容：目标、假设、设计、已有结果和实验的标题。', parameters: { type: 'object', properties: {} }, run: () => deps.planContext() }];
    const result = await runAgent({ model: counted.chat, system: prompt.system, task: prompt.task, tools, maxSteps: 3, onEvent: event => log(event.kind, event.text) });
    state.subQuestions = (() => { try { return parseSubQuestions(result.text); } catch { return undefined; } })()
      ?? await structured(prompt.system, `${prompt.task}\n\n（只输出 JSON）`, parseSubQuestions);
    log('model', `${state.subQuestions.length} questions`);
    finish('split');
  } else if (run.stage === 'search') {
    log('stage', 'Searching the literature');
    const found = new Map<string, { ref: string; paper: Paper }>();
    const tools: AgentTool[] = [{
      name: 'search_papers', stopOnError: true, description: '按英文检索式找论文，Europe PMC 失败时按用户设置换到 PubMed，返回每篇的 ref、标题、年份、期刊、是否开放获取和摘要开头。', parameters: { type: 'object', properties: { query: { type: 'string', description: '英文检索式，如 "CHMP2A knockdown esophageal squamous cell carcinoma"' } }, required: ['query'] },
      run: async args => {
        const query = typeof args.query === 'string' ? args.query.trim() : '';
        if (!query) return 'Error: query is empty';
        const papers = await deps.searchPapers(query, run.budget.fallbackToPubMed, text => log('note', text));
        for (const paper of papers) if (!found.has(paper.key)) found.set(paper.key, { ref: `r${found.size + 1}`, paper });
        return JSON.stringify(papers.map(paper => paperDigest(paper, found.get(paper.key)!.ref)));
      },
    }];
    const prompt = searchPrompt(run.purpose, run.inputs, state.subQuestions ?? [], run.budget);
    const result = await runAgent({ model: counted.chat, system: prompt.system, task: prompt.task, tools, maxSteps: copilotLimits.maxToolSteps, onEvent: event => log(event.kind, event.text) });
    const byRef = new Map([...found.values()].map(item => [item.ref, item.paper]));
    let selection: ReturnType<typeof parseSelection> = [];
    try { selection = parseSelection(result.text); } catch { throw new Error('无法读取模型选择的文献，已暂停，请重试检索。'); }
    const chosen: Paper[] = [];
    for (const pick of selection) { const paper = byRef.get(pick.ref); if (paper && !chosen.some(item => item.key === paper.key)) chosen.push({ ...paper, why: pick.why, subQuestionIds: pick.subQuestionIds.filter(id => validIds.has(id)) }); }
    if (!chosen.length) throw new Error(found.size ? '检索返回了文献，但未选出相关来源。请调整问题或检索词后重试。' : '检索成功但没有找到文献。请调整问题或检索词后重试，暂不生成方案。');
    state.papers = chosen.slice(0, run.budget.maxPapers);
    state.extractIndex = 0; state.extractions = [];
    log('model', `${state.papers.length} papers chosen of ${found.size} found`);
    finish('search');
  } else if (run.stage === 'extract') {
    const papers = state.papers ?? [], index = state.extractIndex ?? 0;
    state.extractions ??= [];
    if (index >= papers.length) { requireEvidence(); finish('extract'); }
    else {
      const paper = papers[index];
      const fullTextSoFar = state.extractions.filter(item => item.basis === 'fulltext').length;
      log('stage', `Reading paper ${index + 1} of ${papers.length}: ${paper.title.slice(0, 80)}`);
      try {
        const source = await deps.paperText(paper, fullTextSoFar < run.budget.maxFullText);
        paper.basis = source.basis;
        const prompt = extractPrompt(run.purpose, state.subQuestions ?? [], paper, source.text, source.basis);
        const experiments = await structured(prompt.system, prompt.user, text => parseExtraction(text, source.text, validIds));
        state.extractions.push({ paperKey: paper.key, basis: source.basis, experiments });
        log('model', `${experiments.length} experiments (${experiments.filter(item => item.verified).length} with a verified quote)`);
      } catch (error) {
        state.extractions.push({ paperKey: paper.key, basis: 'abstract', experiments: [], error: error instanceof Error ? error.message.slice(0, 200) : 'Could not read this paper' });
        log('error', `Paper ${index + 1} could not be read: ${error instanceof Error ? error.message.slice(0, 160) : 'unknown error'}`);
      }
      state.extractIndex = index + 1;
      if (state.extractIndex >= papers.length) { requireEvidence(); finish('extract'); }
    }
  } else if (run.stage === 'design') {
    requireEvidence();
    log('stage', 'Combining into a design');
    const prompt = designPrompt(run.purpose, run.inputs, state.subQuestions ?? [], state.papers ?? [], state.extractions ?? []);
    const design = await structured(prompt.system, prompt.user, parseDesign);
    state.design = checkDesign(design, state.papers ?? [], state.extractions ?? [], validIds);
    if (!state.design.items.some(item => item.experiments.length)) throw new Error('没有生成可用的实验设计，请重试本阶段。');
    log('model', `${state.design.items.reduce((count, item) => count + item.experiments.length, 0)} experiments in the design`);
    finish('design');
  } else {
    if (!state.design?.items.some(item => item.experiments.length)) throw new Error('没有可写入的方案，已暂停');
    log('stage', 'Writing suggestions');
    run.suggestions = buildSuggestions(run.id, state.design ?? { summary: '', items: [], gaps: [] }, state.subQuestions ?? [], state.papers ?? [], deps.now().toISOString().slice(0, 10));
    finish('write');
  }
  } catch (error) {
    run.status = 'failed';
    run.error = error instanceof Error ? error.message.slice(0, 500) : '本阶段未完成，请重试';
    log('error', run.error);
  }
  return run;
}
