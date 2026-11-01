/**
 * Chinese for the inventory refinements of docs/modules/inventory/refine-20261031/PLAN.md (Q189–Q197). Spread last into
 * zhUi, so these also replace a few older inventory wordings ("In use" now reads 领用中, "No lot number" 未填批号).
 */
export const inventoryZh: Record<string, string> = {
  // Q189 the phone's bottom bar
  "Quick note": "速记",

  // Q197 import sources
  "Invoices, delivery notes, labels": "发票/送货单/标签",
  "Paste text": "粘贴文字",
  "An Excel or CSV sheet, one lot per row. Download the template, or let AI match your columns.": "Excel 或 CSV 表格，一行一批。可以下载模板，也可以让 AI 对上你的列。",
  "Photos or PDFs of invoices, delivery notes or labels. AI reads a draft; you check every line before anything is imported.": "发票、送货单或标签的照片或 PDF。AI 先读出草稿，你逐行核对后才入库。",
  "Text from an order, invoice or email. AI reads a draft; you check every line before anything is imported.": "订单、发票或邮件里的文字。AI 先读出草稿，你逐行核对后才入库。",
  "Primer pairs, siRNA duplexes or single sequences, pasted from a sheet or read from FASTA. Each becomes a product.": "引物对、siRNA 双链或单条序列，从表格粘贴或读 FASTA 文件，每条成为一个产品。",

  // Q190 the phone's register and take-out entries
  "Fill in yourself": "自己填",
  "Choose the product, then how much and where": "选产品，再填数量和位置",
  "Take a photo": "拍照识别",
  "Of an invoice, delivery note or label; AI reads a draft for you to check": "拍发票、送货单或标签，AI 读出草稿给你核对",
  "Choose photos": "从相册选",
  "Up to 10 from the photo library": "从相册选，最多 10 张",
  "AI cannot read pictures yet: tap to see how to set it up": "AI 还不能读图片，点开看怎么设置",
  "Search or scan, then tap the stock to take it out.": "搜索或扫码，再点要领用的物品。",
  "Opens its page": "点开详情",

  // Q196 taking out without an experiment
  "In use": "领用中",
  "Already used up": "已用完",
  "Mark each one used up, return it or hand it over.": "可以逐件标记用完、归还或转交。",
  "No recipient recorded": "未记录领用人",
  "Mark it used up?": "标记为用完？",
  "It leaves the in-use list; its history stays.": "它会离开领用中列表，历史记录保留。",
  "Put back at (optional)": "放回哪里（可选）",
  "The container could not be changed.": "实物状态没有改成，请刷新后再试。",
  "No lot number": "未填批号",

  // Q191 renaming and Q192 one edit form
  "Recorded as": "记录时为",
  "This lot": "这一批",
  "Move to another product…": "移到另一个产品…",
  "Choose the product this lot belongs to; its own product stays as it is.": "选这一批所属的产品；原来的产品不会改动。",
  "Keep its product": "不移了",

  // Q193 the product page
  "In all": "共",
  "Add details": "补充信息",
  "Choose a file": "选择文件",

  // Q194 locations
  "Every location": "全部库位",

  // Q195 the movement ledger
  "Taken out": "领用",
  "Returned to store": "归还",
  "Moved": "移位",
  "Container deleted": "删除误登记的实物",
  "Put at": "放到",
  "Put back at": "放回",
};

/** Inventory messages with a number or name in them. */
export function translateInventoryDynamic(value: string): string | undefined {
  let match = value.match(/^Registered (\d{2}-\d{2})$/);
  if (match) return `${match[1]} 登记`;
  if ((match = value.match(/^Changes here apply to all (\d+) lots of this product\.$/))) return `这里的修改会同时改到这个产品的全部 ${match[1]} 个批次。`;
  if ((match = value.match(/^Taken out (\d{2}-\d{2})$/))) return `${match[1]} 领用`;
  if ((match = value.match(/^With (\d+) places? inside$/))) return `含 ${match[1]} 个下级库位`;
  if ((match = value.match(/^Took out (\d+) and marked them used up\.$/))) return `已领用 ${match[1]} 个，并标记为用完。`;
  return undefined;
}
