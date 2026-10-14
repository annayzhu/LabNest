import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { prisma } from '../src/lib/db';
import { createEmptyProtocolDocument, projectProtocolDocument } from '../src/lib/protocol-document';
import { createScientificDocument, experimentSections, researchPlanSections } from '../src/lib/scientific-document';
import { createExperimentWithProtocolSnapshot } from '../src/lib/experiments';

const url = new URL(process.env.DATABASE_URL!);
assert(process.env.LABNEST_QA_ISOLATED === '1' && ['localhost', '127.0.0.1'].includes(url.hostname) && (url.port === '5441' || url.pathname === '/labnest_editor66_acceptance'), 'Use an explicitly isolated synthetic acceptance database only.');
const output = process.env.LABNEST_QA_DIR ?? 'outputs/experiment-record-flow';
async function main() {
  const stamp = Date.now();
  const project = await prisma.project.create({ data: { name: '实验记录界面合成验收' } });
  const plan = await prisma.researchPlan.create({ data: { projectId: project.id, code: `RPL-${stamp}`, title: '不应自动选择的研究计划', status: 'active', contentJson: createScientificDocument(researchPlanSections) } });
  const versions = [];
  for (let i = 0; i < 3; i++) {
    const doc = createEmptyProtocolDocument(); doc.executionConfirmed = true;
    doc.sections.find(s => s.key === 'steps')!.blocks = [
      { id: 'prepare', type: 'heading', text: '核对样本编号', execution: { role: 'step', stepId: 'prepare', title: '核对样本编号' } },
      { id: 'body', type: 'text', text: '合成软件验收内容。保留正文、单位与步骤关联。', execution: { role: 'detail', stepId: 'prepare' } },
      { id: 'dose', type: 'heading', text: '加入示例试剂', execution: { role: 'step', stepId: 'dose', title: '加入示例试剂' } },
      { id: 'dose-body', type: 'table', rows: [['组分', '用量'], ['示例', i === 0 ? '{{volume}}' : '10 µL']], execution: { role: 'detail', stepId: 'dose' } },
      { id: 'large', type: 'heading', text: '大体系附加操作', execution: { role: 'step', stepId: 'large', title: '大体系附加操作' } },
    ];
    if (i === 0) doc.systems = { schemaVersion: 1, dimensions: [{ id: 'system', label: '反应体系', options: [{ id: 'small', label: '小体系' }, { id: 'large', label: '大体系' }] }], presets: [], parameters: [{ id: 'volume', label: '示例体积', unit: 'µL', source: { kind: 'lookup', values: [{ id: 'small-volume', when: { all: [{ dimensionId: 'system', optionId: 'small' }] }, value: 10, unit: 'µL' }, { id: 'large-volume', when: { all: [{ dimensionId: 'system', optionId: 'large' }] }, value: 20, unit: 'µL' }] } }], restrictions: [], rules: [{ id: 'large-only', target: 'step', targetId: 'large', when: { all: [{ dimensionId: 'system', optionId: 'large' }] }, parameterIds: [], actualFields: [], optional: false }] };
    const title = `合成验收规程 ${i + 1} · 很长的规程名称用于验证编号和操作按钮不会挤压变形`;
    const protocol = await prisma.protocol.create({ data: { humanCode: `PRT-${stamp}${i}`, title, canonicalTitle: title } });
    versions.push(await prisma.protocolVersion.create({ data: { protocolId: protocol.id, revision: 1, title, displayVersion: '1.0', contentJson: doc, stepsJson: projectProtocolDocument(doc).steps } }));
  }
  const document = createScientificDocument(experimentSections);
  document.sections.find(s => s.key === 'setup')!.blocks = Array.from({ length: 8 }, (_, i) => ({ id: `setup-${i}`, type: 'text', text: `合成样本 ${i + 1}，用于目录定位验收。` }));
  document.sections.find(s => s.key === 'execution')!.blocks = [{ id: 'existing-notes', type: 'text', text: '既有执行正文，保存偏差时必须保留。' }];
  document.sections.find(s => s.key === 'observations')!.blocks = [{ id: 'observation', type: 'text', text: '观察内容应位于最后。' }];
  const experiment = await createExperimentWithProtocolSnapshot({ title: '合成验收 · 无计划多规程实验', date: new Date('2026-10-14'), status: 'planned', recordStatus: 'draft', tags: [], contentJson: document, methodMode: 'protocol', protocolVersionIds: versions.map(v => v.id), customSteps: [] });
  mkdirSync(output, { recursive: true });
  writeFileSync(`${output}/fixtures.json`, JSON.stringify({ synthetic: true, planId: plan.id, versionIds: versions.map(v => v.id), experimentId: experiment.id }, null, 2));
  console.log(JSON.stringify({ synthetic: true, experimentId: experiment.id, protocols: versions.length }));
}
main().finally(() => prisma.$disconnect());
