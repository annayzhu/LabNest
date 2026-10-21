import { describe, expect, it } from 'vitest';
import { translateUiText } from './i18n';

describe('The picture upload in Chinese', () => {
  it.each([
    ['Upload pictures', '上传图片'],
    ['Picture 3', '第 3 张'],
    ['Read · 120 characters', '已识别 · 120 字'],
    ['Move picture 2 up', '第 2 张上移'],
    ['Move picture 2 down', '第 2 张下移'],
    ['Retry picture 4', '重试第 4 张'],
    ['Delete picture 5', '删除第 5 张'],
    ['Text read from picture 1', '第 1 张识别出的文字'],
    ['Reading… 3 / 12', '识别中… 3 / 12'],
    ['Read pictures (12)', '识别图片（12 张）'],
    ['Try the 2 that failed again', '重试 2 张没读出来的'],
    ['At most 50 pictures; 2 extra ignored.', '最多 50 张，已忽略多出的 2 张。'],
    ['Sending 5 pictures to “通义千问 VL”, one at a time.', '将把 5 张图片发给“通义千问 VL”，每张单独发送。'],
    ['Service that reads photos', '识别图片用的服务'],
    ['Use 通义千问', '使用通义千问'],
    ['Use Gemini', '使用 Gemini'],
  ])('%s', (english, chinese) => expect(translateUiText(english, 'zh')).toBe(chinese));
});
