import { describe, expect, it } from 'vitest';
import { translateUiText } from './i18n';

const zh = (text: string) => translateUiText(text, 'zh');

describe('Chinese for organizing a manual in two passes', () => {
  it.each([
    ['Contents and scope', '目录与范围'],
    ['Organize in Chinese (numbers, units, reagent names and catalog numbers as in the original)', '中文整理（数值、单位、试剂名、货号照原文）'],
    ['Systems (体系): values are written in this order', '体系（体系）：用量按这个顺序写'],
    ['3 of 41 lines could not be found in the lines they cite; they are marked in the draft and will be saved as unverified.', '41 行中有 3 行在所指的原文里找不到，已在整理稿中标出，保存后标为未核实。'],
    ['Each of the 12 lines was found in the lines it cites: its amounts, names and system order.', '12 行都在所指的原文里找到：数值、名称和体系顺序都对得上。'],
    ['Pages read: 24 of 46 · 61234 characters sent · 7 model requests in the second pass', '读取 46 页中的 24 页 · 发送 61234 字 · 第二遍调用模型 7 次'],
    ['Systems: values are written in this order', '体系：用量按这个顺序写'],
    ['Pages read: 1 of 1', '读取 1 页中的 1 页'],
    ['Amounts not in the cited lines: 750 µL, 12000 ×g; Names not in the cited lines: RW2', '数值不在指向的原文：750 µL、12000 ×g；名称不在指向的原文：RW2'],
    ['Values per system in another order than the original: 600/350 µL', '体系取值顺序与原文不一致：600/350 µL'],
    ['No source position', '没有原文位置'],
    ['Source position not found: p2:9, p3:1', '原文位置不存在：p2:9、p3:1'],
    ['Only 54% matches the cited lines', '与指向的原文只对上 54%'],
    ['Show p3:12–14 in the original', '在原文中查看 p3:12–14'],
    ['Page 7', '第 7 页'],
    [' organized (deepseek-v4-flash): Converted to step blocks: 5 steps, 3 parameter blocks, 1 system', ' 整理（deepseek-v4-flash）：转换为步骤块：5 步，3 个参数块，1 个体系'],
  ])('%s', (english, chinese) => expect(zh(english)).toBe(chinese));
});
