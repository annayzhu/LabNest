import { z } from 'zod';
import { extractJsonPayload } from '../ai';
import { MAX_METHOD_TEXT_CHARS } from '../method-card';
import { clarificationSchema, designSchema, extractionSchema, subQuestionSchema, type CopilotBudget, type CopilotInputs, type Design, type DesignExperiment, type ExtractedExperiment, type Paper, type PaperExtraction, type SubQuestion } from './types';

/** Prompts and readers for the stages of a run. Every reader refuses text that is not the shape asked for. */
type Inputs = CopilotInputs;
const context = (purpose: string, inputs: Inputs) => `${inputs.mode === 'adjust' ? '任务：调整一份已有的研究方案。方案里已经写了的内容不要重复，只补缺口、指出需要修正的地方。\n' : ''}研究目的：${purpose}\n样本或模型：${inputs.sample || inputs.model || '未说明'}\n已有条件：${inputs.conditions || '未说明'}${inputs.method ? `\n已确认方法：${inputs.method}` : ''}${inputs.subject ? `\n已确认研究对象：${inputs.subject}` : ''}${inputs.objective ? `\n已确认本轮目标：${inputs.objective}` : ''}`;

function jsonObject(raw: string): unknown {
  const payload = extractJsonPayload(raw);
  const start = payload.indexOf('{'), end = payload.lastIndexOf('}');
  return JSON.parse(start >= 0 && end > start ? payload.slice(start, end + 1) : payload);
}

export function clarificationPrompt(purpose: string, inputs: Inputs) {
  return {
    system: '先澄清研究问题，暂不检索和设计实验。检查术语歧义、分子拼写、研究对象、样本和目标。不擅自纠正或补全研究者未提供的信息：未知项写“待定”，有歧义的术语保留原词，并在 questions 中给出需要作者决定的选项。例：ligation blot 可能是 ligand blot/far-Western，也可能是连接相关检测，必须由作者确认。用户在研究目的、样本、已有条件中明确提供的信息均为有效输入，原样保留，不因缺少单独字段就重复追问或改成待定。questions 最多 4 个，只问影响本轮目标的实际歧义；已经明确为待定的条件不重复问，作为后续设计限制保留。用“结论适用范围”，不用“边界”一词。只输出 JSON：{"method":"方法及全称","subject":"分子与候选对象","sample":"样本类型和模型，未知写待定","objective":"本轮要回答的问题","questions":["需要确认的问题"]}。',
    user: context(purpose, inputs),
  };
}
export const parseClarification = (raw: string) => clarificationSchema.extend({ questions: z.array(z.string().max(400)).max(8).default([]) }).parse(jsonObject(raw));

// Stage 1: split the purpose into questions that experiments can answer.
export function splitPrompt(purpose: string, inputs: Inputs) {
  return {
    system: [
      '你是科研方案助手，帮研究者把一个研究目的拆成可以用实验检验的科学问题。你可以先调用 read_plan_context 看研究方案和项目里已有的内容。',
      '拆成 2 到 4 个必要且不重复的子问题。严格围绕已确认的本轮目标；方法验证或结合验证不能扩展为整套疾病机制课题。未知样本类型保留待定，不能擅自替研究者决定。',
      '不要规划实验规程，不要写操作步骤。',
      '最后只输出一个 JSON 对象：{"subQuestions":[{"id":"q1","question":"中文问题","why":"怎样的结果能回答它","keywords":["英文检索词，最多 6 个"]}]}。keywords 用英文，因为文献库读英文。',
    ].join('\n'),
    task: context(purpose, inputs),
  };
}

export function parseSubQuestions(raw: string): SubQuestion[] {
  const parsed = z.object({ subQuestions: z.array(subQuestionSchema.partial({ id: true })).min(1).max(8) }).parse(jsonObject(raw));
  const seen = new Set<string>();
  return parsed.subQuestions.map((item, index) => {
    let id = item.id && !seen.has(item.id) ? item.id : `q${index + 1}`;
    while (seen.has(id)) id = `${id}x`;
    seen.add(id);
    return { id, question: item.question, why: item.why ?? '', keywords: item.keywords ?? [] };
  });
}

// Stage 2: the agent searches the literature with the tool and picks what to read.
export function searchPrompt(purpose: string, inputs: Inputs, subQuestions: SubQuestion[], budget: CopilotBudget) {
  return {
    system: [
      '你是科研文献检索助手。用 search_papers 工具在已启用的来源里找文献：每次一个英文检索式，可以多次、可以换词，目标是找到“为验证这些子问题，别人做过哪些实验”的论文。',
      `最多选 ${budget.maxPapers} 篇：优先选实验设计清楚、与子问题直接相关的原始研究，综述只在没有更好选择时用。只能选工具返回过的 ref，不要编造。`,
      '搜索时保留完整分子名称及方法词，优先分别检索方法学与候选分子的原始证据。找到足够支持本轮目标的文献即可停止，不必耗尽预算；没有相关结果就返回空 selected。搜索结果带来源与 openAccess 标记：开放获取的可以尝试读全文，其余只能读摘要。',
      '先检索核心方法，再分别核对候选的直接相关证据；本轮总共最多 8 次查询。连续零命中时记录证据缺口，不反复改写相同组合，也不扩大成无关课题。',
      '最后只输出一个 JSON 对象：{"selected":[{"ref":"r3","why":"为什么选它","subQuestionIds":["q1"]}]}。',
    ].join('\n'),
    task: `${context(purpose, inputs)}\n\n子问题：\n${subQuestions.map(q => `${q.id}. ${q.question}（检索词：${q.keywords.join('、') || '自己决定'}）`).join('\n')}`,
  };
}

export function parseSelection(raw: string) {
  return z.object({ selected: z.array(z.object({ ref: z.string().trim().min(1).max(20), why: z.string().trim().max(400).default(''), subQuestionIds: z.array(z.string().trim().max(12)).max(8).default([]) })).max(40) }).parse(jsonObject(raw)).selected;
}

// Stage 3: what one paper did, read from its text, each experiment with its own words as the evidence.
export function extractPrompt(purpose: string, subQuestions: SubQuestion[], paper: Paper, text: string, basis: 'fulltext' | 'abstract') {
  const body = text.length > MAX_METHOD_TEXT_CHARS ? `${text.slice(0, MAX_METHOD_TEXT_CHARS)}\n[文本已截断]` : text;
  return {
    system: [
      '你是科研文献阅读助手。只根据给出的论文文本，列出这篇论文为了回答研究者关心的问题而做的实验。不补充文本里没有的内容，不猜测。',
      '区分两类相关依据：针对当前研究对象的实验证据，以及可用于回答子问题的方法学依据。方法论文明确描述的检测方法、或其他对象原始研究中相关的方法也应提取；不能仅因分子或细胞系不同就返回空数组。purpose 必须说明它只是方法参考，sample 保留论文真实对象，不得把其他对象的结果移植为当前候选已验证。',
      '每个实验写：name（实验名称，如“CCK-8 细胞增殖实验”）、subQuestionIds（它回答哪些子问题的 id）、approach（做法类型，如 qPCR、Western blot、CCK-8、流式、动物成瘤）、purpose（为了验证什么）、readouts（读出指标）、controls（对照）、sample（细胞系、动物模型或样本）、quote（论文原文中逐字摘录的依据，30 字以内，不能改写）。',
      'subQuestionIds、readouts、controls 必须为字符串数组；文本未说明的 readouts 或 controls 用 []，不得用字符串或 null，也不得补造对照。其他字段均为字符串。',
      '与子问题无关的实验不要列。论文没有相关实验就返回空数组。',
      `文本来源：${basis === 'fulltext' ? '全文的方法和结果部分' : '只有摘要，信息有限，不要推断摘要之外的做法'}。`,
      '只输出一个 JSON 对象：{"experiments":[{...}]}，不要任何解释。',
    ].join('\n'),
    user: `${`研究目的：${purpose}`}\n子问题：\n${subQuestions.map(q => `${q.id}. ${q.question}`).join('\n')}\n\n论文：${paper.title}（${[paper.authors, paper.year, paper.venue].filter(Boolean).join('，')}）\n文本：\n${body}`,
  };
}

const foldText = (text: string) => text.toLowerCase().replace(/\s+/g, ' ').replace(/[“”"'‘’`]/g, '').trim();

/** Each experiment's quote must be in the paper's text; one that is not stays on the list marked 未核实, never dropped. */
export function parseExtraction(raw: string, text: string, validIds: Set<string>): ExtractedExperiment[] {
  const haystack = foldText(text);
  return extractionSchema.parse(jsonObject(raw)).experiments.map(item => {
    const problem = item.quote.length < 4 ? '没有引文' : !haystack.includes(foldText(item.quote)) ? '引文不在论文文本中' : undefined;
    return { ...item, subQuestionIds: item.subQuestionIds.filter(id => validIds.has(id)), verified: !problem, ...(problem ? { problem } : {}) };
  });
}

// Stage 4: combine what the papers did into a design for the research purpose.
export function designPrompt(purpose: string, inputs: Inputs, subQuestions: SubQuestion[], papers: Paper[], extractions: PaperExtraction[]) {
  const evidence = extractions.flatMap(extraction => {
    const paper = papers.find(item => item.key === extraction.paperKey);
    return paper ? extraction.experiments.map(item => `- [${paper.key}] ${item.name}（${item.approach}；回答 ${item.subQuestionIds.join('、') || '未标明'}）读出：${item.readouts.join('、') || '—'}；对照：${item.controls.join('、') || '—'}；样本：${item.sample || '—'}；依据：${extraction.basis === 'fulltext' ? '全文' : '仅摘要'}${item.verified ? '' : '，引文未核实'}`) : [];
  });
  return {
    system: [
      '你是科研方案助手。根据研究目的、子问题，和别人论文里已经做过的实验，为每个子问题设计需要做的实验。这是针对科学问题的实验设计，不是实验规程：不写操作步骤、试剂用量。',
      '每个实验写：name、purpose（验证什么）、approach（做法类型）、comparison（比较哪些对象或组别）、readouts、controls、decisionCriteria（什么观察支持或不支持目标，何时需补充验证）、priority（must 必做 / optional 可选）、evidence（依据的论文 key 列表，只能用下面给出的 key）、note（要注意的点）。',
      '只给回答本轮目标所必需的最小设计，不扩展为完整机制课题。必须有可核查的方法依据才能列为必做，没有依据的列为可选并说明。文献中的其他分子或细胞系只作为方法依据，不能冒充当前候选结合已被证明。膜上结合、复合物关联、直接结合及因果作用必须分别表述。只有摘要时不能声称核实了全文方法。待定的样本类型和条件保留待定，不编造定量阈值、操作条件或预期结果。',
      'gaps 写文献没有覆盖、需要研究者自己决定的地方。',
      '只输出一个 JSON 对象：{"summary":"一段话概括整体设计","items":[{"subQuestionId":"q1","experiments":[{...}]}],"gaps":["…"]}。',
    ].join('\n'),
    user: `${context(purpose, inputs)}\n\n子问题：\n${subQuestions.map(q => `${q.id}. ${q.question}（${q.why}）`).join('\n')}\n\n文献里做过的实验：\n${evidence.join('\n') || '（没有找到相关实验）'}`,
  };
}

export function parseDesign(raw: string): z.infer<typeof designSchema> { return designSchema.parse(jsonObject(raw)); }

/**
 * An experiment is 核实 when a paper it names was read and had a verified experiment; one that names no paper, only
 * papers that gave nothing, or only abstracts is marked with the reason. A must-do without a basis becomes optional.
 */
export function checkDesign(design: z.infer<typeof designSchema>, papers: Paper[], extractions: PaperExtraction[], validIds: Set<string>): Design {
  const known = new Map(papers.map(paper => [paper.key, paper]));
  const items = design.items.filter(item => validIds.has(item.subQuestionId)).map(item => ({
    subQuestionId: item.subQuestionId,
    experiments: item.experiments.map((experiment): DesignExperiment => {
      const evidence = [...new Set(experiment.evidence.filter(key => known.has(key)))];
      const method = (value: string) => foldText(value).replace(/[^\p{L}\p{N}]/gu, '');
      const supported = evidence.filter(key => extractions.find(extraction => extraction.paperKey === key)?.experiments.some(found => {
        if (!found.verified || !found.subQuestionIds.includes(item.subQuestionId)) return false;
        const proposed = method(experiment.approach), observed = method(found.approach);
        if (proposed && observed) return proposed === observed;
        const proposedName = method(experiment.name), observedName = method(found.name);
        return Math.min(proposedName.length, observedName.length) >= 4 && (proposedName.includes(observedName) || observedName.includes(proposedName));
      }));
      const fullText = supported.some(key => extractions.find(extraction => extraction.paperKey === key)?.basis === 'fulltext');
      const problem = !evidence.length ? '没有文献依据' : !supported.length ? '依据的论文里没有核实过的实验' : !fullText ? '依据只来自摘要，请核对原文' : undefined;
      return { ...experiment, evidence, priority: !supported.length ? 'optional' : experiment.priority, verified: !problem, ...(problem ? { problem } : {}) };
    }),
  }));
  return { summary: design.summary, items, gaps: design.gaps };
}
