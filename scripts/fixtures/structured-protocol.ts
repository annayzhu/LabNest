import { createEmptyProtocolDocument, type ProtocolContentBlock } from '../../src/lib/protocol-document';

/** Synthetic software fixture. Values reproduce the spec; this is not a validated wet-lab method. */
export function structuredProtocolFixture() {
  const document = createEmptyProtocolDocument();
  document.executionConfirmed = true;
  document.systems = {
    schemaVersion: 1,
    dimensions: [
      { id: 'volume', label: '裂解体积', options: [{ id: 'small', label: '350 µL' }, { id: 'large', label: '600 µL' }] },
      { id: 'sample', label: '样本性质', options: [{ id: 'normal', label: '普通样本' }, { id: 'lipid', label: '高脂样本' }] },
    ],
    presets: [{ id: 'small-normal', label: '350 µL · 普通样本', selections: { volume: 'small', sample: 'normal' } }, { id: 'large-lipid', label: '600 µL · 高脂样本', selections: { volume: 'large', sample: 'lipid' } }],
    parameters: [
      { id: 'proteinase', label: 'Proteinase K', unit: 'µL', source: { kind: 'lookup', values: [{ id: 'pk-small', when: { all: [{ dimensionId: 'volume', optionId: 'small' }] }, value: 50, unit: 'µL' }, { id: 'pk-large', when: { all: [{ dimensionId: 'volume', optionId: 'large' }] }, value: 80, unit: 'µL' }] } },
      { id: 'ethanol', label: 'Ethanol', unit: 'µL', source: { kind: 'lookup', values: [{ id: 'et-small', when: { all: [{ dimensionId: 'volume', optionId: 'small' }] }, value: 200, unit: 'µL' }, { id: 'et-large', when: { all: [{ dimensionId: 'volume', optionId: 'large' }] }, value: 350, unit: 'µL' }] } },
      { id: 'incubation', label: '孵育时长', unit: 'min', source: { kind: 'fixed', value: 10, unit: 'min' } },
    ],
    rules: [
      { id: 'lipid-step', target: 'step', targetId: 'lipid', when: { all: [{ dimensionId: 'sample', optionId: 'lipid' }] }, parameterIds: [], optional: false, actualFields: [] },
      { id: 'large-row', target: 'row', targetId: 'large-info', when: { all: [{ dimensionId: 'volume', optionId: 'large' }] }, parameterIds: [], optional: false, actualFields: [] },
      { id: 'incubate-timer', target: 'step', targetId: 'incubate', when: {}, parameterIds: ['incubation'], timerParameterId: 'incubation', optional: false, actualFields: [] },
      { id: 'dose-actual', target: 'step', targetId: 'dose', when: {}, parameterIds: ['proteinase', 'ethanol'], optional: false, actualFields: [{ id: 'actual-proteinase', label: '实际 Proteinase K', unit: 'µL', required: true }] },
    ], restrictions: [],
  };
  const heading = (id: string, title: string): ProtocolContentBlock => ({ id: `${id}-heading`, type: 'heading', text: title, execution: { role: 'step', stepId: id, title } });
  document.sections.find(s => s.key === 'description')!.blocks = [{ id: 'notice', type: 'callout', tone: 'note', text: '合成软件验收规程；非经验证的实验方法。' }];
  document.sections.find(s => s.key === 'background')!.blocks = Array.from({ length: 70 }, (_, i) => ({ id: `long-${i}`, type: 'rich_text', nodes: [{ type: i % 10 === 0 ? 'heading2' : 'paragraph', content: [{ text: `${i + 1} · 代表性长正文用于验证中文输入、选择、保存与滚动位置。记录来源和单位，保留实验实际操作与原始数据的关联。`, bold: i % 3 === 0 }] }] }));
  document.sections.find(s => s.key === 'steps')!.blocks = [
    { id: 'shared', type: 'text', text: '共同准备：核对标签和记录编号。', execution: { role: 'info' } },
    heading('prepare', '核对样本'), { id: 'prepare-note', type: 'checklist', items: ['标记管号', '确认原始记录时间'], execution: { role: 'detail', stepId: 'prepare' } },
    heading('dose', '加入试剂'), { id: 'dose-table', type: 'table', rowIds: ['table-head', 'pk-row', 'et-row', 'large-info'], rows: [['组分', '用量'], ['Proteinase K', '{{proteinase}}'], ['Ethanol', '{{ethanol}}'], ['600 µL 体系说明', '此行为条件行']], execution: { role: 'detail', stepId: 'dose' } },
    heading('incubate', '孵育'), { id: 'incubate-text', type: 'text', text: '孵育 {{incubation}}，计时结束后仍需人工确认。', execution: { role: 'detail', stepId: 'incubate' } },
    heading('lipid', '高脂样本补充处理'), { id: 'lipid-text', type: 'text', text: '仅按已确认的样本性质执行；未填写不视为普通样本。', execution: { role: 'detail', stepId: 'lipid' } },
  ];
  return document;
}
