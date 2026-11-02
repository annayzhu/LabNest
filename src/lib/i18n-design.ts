/** Chinese for the research-plan design workbench (Q300–Q312); spread first into zhUi, so an existing translation of the same text wins. */
export const designZh: Record<string, string> = {
  // Page, plan line and launcher
  "Design workbench": "设计工作台",
  "Back to the plan": "返回研究方案",
  "Design this plan step by step, with an independent review": "逐步设计这份方案，并经过独立审查",
  "Design an existing plan": "设计已有方案",
  "Open the design workbench": "打开设计工作台",
  "Context card, evidence chain, design cards, then an independent review. Each step waits for you to confirm it.": "情境卡、证据链、设计卡，然后独立审查。每一步都等你确认后才继续。",
  "e.g. Show that SRGN knockdown inhibits migration of KYSE150 cells": "例如：证明 SRGN 敲低抑制 KYSE150 细胞迁移",
  // Steps
  "Design steps": "设计步骤",
  "Context card": "情境卡",
  "Evidence chain": "证据链",
  "Design cards": "设计卡",
  "Review and sign-off": "审查与签署",
  "Reopen": "重新打开",
  "Hypotheses and predictions, the evidence ledger, sample-size calculation and the feasibility and schedule check come in phase 2.": "假设与预测、证据账本、样本量计算、可行性与日程核对在第 2 期加入。",
  "Remove this design": "删除这次设计",
  "Remove this design? Nothing was written to the plan yet.": "删除这次设计？方案里还没有写入任何内容。",
  "Research purpose": "研究目的",
  "You can still edit and confirm what is drafted.": "已起草的内容仍可修改和确认。",
  "This plan is archived.": "这份方案已归档。",
  "Start a new design": "开始新的设计",
  "Design this plan": "设计这份方案",
  "Four steps: a context card from what LabNest already holds, an evidence chain from a template, a design card for each required experiment, and an independent review before you sign. Each step waits for you to confirm it.": "四步：用 LabNest 里已有的记录整理情境卡，按模板起草证据链，为每个必做实验写设计卡，签署前做一次独立审查。每一步都等你确认。",
  "Start": "开始",
  "Starting reads this plan, its project and the inventory. Nothing is sent to an AI service until you draft the context card.": "开始时只读取本方案、所在项目和库存；在你起草情境卡之前，不会向 AI 服务发送任何内容。",
  // ① Context card
  "Only these one-line summaries go to the AI service, never files or raw data. Untick what should stay here.": "只发送这些一行摘要，不发送文件和原始数据。不想发送的请取消勾选。",
  "Nothing in LabNest matched; the card starts from the purpose alone.": "LabNest 里没有找到相关记录，情境卡只根据研究目的起草。",
  "Draft the context card": "起草情境卡",
  "Draft the card again": "重新起草情境卡",
  "Decide before confirming": "确认前请决定",
  "Research question": "研究问题",
  "Claim type": "主张类型",
  "Subject and candidates": "研究对象与候选",
  "Model system (cell line, source, STR and mycoplasma status)": "模型系统（细胞系、来源、STR 与支原体状态）",
  "Resources we have": "资源：已有",
  "Resources we can get": "资源：可以获得",
  "Resources we lack": "资源：没有",
  "Constraints (time, budget, instruments)": "约束（时间、经费、仪器）",
  "Out of scope": "不做什么",
  "What success looks like": "成功的样子",
  "Existing results": "已有的结果",
  "Confirmed": "已确认",
  "AI suggestion": "AI 建议",
  "Undecided": "待定",
  "Association": "关联",
  "Necessity": "必要性",
  "Sufficiency": "充分性",
  "Mechanism": "机制",
  "Interaction": "相互作用",
  "Direct binding": "直接结合",
  "Save changes": "保存修改",
  "Confirm the card": "确认情境卡",
  "Confirming accepts the AI suggestions as they are; open fields stay open.": "确认即按推荐接受 AI 建议；待定项保持待定。",
  // ③ Evidence chain
  "Evidence-chain template": "证据链模板",
  "What this template asks for": "这个模板要求什么",
  "Least credible evidence": "最低可信证据",
  "Required controls": "必需的对照",
  "Usual counter-explanations": "常见的对立解释",
  "Draft the evidence chain": "起草证据链",
  "Draft the chain again": "重新起草证据链",
  "The model would change the context card": "模型建议修改情境卡",
  "Nothing was changed. Reopen the context card to apply any of this.": "没有自动修改。需要采纳时请重新打开情境卡。",
  "Claim": "主张",
  "Main hypothesis": "主假设",
  "Least credible evidence (one per line)": "最低可信证据（每行一条）",
  "Counter-explanations to rule out": "要排除的对立解释",
  "Tier": "档位",
  "Light": "轻量",
  "Standard": "标准",
  "Publication": "发表级",
  "Recommended": "推荐",
  "Must do": "必做",
  "Optional": "可选",
  "Block title": "实验块标题",
  "Required from tier": "从哪一档起必做",
  "Remove this block": "删除这个实验块",
  "Success, failure and fallback": "成功标准、失败含义与备选",
  "What it answers": "要回答什么",
  "Success criterion": "成功标准",
  "What a failure means": "失败意味着什么",
  "Fallback": "备选做法",
  "Confirm the chain": "确认证据链",
  "Baseline": "基线",
  "Manipulation check": "操作是否成功",
  "Phenotype": "表型",
  "Specificity or rescue": "特异性或拯救",
  // ④ Design cards
  "Draft the design cards": "起草设计卡",
  "Draft this card": "起草这张卡",
  "Confirm the design cards": "确认设计卡",
  "Rules pass": "规则检查通过",
  "Needs a Protocol": "需要规程",
  "The model would change an earlier step": "模型建议修改前面的步骤",
  "Experimental unit": "实验单元",
  "Unit of analysis": "分析单位",
  "n counts": "n 计的是",
  "Groups": "分组",
  "Group names become the planned experiment's groups.": "组名会成为计划中实验的分组名。",
  "Treatment": "处理",
  "Control": "对照",
  "Controls": "对照",
  "Each control says which explanation it rules out.": "每个对照写明它排除哪个解释。",
  "Rules out": "排除",
  "Concurrent": "同期",
  "Manipulation": "操作",
  "Independent reagents (siRNAs, constructs)": "独立试剂数（siRNA、构建）",
  "Efficiency check in this experiment": "本实验内的效率验证",
  "Biological replicates": "生物学重复",
  "Technical replicates": "技术重复",
  "Sample size n": "样本量 n",
  "Basis of n": "n 的依据",
  "Readouts": "读出",
  "Factors": "因素与水平",
  "Runs after": "依赖",
  "Readout": "读出",
  "How it is measured": "测定方法",
  "Time point": "时间点",
  "Assay": "检测类型",
  "qPCR reference genes (one per line)": "qPCR 参照基因（每行一个）",
  "Loading control": "上样对照",
  "Normalization": "归一化",
  "Randomization": "随机",
  "Blinding": "盲法",
  "Batches": "批次",
  "Statistical test": "检验方法",
  "Primary comparison": "主要比较",
  "Multiple-comparison correction": "多重比较校正",
  "Exclusion rules": "剔除规则",
  "Decision criteria, written before the experiment (one per line)": "判定标准，实验前写定（每行一条）",
  "Protocol needed": "需要的规程",
  "Method notes": "方法说明",
  "Save the card": "保存这张卡",
  "Redraft the card": "重新起草这张卡",
  "Redraft this card? Your unsaved changes are lost.": "重新起草这张卡？未保存的修改会丢失。",
  "Remove row": "删除这一行",
  "Independent biological replicates": "独立生物学重复",
  "Animals": "动物",
  "Negative": "阴性",
  "Positive": "阳性",
  "Vehicle": "溶剂",
  "Empty vector": "空载体",
  "Isotype / IgG": "同型 / IgG",
  "Loading": "上样",
  "Reference gene": "参照基因",
  "None": "无",
  "Knockdown": "敲低",
  "Knockout": "敲除",
  "Overexpression": "过表达",
  "Drug or treatment": "药物或处理",
  "Smallest effect worth finding": "最小关注效应",
  "Pilot experiment": "预实验",
  "Convention": "惯例",
  "Needs a pilot experiment": "需要预实验",
  "Imaging": "成像",
  "Flow cytometry": "流式细胞术",
  "Viability": "活力",
  "Migration": "迁移",
  "Sequencing": "测序",
  "Serious": "严重",
  "Important": "重要",
  "Minor": "次要",
  // The rule checks (Q304)
  "No concurrent negative control: add one run alongside the treated groups": "没有同期的阴性对照：请加一个与处理组同时进行的阴性对照",
  "The phenotype is read before the manipulation is shown to work: verify the efficiency first, or in the same experiment": "操作是否成功还没验证就读表型：请先验证效率，或在同一实验中验证",
  "Only one siRNA and no rescue: use a second independent siRNA or add a rescue experiment": "只有一条 siRNA，也没有拯救：请加第二条独立 siRNA，或加拯救实验",
  "Overexpression without an empty-vector control": "过表达没有空载体对照",
  "Wells or technical replicates are counted as n: n is the number of independent biological replicates": "把孔数或技术重复当作 n：n 应是独立生物学重复的数目",
  "Fewer than 3 biological replicates, or none stated": "生物学重复少于 3 次，或没有写明",
  "More than two groups and no correction for multiple comparisons": "超过两组，但没写多重比较校正",
  "qPCR with fewer than two reference genes: MIQE 2.0 asks for reference genes validated as stable in this system": "qPCR 参照基因少于 2 个：MIQE 2.0 要求使用在本体系中验证过稳定性的参照基因",
  "Western blot without a loading control or a stated normalization for quantification": "WB 没有上样对照，或定量没写归一化方法",
  "Image quantification without blinding": "图像定量没有盲法",
  "No decision criteria: write them before the experiment starts": "没有判定标准：请在实验开始前写定",
  "A group has no treatment": "有的分组没有写处理",
  "The block that verifies the manipulation is optional at this tier: make it required": "验证操作是否成功的实验块在本档是可选：请改为必做",
  // ⑥ Review and sign-off
  "Independent review": "独立审查",
  "The same service drafted and reviews this design, so the review is less independent. Choose a review service on the": "起草和审查用的是同一个服务，独立性有限。可在",
  "AI page": "AI 页面选择审查用的服务",
  "Run the review": "开始审查",
  "Both review rounds are done": "两轮审查已完成",
  "No findings beyond the rule checks.": "除规则检查外没有其他意见。",
  "Rule checks": "规则检查",
  "Revise the design cards": "修改设计卡",
  "Sign the design": "签署设计",
  "Preview what signing writes": "预览签署要写入的内容",
  "Premise": "方案前提",
  "(empty)": "（空）",
  "Plan sections": "方案栏目",
  "Keep the last signed design as well": "同时保留上一版签署的设计",
  "Planned experiments": "计划中的实验",
  "With its Protocol and a first day plan": "带规程和日程初稿",
  "For a missing Protocol, use": "缺少规程时，可以用",
  "Recognize a manual": "识别说明书",
  "Design from a goal": "按目标设计",
  "or": "或",
  "Sign and write into the plan": "签署并写入方案",
  "Ready to sign": "可以签署",
  "Revise": "需要修改",
  "Rethink the claim or the chain": "需要重新考虑主张或证据链",
  "No concern": "没有问题",
  "Concern": "有疑问",
  "Not applicable": "不适用",
  "Severe": "严重",
  "Major": "重要",
  "Confounding and batch": "混杂与批次",
  "Pseudoreplication": "伪重复",
  "Sample size basis": "样本量依据",
  "Multiple comparisons": "多重比较",
  "Overclaiming": "结论过度",
  "Feasibility": "可行性",
  "Safety and ethics": "安全与伦理",
  "Fixed in the card": "已在卡片中修改",
  "Why it does not apply": "为什么不适用",
  "Waive": "豁免",
  "Fixed": "已修改",
  "Undo": "撤销",
  "Why the rule does not apply": "为什么这条规则不适用",
  "Clear": "清除",
  "Confirm the design cards first": "请先确认设计卡",
  "Earlier Copilot runs (read-only)": "旧版 Copilot 运行（只读）",
  "Made by the literature-first Copilot this workbench replaces. They can be read, not continued.": "由设计工作台取代的“先检索文献”版 Copilot 生成，只能查看，不能继续推进。",
  // Messages from the server
  "Confirm the context card first": "请先确认情境卡",
  "Confirm the evidence chain first": "请先确认证据链",
  "Draft the context card first": "请先起草情境卡",
  "Draft the evidence chain first": "请先起草证据链",
  "This step is not open": "这一步现在不能修改",
  "No block is required at this tier": "这个档位没有必做的实验块",
  "Only an earlier step can be reopened": "只能重新打开之前的步骤",
  "This finding is not in the latest review": "这条意见不在最新一轮审查里",
  "Say why this finding does not apply": "请写明这条意见为什么不适用",
  "Change the design card first, or waive the finding with a reason": "请先修改设计卡，或写明理由豁免这条意见",
  "Every required block already has a design card": "每个必做实验块都已有设计卡",
  "Two review rounds are done; what is left goes into the limitations": "已完成两轮审查，剩下的问题会写进“限制与依赖”",
  "This design is signed": "这次设计已签署",
  "This design is signed; start a new design to change it": "这次设计已签署；要修改请开始新的设计",
  "A step is already running, or the design is signed": "有一步正在进行，或设计已签署",
  "A step is running; wait for it to finish": "有一步正在进行，请稍候",
  "The design was changed elsewhere; reload it": "设计已在别处修改，请刷新",
  "This plan already has a design in progress: finish or remove it first": "这份方案已有进行中的设计：请先完成或删除",
  "Finish the design cards and run the review first": "请先完成设计卡并做审查",
  "This design cannot be signed now": "现在不能签署这次设计",
  "The plan or the design changed since the preview; look at it again": "预览之后方案或设计有变化，请重新预览",
  "A signed design stays as the record of what was written": "已签署的设计要保留，作为写入内容的记录",
  "Write the research purpose first": "请先写研究目的",
  // AI settings
  "Service that reviews research-plan designs": "审查研究方案设计的服务",
  "Same as the default service (reviews its own drafts)": "与默认服务相同（自己审查自己的草稿）",
  "A different model than the one that drafts makes the review more independent.": "用与起草不同的模型，审查更独立。",
};

const severity: Record<string, string> = { Serious: "严重", Important: "重要", Minor: "次要" };
const stepZh: Record<string, string> = { "Context card": "情境卡", "Evidence chain": "证据链", "Design cards": "设计卡", "Review and sign-off": "审查与签署" };
const tierZh: Record<string, string> = { Light: "轻量", Standard: "标准", Publication: "发表级" };
const verdictZh: Record<string, string> = { "Ready to sign": "可以签署", Revise: "需要修改", "Rethink the claim or the chain": "需要重新考虑主张或证据链" };
const zh = (text: string) => designZh[text] ?? text;

/** Workbench text with a number or a name in it. */
export function translateDesignDynamic(value: string): string | undefined {
  let match = value.match(/^Step (\d) of (\d): (.+), (waiting for you|the last step failed)$/);
  if (match) return `第 ${match[1]}/${match[2]} 步：${stepZh[match[3]] ?? match[3]}，${match[4] === "waiting for you" ? "等你确认" : "上一步没有完成"}`;
  match = value.match(/^Design v(\d+) signed (\S+) · (\d+) planned experiments$/);
  if (match) return `设计 v${match[1]} 已签署（${match[2]}）· 计划中的实验 ${match[3]} 个`;
  match = value.match(/^Design v(\d+) · signed (\S+)$/);
  if (match) return `设计 v${match[1]} · ${match[2]} 签署`;
  match = value.match(/^(\d+) model calls so far(?: · (.+))?$/);
  if (match) return `已调用模型 ${match[1]} 次${match[2] ? ` · ${match[2]}` : ""}`;
  match = value.match(/^The last step failed: ([\s\S]+)$/);
  if (match) return `上一步没有完成：${zh(match[1])}`;
  match = value.match(/^LabNest records to send \((\d+) of (\d+)\)$/);
  if (match) return `要发送的 LabNest 记录（${match[2]} 条中的 ${match[1]} 条）`;
  match = value.match(/^About (\d+) model calls?(, one per card)?( · (?:designed from )?common practice, no literature)?$/);
  if (match) return `约调用模型 ${match[1]} 次${match[2] ? "，每张卡 1 次" : ""}${match[3] ? " · 按常规做法设计，不检索文献" : ""}`;
  match = value.match(/^From (Light|Standard|Publication)$/);
  if (match) return `从${tierZh[match[1]]}档起必做`;
  match = value.match(/^(?:After|Runs after) (.+)$/);
  if (match) return `在 ${match[1]} 之后`;
  match = value.match(/^(\d+) required, (\d+) optional\. At most 5 required\.$/);
  if (match) return `必做 ${match[1]} 个，可选 ${match[2]} 个。必做最多 5 个。`;
  match = value.match(/^(\S+) · needs a Protocol$/);
  if (match) return `${match[1]} · 需要规程`;
  match = value.match(/^Draft the (\d+) missing cards$/);
  if (match) return `起草缺少的 ${match[1]} 张卡`;
  match = value.match(/^(\d+) serious rule findings: they stop the sign-off until fixed or waived with a reason\.$/);
  if (match) return `${match[1]} 条严重的规则问题：修改或写明理由豁免之前不能签署。`;
  match = value.match(/^(Serious|Important|Minor) · Rule (\d+): (.+)$/);
  if (match) return `${severity[match[1]]} · 规则 ${match[2]}：${zh(match[3])}`;
  match = value.match(/^Rule (\d+)(?: · (.+?))?: (.+)$/);
  if (match) return `规则 ${match[1]}${match[2] ? ` · ${match[2]}` : ""}：${zh(match[3])}`;
  match = value.match(/^(\d+) rule findings$/);
  if (match) return `${match[1]} 条规则问题`;
  match = value.match(/^(\d+) groups · (\d+) controls · (\d+) readouts · n = (\S+) · (\d+) criteria$/);
  if (match) return `${match[1]} 组 · ${match[2]} 个对照 · ${match[3]} 项读出 · n = ${match[4]} · ${match[5]} 条判定标准`;
  match = value.match(/^Critical review finding: ([\s\S]+)$/);
  if (match) return `严重审查意见：${match[1]}`;
  match = value.match(/^Reviewer: (.+)\. It sees the context card, the chain, the cards and the rule findings, never the drafting conversation\.$/);
  if (match) return `审查服务：${match[1] === "the default service" ? "默认服务" : match[1]}。它只看情境卡、证据链、设计卡和规则检查结果，看不到起草时的对话。`;
  match = value.match(/^Run review round (\d+)$/);
  if (match) return `开始第 ${match[1]} 轮审查`;
  match = value.match(/^(\d+) of (\d+) rounds · about 1 model call\. What is left after two rounds goes into the limitations\.$/);
  if (match) return `已审查 ${match[1]}/${match[2]} 轮 · 约调用模型 1 次。两轮后仍未解决的写进“限制与依赖”。`;
  match = value.match(/^Round (\d+): (Ready to sign|Revise|Rethink the claim or the chain) · (.+)$/);
  if (match) return `第 ${match[1]} 轮：${verdictZh[match[2]]} · ${match[3]}`;
  match = value.match(/^Signing writes this into the plan once, as design v(\d+), and makes the planned experiments you tick\.$/);
  if (match) return `签署后一次写入方案，记为设计 v${match[1]}，并建出你勾选的计划中实验。`;
  match = value.match(/^(\d+) blocks added(?:, (\d+) from the last signed design replaced)?$/);
  if (match) return `新增 ${match[1]} 块${match[2] ? `，替换上一版签署写入的 ${match[2]} 块` : ""}`;
  match = value.match(/^Needs a Protocol: (.+)$/);
  if (match) return `需要规程：${match[1]}`;
  match = value.match(/^Groups: (.+)$/);
  if (match) return `分组：${match[1] === "none" ? "无" : match[1]}`;
  match = value.match(/^Optional, kept in the plan without an experiment: (.+)$/);
  if (match) return `可选，留在方案里、不建实验：${match[1]}`;
  match = value.match(/^Signed\. (\d+) planned experiments were made\.$/);
  if (match) return `已签署，建出计划中的实验 ${match[1]} 个。`;
  match = value.match(/^Suggestion: ([\s\S]+)$/);
  if (match) return `建议：${match[1]}`;
  match = value.match(/^Waived: ([\s\S]+)$/);
  if (match) return `已豁免：${match[1]}`;
  match = value.match(/^At most 5 required blocks: make some optional$/);
  if (match) return "必做实验块最多 5 个：请把一些改为可选";
  match = value.match(/^Fill in before confirming: (.+)$/);
  if (match) return `确认前请填写：${match[1].split(", ").map(field => ({ question: "研究问题", claimType: "主张类型", subject: "研究对象" })[field] ?? field).join("、")}`;
  match = value.match(/^Draft the remaining design cards first: (.+)$/);
  if (match) return `请先起草其余的设计卡：${match[1]}`;
  match = value.match(/^Gathered (\d+) LabNest records$/);
  if (match) return `读取了 ${match[1]} 条 LabNest 记录`;
  return undefined;
}
