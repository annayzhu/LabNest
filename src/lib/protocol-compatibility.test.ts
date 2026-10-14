import { expect, it } from 'vitest';
import { protocolCompatibilityIssue } from './protocol-compatibility';
import { createEmptyProtocolDocument } from './protocol-document';

it('keeps legacy fields readable but prevents unsupported authored content from being silently normalized away', () => {
  expect(protocolCompatibilityIssue({})).toBeUndefined();
  const document = createEmptyProtocolDocument();
  expect(protocolCompatibilityIssue(document)).toBeUndefined();
  const unsupported = { ...document, sections: [{ key: 'steps', title: '旧内容', blocks: [{ id: 'future', type: 'unsupported_assay', text: '原文不得丢失' }] }] };
  expect(protocolCompatibilityIssue(unsupported)).toContain('兼容');
  expect(protocolCompatibilityIssue({ ...document, futureParameters: { value: 50 } })).toContain('futureParameters');
  expect(JSON.stringify(unsupported)).toContain('原文不得丢失');
});

it('does not send unknown rich table nodes to a schema that would drop them', () => {
  const document = createEmptyProtocolDocument();
  document.sections[0].blocks = [{ id: 'table', type: 'table', rows: [['保留']], cellRichContent: [[[{ type: 'futureInstrumentWidget', attrs: { trace: 'original' }, content: [{ type: 'text', text: '保留' }] }]]] }];
  expect(protocolCompatibilityIssue(document)).toContain('兼容只读');
});
