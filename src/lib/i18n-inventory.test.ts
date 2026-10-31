import { describe, expect, it } from "vitest";
import { translateUiText } from "./i18n";

describe("Inventory in Chinese", () => {
  it.each([
    ["Storage locations", "库位"],
    ["Reagents & chemicals", "试剂与化学品"],
    ["2 stock movements", "2 条出入库流水"],
    ["This item has 2 stock movements, 1 purchase receipt, so it cannot be deleted. Archive it instead.", "这个物品有 2 条出入库流水、1 次采购入库，不能删除。请改为归档。"],
    ["This product has 3 lots, so it cannot be deleted. Archive it, or move its lots to another product first.", "这个产品有 3 个批次，不能删除。请改为归档，或先把批次改挂到其他产品。"],
    ["Container CO2-08: return_supplier; physical movement, not inferred liquid consumption.", "实物 CO2-08：退瓶（实物流转，不代表用量）"],
    ["1 container added to the store.", "1 个实物入库。"],
    ["Lot B312451", "批号 B312451"],
    ["Merged; 2 products moved.", "已合并，移动了 2 个产品。"],
    ["Purity must be a number.", "纯度必须是数字。"],
    ["groups: Consumables", "大类：耗材"],
    ["All groups", "全部大类"],
    ["3 will be changed.", "将修改 3 条。"],
    ["1 deleted.", "已删除 1 条。"],
    ["2 will be archived instead:", "2 条仍被引用，将改为归档："],
    ["4 skipped:", "跳过了 4 条："],
    ["…and 7 more.", "……另有 7 条。"],
    ["Still referred to: 2 stock movements, 1 aliquot.", "仍在引用：2 条出入库流水、1 个分装。"],
    ["2 lots are not recorded precisely.", "有 2 个批次不是精确用量登记。"],
    ["Enter 5 to confirm.", "请输入 5 确认。"],
    ["Same brand and catalogue number", "品牌和货号都相同"],
  ])("%s", (english, chinese) => expect(translateUiText(english, "zh")).toBe(chinese));
});
