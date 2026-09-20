import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CardBody } from './Card';

describe('CardBody layout attributes', () => {
  it('keeps the DOM attributes needed for responsive parameter scrolling', () => {
    const props = { 'data-visualization-parameter-scroll': true, 'aria-label': 'Figure parameters', children: 'Controls' };
    const html = renderToStaticMarkup(createElement(CardBody, props));
    expect(html).toContain('data-visualization-parameter-scroll="true"');
    expect(html).toContain('aria-label="Figure parameters"');
    expect(html).toContain('Controls');
  });
});
