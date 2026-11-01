/** Chinese for 整理说明书 in two passes (Q291–Q299): the scope form, the draft beside the original, the anchor check. */
export const recognitionZh: Record<string, string> = {
  // The source and the request
  "Goal (optional; sent to the model with the name)": "目标（可留空；与规程名称一起发给模型）",
  "e.g. Extract plasmid DNA from 100 mL of culture for transfection": "例如：从 100 mL 菌液提取质粒，用于转染",
  "Draft language": "整理稿语言",
  "Organize in Chinese (numbers, units, reagent names and catalog numbers as in the original)": "中文整理（数值、单位、试剂名、货号照原文）",
  "Keep the original wording": "保留原文",
  "Organizing with AI… (may take a few minutes)": "AI 整理中…（可能要几分钟）",
  "The request is incomplete; read the source again": "请求不完整，请重新读取",
  "Part of the model’s answer was cut off; check the draft for missing lines": "模型的部分回答被截断，请检查整理稿是否缺行",
  // 目录与范围
  "Contents and scope": "目录与范围",
  "The model read the headings and the first lines of each page. Confirm what to organize; only those pages are sent next.": "模型读了各页的标题和开头几行。请确认要整理的内容，下一步只发送这些页。",
  "The contents could not be read; the whole source will be organized in order.": "没有读出目录，将按顺序整理全文。",
  "Workflow (the original gives several; organize one)": "流程（原文有几套，选一套整理）",
  "Systems: values are written in this order": "体系：用量按这个顺序写",
  "Keep at least one system.": "至少保留一个体系。",
  "Parts of the original": "原文各部分",
  "Leave out": "不要",
  "Unsorted": "未归类",
  "Differences within the original (written into the description as “原文差异”, for you to settle):": "原文内部的差异（会写进说明的“原文差异”，由你选定）：",
  "Organize this scope": "按这个范围整理",
  // The draft and the original
  "Change the scope": "调整范围",
  "Download as Word template": "下载为 Word 模板",
  "The Word file could not be made; try again": "未能生成 Word 文件，请重试",
  "There is no draft to download": "没有可下载的整理稿",
  "Text to organize (edit it the way “步骤：1. …”, “体系：…”, “仅…：” and “记录：…” are written; keep the positions 〔p3:12〕 at the end of lines)": "整理用的文字（按“步骤：1. …”“体系：…”“仅…：”“记录：…”的写法修改；行末的原文位置〔p3:12〕请保留）",
  "Draft and original": "整理稿与原文",
  "Organized draft": "整理稿",
  "Original": "原文",
  "· not read": "· 未读取",
  "Lines of the original with an amount that no line cites (perhaps left out on purpose; check them):": "原文中带用量、但没有任何一行指向的行（可能是有意删去的，请核对）：",
  // The anchor check's problems
  "No source position": "没有原文位置",
};

/** The check's problems as RecognitionDraft writes them in English, back in the check's own Chinese wording. */
const problem = (text: string) => text
  .replace(/^No source position$/, "没有原文位置")
  .replace(/^Source position not found: ([\s\S]+)$/, (_, items: string) => `原文位置不存在：${items.split(", ").join("、")}`)
  .replace(/^Amounts not in the cited lines: ([\s\S]+)$/, (_, items: string) => `数值不在指向的原文：${items.split(", ").join("、")}`)
  .replace(/^Values per system in another order than the original: ([\s\S]+)$/, "体系取值顺序与原文不一致：$1")
  .replace(/^Systems in another order than the original: ([\s\S]+)$/, "体系顺序与原文不一致：$1")
  .replace(/^Names not in the cited lines: ([\s\S]+)$/, (_, items: string) => `名称不在指向的原文：${items.split(", ").join("、")}`)
  .replace(/^Only (\d+)% matches the cited lines$/, "与指向的原文只对上 $1%");
const anchored = /^(?:No source position|Source position not found: |Amounts not in the cited lines: |Values per system in another order than the original: |Systems in another order than the original: |Names not in the cited lines: |Only \d+% matches the cited lines)/;

export function translateRecognitionDynamic(value: string): string | undefined {
  if (anchored.test(value)) return value.split("; ").map(problem).join("；");
  let match = value.match(/^(\d+) of (\d+) lines could not be found in the lines they cite; they are marked in the draft and will be saved as unverified\.$/);
  if (match) return `${match[2]} 行中有 ${match[1]} 行在所指的原文里找不到，已在整理稿中标出，保存后标为未核实。`;
  match = value.match(/^Each of the (\d+) lines was found in the lines it cites: its amounts, names and system order\.$/);
  if (match) return `${match[1]} 行都在所指的原文里找到：数值、名称和体系顺序都对得上。`;
  match = value.match(/^Pages read: (\d+) of (\d+)(?: · (\d+) characters sent)?(?: · (\d+) model requests? in the second pass)?$/);
  if (match) return [`读取 ${match[2]} 页中的 ${match[1]} 页`, match[3] ? `发送 ${match[3]} 字` : "", match[4] ? `第二遍调用模型 ${match[4]} 次` : ""].filter(Boolean).join(" · ");
  match = value.match(/^Systems \(([\s\S]+)\): values are written in this order$/);
  if (match) return `体系（${match[1]}）：用量按这个顺序写`;
  match = value.match(/^Show (p\d+:[\d–]+) in the original$/);
  if (match) return `在原文中查看 ${match[1]}`;
  match = value.match(/^Page (\d+)$/);
  if (match) return `第 ${match[1]} 页`;
  return undefined;
}
