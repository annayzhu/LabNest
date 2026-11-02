/** The Copilot harness in Chinese: adoption numbers on the AI page (Q334) and 整理 on quick records (Q337–Q340). */
export const copilotZh: Record<string, string> = {
  // The AI page
  "Copilot suggestions by step, last 30 days": "Copilot 各步骤的建议（最近 30 天）",
  "Tidy up a quick record": "整理快速记录",
  "Dictate with the keyboard’s microphone, then click “Tidy up” on the saved record; the draft changes nothing until you adopt it": "用键盘上的麦克风口述，保存后在记录上点“整理”；采用整理稿之前，记录不会改变",
  // Reasons for setting a suggestion aside
  "Wrong": "不对",
  "Not needed": "不需要",
  "Already there": "已经有了",
  "Poorly written": "写法不好",
  "Asked for a new one": "重新生成了",
  // 整理 on a quick record
  "Tidy up": "整理",
  "Tidying…": "整理中…",
  "Tidied draft": "整理稿",
  "Body text": "正文",
  "Original words": "原话",
  "As written before tidying": "整理前的原样",
  "File under it": "归入",
  "Use this draft": "采用",
  "Set aside": "不采用",
  "Why set it aside?": "为什么不采用？",
  "Adopted. The words as they were are kept under “Original words”.": "已采用。原来的文字保留在“原话”里。",
  "The draft was set aside; the record is unchanged.": "已放弃整理稿，记录没有改变。",
  "This record no longer exists": "这条记录已不存在",
  "There are no words to tidy in this record": "这条记录里没有可以整理的文字",
  "The record could not be tidied": "没有整理成功",
  "Give the record a title of 160 characters at most": "请填写不超过 160 字的标题",
  "The tidied text is empty": "整理稿是空的",
  "The record changed after this draft was made; tidy it again": "整理之后记录又改过了，请重新整理",
  "This draft is not the latest one; tidy the record again": "这不是最新的整理稿，请重新整理",
  "Choose a reason": "请选择原因",
  "Not saved; try again": "没有保存，请重试",
  "AI-tidied draft adopted": "采用了 AI 整理稿",
  "Filed": "归入",
};

const moduleZh: Record<string, string> = { "Research plans": "研究方案", "Manuals and Protocols": "说明书与规程", "Quick records": "快速记录", Results: "实验结果" };
const stepZh: Record<string, string> = { "Context card": "情境卡", "Evidence chain": "证据链", "Design card": "设计卡", "Independent review": "独立审查", "Organized manual (template-v1)": "整理说明书（template-v1）", "Tidied quick record": "整理快速记录" };
const list = (text: string) => text.split(", ").join("、");

/** One adoption line: "adopted 3 of 4 (75%) · 1.5 fields changed before adopting · 2 waiting · set aside: Wrong 1". */
function adoptionZh(text: string) {
  return text.split(" · ").map(part => {
    let match = part.match(/^adopted (\d+) of (\d+) \((\d+)%\)$/);
    if (match) return `采纳 ${match[1]}/${match[2]}（${match[3]}%）`;
    if (part === "none decided yet") return "还没有处理过";
    match = part.match(/^([\d.]+) fields changed before adopting$/);
    if (match) return `采纳前平均改 ${match[1]} 处`;
    match = part.match(/^(\d+) waiting$/);
    if (match) return `${match[1]} 条待处理`;
    match = part.match(/^set aside: (.+)$/);
    if (match) return `未采用：${match[1].split(", ").map(item => item.replace(/^(.+) (\d+)$/, (_, reason: string, count: string) => `${copilotZh[reason] ?? reason} ${count}`)).join("、")}`;
    return part;
  }).join(" · ");
}

export function translateCopilotDynamic(value: string): string | undefined {
  let match = value.match(/^Copilot, last 30 days: (.+)$/);
  if (match) return `Copilot 最近 30 天：${adoptionZh(match[1])}`;
  match = value.match(/^(Research plans|Manuals and Protocols|Quick records|Results) · (.+) · v(\d+)$/);
  if (match) return `${moduleZh[match[1]]} · ${stepZh[match[2]] ?? match[2]} · 第 ${match[3]} 版`;
  if (/^(?:adopted \d+ of \d+|none decided yet)/.test(value)) return adoptionZh(value);
  match = value.match(/^Sends this record’s words to (.+); nothing changes until you adopt the draft$/);
  if (match) return `把这条记录的文字发给 ${match[1] === "the model" ? "模型" : match[1]}；采用整理稿之前，记录不会改变`;
  match = value.match(/^From (.+)\. Nothing on the record changes until you adopt it; the words as they are now stay under “Original words”\.$/);
  if (match) return `来自 ${match[1]}。采用之前记录不会改变；现在的文字会保留在“原话”里。`;
  match = value.match(/^Not in your words: (.+)\. Check them before adopting\.$/);
  if (match) return `原话里没有：${list(match[1])}。采用前请核对。`;
  match = value.match(/^Your words name (.+)\. File this record under it\?$/);
  if (match) return `原话提到了 ${match[1]}。把这条记录归入它吗？`;
  match = value.match(/^Filed under (.+)\.$/);
  if (match) return `已归入 ${match[1]}。`;
  match = value.match(/^The service “(.+)” cannot write text; choose another default service on the AI page$/);
  if (match) return `服务“${match[1]}”不能生成文字，请在 AI 页面另选默认服务`;
  return undefined;
}
