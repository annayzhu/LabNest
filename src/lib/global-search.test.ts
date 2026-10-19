import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/db', () => ({ prisma: {} }));

import { protocolSourceResult, type ProtocolSourceMatch } from './global-search';

const source: ProtocolSourceMatch = {
  versionId: 'v2', protocolId: 'p1', humanCode: 'PRT-200003', displayVersion: '0.2',
  sourceId: 's1', title: 'Proteinase K digestion', citation: 'Smith J. et al. 2020. doi:10.1000/xyz123', url: null, note: null,
};

describe('A Protocol source in global search', () => {
  it('opens the version at its 来源与依据 and shows the passage that matched', () => {
    expect(protocolSourceResult(source, '10.1000/xyz')).toMatchObject({
      type: 'protocol_source', title: 'Proteinase K digestion', subtitle: 'PRT-200003 · v0.2',
      href: '/protocols/p1?version=v2#section-sources', matchedText: 'Smith J. et al. 2020. doi:10.1000/xyz123',
    });
  });

  it('is named by its citation or link when it has no title', () => {
    expect(protocolSourceResult({ ...source, title: '', citation: null, url: 'https://doi.org/10.1/abc' }, 'abc').title).toBe('https://doi.org/10.1/abc');
  });
});
