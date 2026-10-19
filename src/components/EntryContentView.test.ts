import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { EntryContentView } from './EntryContentView';

describe('Entry saved formatting', () => {
  it('keeps nested emphasis inside a saved link, size and risk-color wrapper', () => {
    const html = renderToStaticMarkup(createElement(EntryContentView, {
      markdown: '<mark data-labnest-color="risk"><span data-labnest-size="16">[**++*中文 text*++**](https://example.org)</span></mark>',
    }));
    expect(html).toMatch(/<strong[^>]*><u[^>]*><em>中文 text<\/em><\/u><\/strong>/);
    expect(html).toContain('href="https://example.org"');
    expect(html).toContain('data-labnest-size="16"');
    expect(html).toContain('data-labnest-color="risk"');
  });
});
