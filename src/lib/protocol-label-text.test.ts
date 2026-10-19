import { describe, expect, it } from 'vitest';
import { protocolLabelsZh, translateUiText } from './i18n';
import { chipKindLabels, toolSpecs } from './protocol-chips';
import { protocolCalculations } from './protocol-calculations';
import { conditionTagLabel, conditionTagLabelZh } from './protocol-conditions';
import { parameterLongNameText, parameterNameText, protocolLabelText } from './protocol-label-text';
import type { ProtocolSystems } from './protocol-systems-schema';

const zh = (text: string) => translateUiText(text, 'zh');
const storedLabels = [
  ...Object.values(chipKindLabels).filter(label => label !== 'pH'),
  ...Object.values(toolSpecs).flatMap(spec => [spec.label, ...spec.fields.map(field => field.label).filter(label => !/^(CO₂|O₂)$/.test(label))]),
  ...Object.values(protocolCalculations).flatMap(spec => [...spec.inputs, ...spec.outputs].map(item => item.label)),
  '涡旋混匀', '颠倒混匀', '吹打混匀', '轻弹混匀', '涡旋', '颠倒', '吹打', '轻弹',
];

describe('protocol chip labels', () => {
  it('shows every stored Chinese label in English and reads it back byte for byte', () => {
    for (const label of storedLabels) {
      const english = protocolLabelText(label);
      expect(english, label).not.toMatch(/[㐀-鿿]/);
      expect(zh(english), label).toBe(label);
    }
  });

  it('keeps every English name unique and its Chinese exact', () => {
    expect(new Set(Object.values(protocolLabelsZh)).size).toBe(Object.keys(protocolLabelsZh).length);
    for (const [english, chinese] of Object.entries(protocolLabelsZh)) {
      expect(zh(english), english).toBe(chinese);
      expect(protocolLabelText(chinese)).toBe(english);
    }
  });

  it('passes typed labels through', () => {
    expect(protocolLabelText('Proteinase K')).toBe('Proteinase K');
    expect(protocolLabelText('裂解液')).toBe('裂解液');
  });

  it('reads calculation names and notes back as they were in Chinese', () => {
    expect(Object.values(protocolCalculations).map(spec => zh(spec.label))).toEqual(['稀释', '倍数稀释', '称量配液', '细胞计数', '细胞铺板', '转染体系', '感染 MOI']);
    expect(zh(protocolCalculations.dilution.note)).toBe('母液稀释到目标浓度（C1V1 = C2V2）。');
    expect(zh(protocolCalculations.hemocytometer.note)).toBe('血球计数板标准大方格：平均每格细胞数 × 稀释倍数 × 10⁴ cells/mL；可只数 1–4 格。');
    expect(zh(protocolCalculations.moi.note)).toBe('滴度须为功能性滴度（TU、IU 或 PFU）；VG 不能用于 MOI。');
    for (const spec of Object.values(protocolCalculations)) expect(zh(spec.note), spec.note).toMatch(/[㐀-鿿]/);
  });

  it('reads the popover and run chip phrases built from labels as before', () => {
    expect(zh('Edit Volume')).toBe('编辑体积');
    expect(zh('Edit Centrifuge')).toBe('编辑离心');
    expect(zh('Edit Parameter')).toBe('编辑参数');
    expect(zh('Purity (optional)')).toBe('纯度（可选）');
    expect(zh('Count 2 source')).toBe('计数 2来源');
    expect(zh('Remove Electric current')).toBe('移除电流');
    expect(zh('Cell count calculation')).toBe('细胞计数计算');
    expect(zh('Centrifuge · Spin speed')).toBe('离心 · 离心力／转速');
    expect(zh('Vortex mix · Time')).toBe('涡旋混匀 · 时间');
    expect(zh('Fill in Stock concentration, Make-up volume to see the expected result.')).toBe('填写母液浓度、定容体积后显示预计结果。');
    // Look-alikes stay as they were.
    expect(zh('Edit Foo')).toBe('编辑 Foo');
    expect(zh('Foo source')).toBe('Foo source');
    expect(zh('Centrifuge · Pre-cool to 4 °C')).toBe('离心 · Pre-cool to 4 °C');
    expect(zh('Mix calculation')).toBe('Mix calculation');
  });

  it('names parameters and tool fields for display', () => {
    const systems = { tools: [{ id: 't1', kind: 'centrifuge', fields: [{ key: 'speed', parameterId: 'p1' }] }, { id: 't2', kind: 'mix', method: '涡旋混匀', fields: [{ key: 'time', parameterId: 'p2' }] }] } as Pick<ProtocolSystems, 'tools'>;
    const parameter = (id: string, extra: object = {}) => ({ id, label: '', unit: 'min', source: { kind: 'fixed', value: null, unit: 'min' }, ...extra }) as ProtocolSystems['parameters'][number];
    expect(parameterLongNameText(parameter('p1', { ownerToolId: 't1', unit: '×g' }), systems)).toBe('Centrifuge · Spin speed');
    expect(parameterLongNameText(parameter('p2', { ownerToolId: 't2' }), systems)).toBe('Vortex mix · Time');
    expect(parameterNameText(parameter('p3'))).toBe('Time');
    expect(parameterNameText(parameter('p4', { label: '母液浓度', unit: 'mM' }))).toBe('Stock concentration');
    expect(parameterNameText(parameter('p5', { label: 'DNase I' }))).toBe('DNase I');
  });
});

describe('condition tags', () => {
  it('reads yes/no conditions in English and exactly as before in Chinese', () => {
    const cases: Array<[string, string, string]> = [['富脂组织', '是', '富脂组织'], ['富脂组织', '否', 'not 富脂组织'], ['组织', '肝', '组织: 肝'], ['新条件', '是', 'New condition'], ['新条件', '否', 'not New condition'], ['Fatty tissue', '否', 'not Fatty tissue']];
    for (const [dimension, option, english] of cases) {
      expect(conditionTagLabel(dimension, option)).toBe(english);
      expect(zh(english)).toBe(conditionTagLabelZh(dimension, option));
    }
    expect(conditionTagLabelZh('富脂组织', '否')).toBe('非富脂组织');
    expect(conditionTagLabelZh('组织', '肝')).toBe('组织：肝');
  });
});
