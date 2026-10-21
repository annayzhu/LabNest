import { describe, expect, it } from 'vitest';
import { translateUiText } from './i18n';

describe('The product manual search in Chinese', () => {
  it.each([
    ['Find the manual of a product', '按产品查找说明书'],
    ['Organize into a Protocol', '整理成规程'],
    ['Kept on inventory item “RNeasy Mini Kit” · 74104', '库存物品“RNeasy Mini Kit”上挂的说明书 · 74104'],
    ['Kept on inventory item “Trizol”', '库存物品“Trizol”上挂的说明书'],
    ['From qiagen.com', '来自 qiagen.com'],
    ['Web search failed: The search service answered 500', '网页搜索失败：搜索服务返回了 500'],
    ['The link is not on a vendor site in the list', '这个链接不在名单里的厂商网站上'],
    ['AI is off, so only the manuals kept on inventory items were searched.', 'AI 未开启，只搜了库存物品上挂的说明书。'],
    ['— a key is saved', '— 已保存密钥'],
  ])('%s', (english, chinese) => expect(translateUiText(english, 'zh')).toBe(chinese));
});
