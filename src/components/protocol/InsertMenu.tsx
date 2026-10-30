'use client';
import { useMemo } from 'react';
import type { Editor } from '@tiptap/core';
import { AlertTriangle, Beaker, Biohazard, Calculator, ClipboardList, Clock, Dna, FlaskConical, Gauge, Grid3x3, Heading2, Heading3, ImagePlus, Layers, LayoutGrid, List, ListOrdered, MoonStar, Package, Paperclip, Percent, Pilcrow, Pipette, Quote, RotateCw, Scale, Shuffle, Table2, Tag, TestTube, Thermometer, TrendingUp, Vibrate, Weight, Wind, Wrench, Zap } from 'lucide-react';
import type { BlockKind } from '@/lib/editor-blocks';
import { parameterDisplayName, protocolChipText, type ToolKind } from '@/lib/protocol-chips';
import type { ProtocolCalculatorId } from '@/lib/protocol-calculations';
import type { ProtocolSystems } from '@/lib/protocol-systems-schema';
import { EditorCommandMenu, type CommandKeyHandler, type EditorCommand, type EditorCommandMenuState } from '../EditorCommandMenu';

export type InsertChoice =
  | { type: 'step' }
  | { type: 'block'; kind: BlockKind }
  | { type: 'quantity'; unit: string } | { type: 'stock' }
  | { type: 'tool'; tool: ToolKind }
  | { type: 'parameter'; id: string }
  | { type: 'program' } | { type: 'mix' } | { type: 'calculation'; calculator: ProtocolCalculatorId }
  | { type: 'table' } | { type: 'image' } | { type: 'file' } | { type: 'callout' } | { type: 'result-template' } | { type: 'embedded-tool' };
type Item = EditorCommand<InsertChoice>;

const items: Item[] = [
  { id: 'step', group: 'Steps', label: 'New step', hint: 'Each block is one action to carry out', keywords: 'buzhou bz step', icon: ListOrdered, choice: { type: 'step' } },
  { id: 'volume', group: 'Amounts', label: 'Volume', hint: 'µL · mL', keywords: 'tiji tj volume ul ml', icon: Pipette, choice: { type: 'quantity', unit: 'µL' } },
  { id: 'stock', group: 'Amounts', label: 'Stock material', hint: 'Amount of an inventory item · deducted when the run completes', keywords: 'kucun kc wuliao wl inventory stock material reagent', icon: Package, choice: { type: 'stock' } },
  { id: 'mass', group: 'Amounts', label: 'Mass', hint: 'mg · µg · ng', keywords: 'zhiliang zl mass mg ug', icon: Weight, choice: { type: 'quantity', unit: 'mg' } },
  { id: 'concentration', group: 'Amounts', label: 'Concentration', hint: 'mM · µM · mg/mL', keywords: 'nongdu nd concentration mm um', icon: FlaskConical, choice: { type: 'quantity', unit: 'mM' } },
  { id: 'percent', group: 'Amounts', label: 'Percentage', hint: '% v/v', keywords: 'bili bl percent', icon: Percent, choice: { type: 'quantity', unit: '%' } },
  { id: 'time', group: 'Time', label: 'Time', hint: 'min · s · h', keywords: 'shijian sj time min timer jishi', icon: Clock, choice: { type: 'quantity', unit: 'min' } },
  { id: 'temperature', group: 'Environment', label: 'Temperature', hint: '°C', keywords: 'wendu wd temperature', icon: Thermometer, choice: { type: 'quantity', unit: '°C' } },
  { id: 'ph', group: 'Environment', label: 'pH', hint: 'pH 7.4', keywords: 'ph suanjian', icon: TestTube, choice: { type: 'quantity', unit: 'pH' } },
  { id: 'gas', group: 'Environment', label: 'Gas', hint: 'CO₂ · O₂ %', keywords: 'qiti qt gas co2', icon: Wind, choice: { type: 'tool', tool: 'gas' } },
  { id: 'dark', group: 'Environment', label: 'Protect from light', hint: 'Keep out of light while working', keywords: 'biguang bg dark light', icon: MoonStar, choice: { type: 'tool', tool: 'dark' } },
  { id: 'centrifuge', group: 'Equipment operations', label: 'Centrifuge', hint: '×g or rpm · time · temperature', keywords: 'lixin lx centrifuge spin xg rpm', icon: RotateCw, choice: { type: 'tool', tool: 'centrifuge' } },
  { id: 'mix', group: 'Equipment operations', label: 'Mix', hint: 'Vortex · invert · pipette', keywords: 'hunyun hy mix vortex', icon: Shuffle, choice: { type: 'tool', tool: 'mix' } },
  { id: 'incubate', group: 'Equipment operations', label: 'Incubate', hint: 'Temperature · time', keywords: 'fuyu fy incubate', icon: Thermometer, choice: { type: 'tool', tool: 'incubate' } },
  { id: 'shake', group: 'Equipment operations', label: 'Shaker', hint: 'rpm · time', keywords: 'yaochuang yc shake shaker', icon: Vibrate, choice: { type: 'tool', tool: 'shake' } },
  { id: 'vacuum', group: 'Equipment operations', label: 'Vacuum', hint: 'mbar · time', keywords: 'zhenkong zk vacuum', icon: Gauge, choice: { type: 'tool', tool: 'vacuum' } },
  { id: 'electrophoresis', group: 'Equipment operations', label: 'Electrophoresis', hint: 'Voltage · current · time', keywords: 'dianyong dy electrophoresis gel', icon: Zap, choice: { type: 'tool', tool: 'electrophoresis' } },
  { id: 'electroporation', group: 'Equipment operations', label: 'Electroporation', hint: 'Voltage · capacitance · resistance', keywords: 'dianzhuan dz electroporation', icon: Zap, choice: { type: 'tool', tool: 'electroporation' } },
  { id: 'pcr', group: 'Programs', label: 'PCR / thermal cycler', hint: 'Denature · anneal · extend · cycles', keywords: 'pcr rexunhuan rxh thermocycler kuozeng', icon: Thermometer, choice: { type: 'program' } },
  { id: 'mix-card', group: 'Programs', label: 'Mix card', hint: 'Per-reaction amounts · scaled to the run', keywords: 'peiyeka pyk yuhun master mix premix recipe hunhe', icon: Beaker, choice: { type: 'mix' } },
  { id: 'gradient', group: 'Programs', label: 'Gradient', hint: 'Start → end', keywords: 'tidu td gradient', icon: TrendingUp, choice: { type: 'tool', tool: 'gradient' } },
  // Each reuses an existing calculator; measured inputs are filled in the Run and the result is confirmed there.
  { id: 'dilution', group: 'Calculations', label: 'Dilution', hint: 'Stock → working solution (C1V1 = C2V2)', keywords: 'jisuan js xishi xs dilution c1v1 calculate', icon: Calculator, choice: { type: 'calculation', calculator: 'dilution' } },
  { id: 'fold-dilution', group: 'Calculations', label: 'Fold dilution', hint: '10× → 1×', keywords: 'jisuan js beishu bs fold 10x xishi', icon: Layers, choice: { type: 'calculation', calculator: 'fold-dilution' } },
  { id: 'molarity', group: 'Calculations', label: 'Solution by weight', hint: 'MW × concentration × volume', keywords: 'jisuan js chengliang cl peiye molarity weigh', icon: Scale, choice: { type: 'calculation', calculator: 'molarity' } },
  { id: 'hemocytometer', group: 'Calculations', label: 'Cell count', hint: 'Hemocytometer → cell density', keywords: 'jisuan js xibao jishu xbjs cell count hemocytometer', icon: Grid3x3, choice: { type: 'calculation', calculator: 'hemocytometer' } },
  { id: 'seeding', group: 'Calculations', label: 'Cell seeding', hint: 'Cell suspension + medium', keywords: 'jisuan js puban pb jiezhong seeding plating', icon: LayoutGrid, choice: { type: 'calculation', calculator: 'seeding' } },
  { id: 'transfection', group: 'Calculations', label: 'Transfection mix', hint: 'DNA stock · reagent · diluent', keywords: 'jisuan js zhuanran zr transfection lipo', icon: Dna, choice: { type: 'calculation', calculator: 'transfection' } },
  { id: 'moi', group: 'Calculations', label: 'Infection MOI', hint: 'Titer → virus volume', keywords: 'jisuan js ganran gr moi bingdu virus lentivirus', icon: Biohazard, choice: { type: 'calculation', calculator: 'moi' } },
  { id: 'paragraph', group: 'Basic blocks', label: 'Body', hint: 'Plain paragraph', keywords: 'zhengwen zw body text paragraph', icon: Pilcrow, choice: { type: 'block', kind: 'paragraph' } },
  { id: 'heading', group: 'Basic blocks', label: 'Heading', hint: 'Or type # and a space at the start of a line', keywords: 'biaoti bt heading title h2', icon: Heading2, choice: { type: 'block', kind: 'heading' } },
  { id: 'subheading', group: 'Basic blocks', label: 'Subheading', hint: 'Or type ## and a space at the start of a line', keywords: 'xiaobiaoti xbt subheading h3', icon: Heading3, choice: { type: 'block', kind: 'subheading' } },
  { id: 'quote', group: 'Basic blocks', label: 'Quote', hint: 'Excerpt or reference', keywords: 'yinyong yy quote blockquote', icon: Quote, choice: { type: 'block', kind: 'quote' } },
  { id: 'bullet', group: 'Basic blocks', label: 'Bullet points', hint: 'Or type - and a space', keywords: 'liebiao lb xiangmu xm bullet list', icon: List, choice: { type: 'block', kind: 'bullet' } },
  { id: 'ordered', group: 'Basic blocks', label: 'Numbered list', hint: 'For steps, use "New step"', keywords: 'bianhao bh numbered ordered list', icon: ListOrdered, choice: { type: 'block', kind: 'ordered' } },
  // Named parameters (Existing parameters) come here, between Basic blocks and Content.
  { id: 'table', group: 'Content', label: 'Table', hint: 'Recipe table columns can be tagged by system', keywords: 'biaoge bg table', icon: Table2, choice: { type: 'table' } },
  { id: 'image', group: 'Content', label: 'Image', hint: 'Choose or drop in', keywords: 'tupian tp image', icon: ImagePlus, choice: { type: 'image' } },
  { id: 'file', group: 'Content', label: 'File', hint: 'Choose or drop in an attachment', keywords: 'wenjian wj file attachment fujian', icon: Paperclip, choice: { type: 'file' } },
  { id: 'callout', group: 'Content', label: 'Tip', hint: 'Caution or risk', keywords: 'tishi ts callout warning', icon: AlertTriangle, choice: { type: 'callout' } },
  { id: 'result-template', group: 'Content', label: 'Result template', hint: 'Fields, data tables and file requirements', keywords: 'jieguo jg moban mb result template', icon: ClipboardList, choice: { type: 'result-template' } },
  { id: 'embedded-tool', group: 'Content', label: 'Embedded tool', hint: 'An existing tool, link or app path', keywords: 'qianru qr gongju gj embed tool plate', icon: Wrench, choice: { type: 'embedded-tool' } },
];

/** Named parameters to place again in the text, e.g. a reagent linked to the material table. */
function parameterItems(systems: ProtocolSystems | undefined): Item[] {
  return (systems?.parameters ?? []).filter(p => !p.ownerToolId && (p.label.trim() || p.materialRef || !p.origin)).map(p => {
    const name = parameterDisplayName(p);
    return { id: `parameter:${p.id}`, group: 'Existing parameters', label: name, hint: protocolChipText(p.id, systems).replace(/^〔|〕$/g, ''), keywords: `${name.toLowerCase()} ${p.unit.toLowerCase()} yiyou canshu`, icon: Tag, choice: { type: 'parameter', id: p.id } };
  });
}

/** The Protocol's "/" menu (also opened by a block's ＋): steps, quantities, environment, equipment, programs, calculations, text, parameters, content. */
export function InsertMenu({ editor, state, stepsAllowed, systems, onChoose, onClose, keyRef }: { editor: Editor; state: EditorCommandMenuState; stepsAllowed: boolean; systems: ProtocolSystems | undefined; onChoose: (choice: InsertChoice) => void; onClose: () => void; keyRef: CommandKeyHandler }) {
  const commands = useMemo(() => items.flatMap(item => item.id === 'table' ? [...parameterItems(systems), item] : [item]).filter(item => stepsAllowed || item.choice.type !== 'step'), [stepsAllowed, systems]);
  return <EditorCommandMenu editor={editor} state={state} commands={commands} label="Insert a parameter or tool" searchPlaceholder="Search: volume, centrifuge, tj…" emptyText="No matching parameter or tool" onChoose={onChoose} onClose={onClose} keyRef={keyRef} />;
}
