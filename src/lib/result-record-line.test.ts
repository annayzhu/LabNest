import { describe, expect, it } from 'vitest';
import { normalizeResultTemplate } from './result-templates';
import { parseRecordItems, readBackTemplate, recordLinesOf, templateFromRecordLines } from './result-record-line';

const shape = (line: string) => parseRecordItems(line).map(item => item.kind === 'field'
  ? [item.label, item.dataType, item.unit ?? item.options?.join('/') ?? '', item.required ? 'required' : '']
  : [item.label, item.artifactKind, '', item.required ? 'required' : '']);

describe('A result template written as "记录：…"', () => {
  it('reads each item as written: units make numbers, pictures and files become attachments', () => {
    expect(shape('记录：浓度 ng/µL、A260/280、A260/230、胶图、备注')).toEqual([
      ['浓度', 'number', 'ng/µL', ''], ['A260/280', 'number', '', ''], ['A260/230', 'number', '', ''], ['胶图', 'image', '', ''], ['备注', 'text', '', ''],
    ]);
    expect(shape('记录：浓度（ng/µL）、产量ng，结果（阳性/阴性），是否污染；实验日期、记录时间、细胞数、Ct 值、原始数据、OD600*、RNA 浓度 ng/µl（必填）')).toEqual([
      ['浓度', 'number', 'ng/µL', ''], ['产量', 'number', 'ng', ''], ['结果', 'select', '阳性/阴性', ''], ['是否污染', 'boolean', '', ''],
      ['实验日期', 'date', '', ''], ['记录时间', 'datetime', '', ''], ['细胞数', 'number', '', ''], ['Ct 值', 'number', '', ''],
      ['原始数据', 'file', '', ''], ['OD600', 'number', '', 'required'], ['RNA 浓度', 'number', 'ng/µL', 'required'],
    ]);
  });

  it('builds a template with keys from the labels, and one row per sample when asked', () => {
    const template = templateFromRecordLines({ record: '记录：浓度 ng/µL、A260/280、胶图、备注', perSample: '每个样本：样本名、Ct 值、Tm' }, undefined, 'RNA 质检');
    expect(template.title).toBe('RNA 质检');
    expect(template.fields.map(field => [field.key, field.label, field.dataType, field.unit ?? '', field.semanticRole])).toEqual([
      ['浓度', '浓度', 'number', 'ng/µL', 'measurement'], ['a260_280', 'A260/280', 'number', '', 'measurement'], ['备注', '备注', 'text', '', 'annotation'],
    ]);
    expect(template.artifacts).toEqual([{ key: '胶图', label: '胶图', kind: 'image', required: false }]);
    expect(template.cardinality).toBe('per_sample');
    expect(template.datasets?.[0].columns.map(column => [column.key, column.dataType])).toEqual([['样本名', 'text'], ['ct_值', 'number'], ['tm', 'number']]);
    expect(template.authored).toEqual({ record: '记录：浓度 ng/µL、A260/280、胶图、备注', perSample: '每个样本：样本名、Ct 值、Tm' });
  });

  it('keeps keys and advanced settings through renames, reordering and new items', () => {
    const first = templateFromRecordLines({ record: '记录：浓度 ng/µL、A260/280、备注' });
    first.fields[1] = { ...first.fields[1], semanticRole: 'qc', validation: { min: 1.8 } };
    const renamed = templateFromRecordLines({ record: '记录：RNA 浓度 ng/µL、A260/280、备注' }, first);
    expect(renamed.fields.map(field => field.key)).toEqual(['浓度', 'a260_280', '备注']);
    const reordered = templateFromRecordLines({ record: '记录：备注、A260/280、RNA 浓度 ng/µL、A260/230' }, renamed);
    expect(reordered.fields.map(field => [field.label, field.key])).toEqual([['备注', '备注'], ['A260/280', 'a260_280'], ['RNA 浓度', '浓度'], ['A260/230', 'a260_230']]);
    expect(reordered.fields[1]).toMatchObject({ semanticRole: 'qc', validation: { min: 1.8 } });
    // A new item never takes the key of one that was removed.
    const removed = templateFromRecordLines({ record: '记录：A260/280' }, reordered);
    const readded = templateFromRecordLines({ record: '记录：A260/280、备注 ng' }, removed);
    expect(readded.fields.map(field => field.key)).toEqual(['a260_280', '备注']);
    const changedType = templateFromRecordLines({ record: '记录：A260/280、备注' }, { ...readded, fields: readded.fields.map(field => field.key === '备注' ? { ...field, dataType: 'number' as const, type: 'number' as const } : field) });
    expect(changedType.fields[1]).toMatchObject({ key: '备注', dataType: 'text' });
  });

  it('reads an old field-by-field template back as a line, and round-trips it without changing keys', () => {
    const legacy = normalizeResultTemplate({ result_type: 'RNA_Isolation_Record', fields: [
      { key: 'rna_run_id', label: 'RNA Run ID', dataType: 'text' }, { key: 'concentration', label: 'Concentration', dataType: 'number', unit: 'ng/µL', required: true },
      { key: 'qc', label: 'QC method', dataType: 'select', options: ['NanoDrop', 'Qubit'] },
    ], artifacts: [{ key: 'gel', label: 'Gel image', kind: 'image' }] });
    const lines = recordLinesOf(legacy);
    expect(lines.record).toBe('记录：RNA Run ID、Concentration ng/µL*、QC method（NanoDrop/Qubit）、Gel image');
    const again = templateFromRecordLines(lines, legacy);
    expect(again.fields.map(field => field.key)).toEqual(['rna_run_id', 'concentration', 'qc']);
    expect(again.artifacts?.map(artifact => artifact.key)).toEqual(['gel']);
    expect(again.result_type).toBe('RNA_Isolation_Record');
  });

  it('says back what it understood', () => {
    const template = templateFromRecordLines({ record: '记录：浓度 ng/µL*、结果（阳性/阴性）、胶图', perSample: '每个样本：样本名、Ct 值' });
    expect(readBackTemplate(template)).toEqual({
      items: ['浓度 (number, ng/µL, required)', '结果 (choice, 阳性/阴性)', '胶图 (image)'],
      perSample: ['样本名 (text)', 'Ct 值 (number)'],
    });
  });
});
