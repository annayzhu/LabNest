'use client';
import { useMemo } from 'react';
import { AlertTriangle, Beaker, Biohazard, Calculator, ClipboardList, Clock, Dna, FlaskConical, Gauge, Grid3x3, Heading2, Heading3, ImagePlus, Layers, LayoutGrid, List, ListOrdered, MoonStar, Paperclip, Percent, Pilcrow, Pipette, Quote, RotateCw, Scale, Shuffle, Table2, Tag, TestTube, Thermometer, TrendingUp, Vibrate, Weight, Wind, Wrench, Zap } from 'lucide-react';
import type { BlockKind } from '@/lib/editor-blocks';
import { parameterDisplayName, protocolChipText, type ToolKind } from '@/lib/protocol-chips';
import type { ProtocolCalculatorId } from '@/lib/protocol-calculations';
import type { ProtocolSystems } from '@/lib/protocol-systems-schema';
import { EditorCommandMenu, type CommandKeyHandler, type EditorCommand, type EditorCommandMenuState } from '../EditorCommandMenu';

export type InsertChoice =
  | { type: 'step' }
  | { type: 'block'; kind: BlockKind }
  | { type: 'quantity'; unit: string }
  | { type: 'tool'; tool: ToolKind }
  | { type: 'parameter'; id: string }
  | { type: 'program' } | { type: 'mix' } | { type: 'calculation'; calculator: ProtocolCalculatorId }
  | { type: 'table' } | { type: 'image' } | { type: 'file' } | { type: 'callout' } | { type: 'result-template' } | { type: 'embedded-tool' };
type Item = EditorCommand<InsertChoice>;

const items: Item[] = [
  { id: 'step', group: '步骤', label: '新步骤', hint: '一个块就是一个执行项', keywords: 'buzhou bz step', icon: ListOrdered, choice: { type: 'step' } },
  { id: 'volume', group: '用量', label: '体积', hint: 'µL · mL', keywords: 'tiji tj volume ul ml', icon: Pipette, choice: { type: 'quantity', unit: 'µL' } },
  { id: 'mass', group: '用量', label: '质量', hint: 'mg · µg · ng', keywords: 'zhiliang zl mass mg ug', icon: Weight, choice: { type: 'quantity', unit: 'mg' } },
  { id: 'concentration', group: '用量', label: '浓度', hint: 'mM · µM · mg/mL', keywords: 'nongdu nd concentration mm um', icon: FlaskConical, choice: { type: 'quantity', unit: 'mM' } },
  { id: 'percent', group: '用量', label: '比例', hint: '% v/v', keywords: 'bili bl percent', icon: Percent, choice: { type: 'quantity', unit: '%' } },
  { id: 'time', group: '时间', label: '时间', hint: 'min · s · h', keywords: 'shijian sj time min timer jishi', icon: Clock, choice: { type: 'quantity', unit: 'min' } },
  { id: 'temperature', group: '环境', label: '温度', hint: '°C', keywords: 'wendu wd temperature', icon: Thermometer, choice: { type: 'quantity', unit: '°C' } },
  { id: 'ph', group: '环境', label: 'pH', hint: 'pH 7.4', keywords: 'ph suanjian', icon: TestTube, choice: { type: 'quantity', unit: 'pH' } },
  { id: 'gas', group: '环境', label: '气体', hint: 'CO₂ · O₂ %', keywords: 'qiti qt gas co2', icon: Wind, choice: { type: 'tool', tool: 'gas' } },
  { id: 'dark', group: '环境', label: '避光', hint: '操作时避光', keywords: 'biguang bg dark light', icon: MoonStar, choice: { type: 'tool', tool: 'dark' } },
  { id: 'centrifuge', group: '设备操作', label: '离心', hint: '×g 或 rpm · 时间 · 温度', keywords: 'lixin lx centrifuge spin xg rpm', icon: RotateCw, choice: { type: 'tool', tool: 'centrifuge' } },
  { id: 'mix', group: '设备操作', label: '混匀', hint: '涡旋 · 颠倒 · 吹打', keywords: 'hunyun hy mix vortex', icon: Shuffle, choice: { type: 'tool', tool: 'mix' } },
  { id: 'incubate', group: '设备操作', label: '孵育', hint: '温度 · 时间', keywords: 'fuyu fy incubate', icon: Thermometer, choice: { type: 'tool', tool: 'incubate' } },
  { id: 'shake', group: '设备操作', label: '摇床', hint: 'rpm · 时间', keywords: 'yaochuang yc shake shaker', icon: Vibrate, choice: { type: 'tool', tool: 'shake' } },
  { id: 'vacuum', group: '设备操作', label: '真空', hint: 'mbar · 时间', keywords: 'zhenkong zk vacuum', icon: Gauge, choice: { type: 'tool', tool: 'vacuum' } },
  { id: 'electrophoresis', group: '设备操作', label: '电泳', hint: '电压 · 电流 · 时间', keywords: 'dianyong dy electrophoresis gel', icon: Zap, choice: { type: 'tool', tool: 'electrophoresis' } },
  { id: 'electroporation', group: '设备操作', label: '电转', hint: '电压 · 电容 · 电阻', keywords: 'dianzhuan dz electroporation', icon: Zap, choice: { type: 'tool', tool: 'electroporation' } },
  { id: 'pcr', group: '程序', label: 'PCR／热循环', hint: '变性 · 退火 · 延伸 · 循环', keywords: 'pcr rexunhuan rxh thermocycler kuozeng', icon: Thermometer, choice: { type: 'program' } },
  { id: 'mix-card', group: '程序', label: '配液卡', hint: '每反应用量 · 执行时按数量换算', keywords: 'peiyeka pyk yuhun master mix premix recipe hunhe', icon: Beaker, choice: { type: 'mix' } },
  { id: 'gradient', group: '程序', label: '梯度', hint: '起始 → 终止', keywords: 'tidu td gradient', icon: TrendingUp, choice: { type: 'tool', tool: 'gradient' } },
  // Each reuses an existing calculator; measured inputs are filled in the Run and the result is confirmed there.
  { id: 'dilution', group: '计算', label: '稀释', hint: '母液 → 工作液（C1V1 = C2V2）', keywords: 'jisuan js xishi xs dilution c1v1 calculate', icon: Calculator, choice: { type: 'calculation', calculator: 'dilution' } },
  { id: 'fold-dilution', group: '计算', label: '倍数稀释', hint: '10× → 1×', keywords: 'jisuan js beishu bs fold 10x xishi', icon: Layers, choice: { type: 'calculation', calculator: 'fold-dilution' } },
  { id: 'molarity', group: '计算', label: '称量配液', hint: '分子量 × 浓度 × 体积', keywords: 'jisuan js chengliang cl peiye molarity weigh', icon: Scale, choice: { type: 'calculation', calculator: 'molarity' } },
  { id: 'hemocytometer', group: '计算', label: '细胞计数', hint: '计数板 → 细胞浓度', keywords: 'jisuan js xibao jishu xbjs cell count hemocytometer', icon: Grid3x3, choice: { type: 'calculation', calculator: 'hemocytometer' } },
  { id: 'seeding', group: '计算', label: '细胞铺板', hint: '细胞悬液 + 培养基', keywords: 'jisuan js puban pb jiezhong seeding plating', icon: LayoutGrid, choice: { type: 'calculation', calculator: 'seeding' } },
  { id: 'transfection', group: '计算', label: '转染体系', hint: 'DNA 原液 · 试剂 · 稀释液', keywords: 'jisuan js zhuanran zr transfection lipo', icon: Dna, choice: { type: 'calculation', calculator: 'transfection' } },
  { id: 'moi', group: '计算', label: '感染 MOI', hint: '滴度 → 病毒液体积', keywords: 'jisuan js ganran gr moi bingdu virus lentivirus', icon: Biohazard, choice: { type: 'calculation', calculator: 'moi' } },
  { id: 'paragraph', group: '文字', label: '正文', hint: '普通段落', keywords: 'zhengwen zw body text paragraph', icon: Pilcrow, choice: { type: 'block', kind: 'paragraph' } },
  { id: 'heading', group: '文字', label: '标题', hint: '也可在行首输入 # 和空格', keywords: 'biaoti bt heading title h2', icon: Heading2, choice: { type: 'block', kind: 'heading' } },
  { id: 'subheading', group: '文字', label: '小标题', hint: '也可在行首输入 ## 和空格', keywords: 'xiaobiaoti xbt subheading h3', icon: Heading3, choice: { type: 'block', kind: 'subheading' } },
  { id: 'quote', group: '文字', label: '引用', hint: '摘录或参考', keywords: 'yinyong yy quote blockquote', icon: Quote, choice: { type: 'block', kind: 'quote' } },
  { id: 'bullet', group: '文字', label: '项目列表', hint: '也可输入 - 和空格', keywords: 'liebiao lb xiangmu xm bullet list', icon: List, choice: { type: 'block', kind: 'bullet' } },
  { id: 'ordered', group: '文字', label: '编号列表', hint: '步骤请用"新步骤"', keywords: 'bianhao bh numbered ordered list', icon: ListOrdered, choice: { type: 'block', kind: 'ordered' } },
  // Named parameters (已有参数) come here, between 文字 and 内容.
  { id: 'table', group: '内容', label: '表格', hint: '配方表的列可标体系', keywords: 'biaoge bg table', icon: Table2, choice: { type: 'table' } },
  { id: 'image', group: '内容', label: '图片', hint: '选择或拖入', keywords: 'tupian tp image', icon: ImagePlus, choice: { type: 'image' } },
  { id: 'file', group: '内容', label: '文件', hint: '选择或拖入附件', keywords: 'wenjian wj file attachment fujian', icon: Paperclip, choice: { type: 'file' } },
  { id: 'callout', group: '内容', label: '提示', hint: '注意事项或风险', keywords: 'tishi ts callout warning', icon: AlertTriangle, choice: { type: 'callout' } },
  { id: 'result-template', group: '内容', label: '结果模板', hint: '字段、数据表与文件要求', keywords: 'jieguo jg moban mb result template', icon: ClipboardList, choice: { type: 'result-template' } },
  { id: 'embedded-tool', group: '内容', label: '嵌入工具', hint: '已有工具、链接或应用路径', keywords: 'qianru qr gongju gj embed tool plate', icon: Wrench, choice: { type: 'embedded-tool' } },
];

/** Named parameters to place again in the text, e.g. a reagent linked to the material table. */
function parameterItems(systems: ProtocolSystems | undefined): Item[] {
  return (systems?.parameters ?? []).filter(p => !p.ownerToolId && (p.label.trim() || p.materialRef || !p.origin)).map(p => {
    const name = parameterDisplayName(p);
    return { id: `parameter:${p.id}`, group: '已有参数', label: name, hint: protocolChipText(p.id, systems).replace(/^〔|〕$/g, ''), keywords: `${name.toLowerCase()} ${p.unit.toLowerCase()} yiyou canshu`, icon: Tag, choice: { type: 'parameter', id: p.id } };
  });
}

/** The Protocol's "/" menu (also opened by a block's ＋): steps, quantities, environment, equipment, programs, calculations, text, parameters, content. */
export function InsertMenu({ state, stepsAllowed, systems, onChoose, onClose, keyRef }: { state: EditorCommandMenuState; stepsAllowed: boolean; systems: ProtocolSystems | undefined; onChoose: (choice: InsertChoice) => void; onClose: () => void; keyRef: CommandKeyHandler }) {
  const commands = useMemo(() => items.flatMap(item => item.id === 'table' ? [...parameterItems(systems), item] : [item]).filter(item => stepsAllowed || item.choice.type !== 'step'), [stepsAllowed, systems]);
  return <EditorCommandMenu state={state} commands={commands} label="插入参数或工具" searchPlaceholder="搜索：体积、离心、tj…" emptyText="没有匹配的参数或工具" onChoose={onChoose} onClose={onClose} keyRef={keyRef} />;
}
