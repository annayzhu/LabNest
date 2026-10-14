import { expect, it } from 'vitest';
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { exportProtocolSystemsTemplate } from './protocol-docx-template';
import { parseProtocolDocxBytes } from './protocol-docx';
import { resolveProtocolDocument } from './structured-protocol';
import { exportProtocolDocx } from './protocol-docx-export';

it('imports an edited Word system table as explicit quantities without scaling common time', () => {
  const files = unzipSync(exportProtocolSystemsTemplate());
  // Simulate a user editing the visible Word table, invalidating the old embedded receipt.
  files['word/document.xml'] = strToU8(strFromU8(files['word/document.xml']).replace('>80<', '>85<'));
  const imported = parseProtocolDocxBytes(zipSync(files), 'two-systems.docx');
  const small = resolveProtocolDocument(imported.document, { volume: 'small', sample: 'ordinary' });
  const large = resolveProtocolDocument(imported.document, { volume: 'large', sample: 'ordinary' });
  expect(small.parameters.proteinase).toMatchObject({ status: 'resolved', value: 50, unit: 'µL' });
  expect(large.parameters.proteinase).toMatchObject({ status: 'resolved', value: 85, unit: 'µL' });
  expect(large.parameters.incubation).toMatchObject({ status: 'resolved', value: 10, unit: 'min' });
  expect(imported.document.executionConfirmed).toBe(false);
  expect(imported.document.importWarnings.join(' ')).toContain('体系');
  expect(large.steps).toHaveLength(3);
  expect(large.steps[1].description).toContain('85');
});

it('retains editable parameter references through a normal all-system DOCX export and reimport', () => {
  const source = parseProtocolDocxBytes(exportProtocolSystemsTemplate(), 'template.docx').document;
  const exported = exportProtocolDocx({ canonicalTitle: '双体系测试', availability: 'draft', reviewStage: 'draft', displayVersion: '1', scope: 'general', tags: [] }, source);
  const imported = parseProtocolDocxBytes(exported, 'roundtrip.docx');
  expect(resolveProtocolDocument(imported.document, { volume: 'large', sample: 'ordinary' }).steps[1].description).toContain('80 µL');
  expect(JSON.stringify(imported.document.sections)).toContain('{{proteinase}}');
});

it('rejects shifted definition headers and incompatible units instead of importing plausible wrong quantities', () => {
  const replace = (before: string, after: string) => { const files = unzipSync(exportProtocolSystemsTemplate()); files['word/document.xml'] = strToU8(strFromU8(files['word/document.xml']).replace(before, after)); return zipSync(files); };
  expect(() => parseProtocolDocxBytes(replace('>量值<', '>错误列<'), 'bad.docx')).toThrow(/表头/);
  expect(() => parseProtocolDocxBytes(replace('>min<', '>µL<'), 'bad-unit.docx')).toThrow();
  const source = parseProtocolDocxBytes(exportProtocolSystemsTemplate(), 'template.docx').document;
  expect(source.systems?.rules.find(rule => rule.targetId === 'prepare')?.scope).toBe('experiment');
  expect(source.systems?.rules.find(rule => rule.targetId === 'wait')?.scope).toBe('group');
});
