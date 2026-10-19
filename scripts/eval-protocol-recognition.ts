/**
 * The evaluation set for 整理说明书或非模板规程: real manuals and Protocols with hand-checked expectations,
 * scored the same way every time a prompt or a model changes.
 *
 *   DATABASE_URL=postgresql://…/<test database> LABNEST_AI_ENCRYPTION_KEY=… \
 *     npx tsx scripts/eval-protocol-recognition.ts [--provider <AI 设置里的服务名称>] [--case <name>]
 *
 * Cases live outside the repository, in .local-runtime/protocol-recognition-eval/cases/<name>/: one source file
 * (source.pdf, source.docx, source.txt or source.md) and expected.json. Without --provider only the rules reading is
 * scored; with it, the AI reading too (AI must be switched on in AI 设置: this script obeys the same switch).
 */
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { resolveAdapterForProvider } from '../src/lib/ai-server';
import { prisma } from '../src/lib/db';
import type { ConversionSummary } from '../src/lib/protocol-conversion';
import { projectProtocolDocument, type ProtocolDocument } from '../src/lib/protocol-document';
import { habitTextProtocol, recognizeProtocolText } from '../src/lib/protocol-recognition';
import { readAsWritten } from '../src/lib/protocol-recognition.server';
import { readSourceFile } from '../src/lib/protocol-source-text.server';

type Expected = {
  /** How many steps a careful reader counts. */
  steps: number;
  /** One phrase per step, in order: the step's text should contain it. */
  stepKeywords?: string[];
  /** Amounts that should become chips, as they read: "350/600 µL", "12000 ×g", "2 min". */
  parameters?: string[];
  /** Names of the choices the Protocol depends on ("体系"), conditions ("富脂"), and what to record ("A260/280"). */
  systems?: string[];
  conditions?: string[];
  record?: string[];
};
type Reading = { document: ProtocolDocument; summary: ConversionSummary };

const root = '.local-runtime/protocol-recognition-eval';
const argument = (name: string) => { const index = process.argv.indexOf(`--${name}`); return index > 0 ? process.argv[index + 1] : undefined; };
let n = 0;
const newId = (prefix: string) => `${prefix}-eval-${++n}`;
const fold = (text: string) => text.normalize('NFKC').toLowerCase().replace(/×/g, 'x').replace(/(\d),(?=\d{3}\b)/g, '$1').replace(/\s+/g, '');

/** Each part of the score is a fraction from 0 to 1; a part without an expectation is left out of the mean. */
function score(reading: Reading, expected: Expected) {
  const projection = projectProtocolDocument(reading.document);
  const stepTexts = projection.steps.map(step => fold(`${step.title} ${step.description ?? ''}`));
  const chips = new Set(reading.summary.chips.map(fold));
  const systems = (reading.document.systems?.dimensions ?? []).map(dimension => fold(dimension.label));
  const conditions = reading.summary.conditions.map(fold);
  const record = projection.resultTemplates.flatMap(template => [...template.fields.map(field => field.label ?? field.name ?? ''), ...(template.artifacts ?? []).map(artifact => artifact.label)]).map(fold);
  const share = (wanted: string[] | undefined, found: (item: string, index: number) => boolean) => wanted?.length ? wanted.filter(found).length / wanted.length : undefined;
  const parts = {
    steps: Math.max(0, 1 - Math.abs(projection.steps.length - expected.steps) / Math.max(1, expected.steps)),
    stepKeywords: share(expected.stepKeywords, (keyword, index) => [index - 1, index, index + 1].some(at => stepTexts[at]?.includes(fold(keyword)))),
    parameters: share(expected.parameters, parameter => chips.has(fold(parameter))),
    systems: share(expected.systems, label => systems.some(system => system.includes(fold(label)))),
    conditions: share(expected.conditions, label => conditions.some(condition => condition.includes(fold(label)))),
    record: share(expected.record, label => record.some(item => item.includes(fold(label)))),
  };
  const present = Object.values(parts).filter((value): value is number => value !== undefined);
  return { ...parts, overall: present.reduce((sum, value) => sum + value, 0) / present.length, foundSteps: projection.steps.length, chips: reading.summary.chips.length };
}

async function main() {
  const database = new URL(process.env.DATABASE_URL ?? 'postgresql://unset/unset');
  if (database.pathname === '/labnest') throw new Error('Use a test database, never the formal one.');
  const providerName = argument('provider');
  const only = argument('case');
  const resolved = providerName ? await (async () => {
    const provider = await prisma.aIProvider.findFirst({ where: { name: providerName } });
    if (!provider) throw new Error(`AI 设置里没有名为“${providerName}”的服务`);
    const result = await resolveAdapterForProvider(provider.id, undefined, { timeoutMs: 240_000 });
    if (!result.ok) throw new Error(result.error);
    if (!result.adapter.complete) throw new Error('这个服务不支持整理文本');
    return result;
  })() : undefined;
  const names = (await readdir(`${root}/cases`, { withFileTypes: true }).catch(() => [])).filter(entry => entry.isDirectory()).map(entry => entry.name).filter(name => !only || name === only).sort();
  if (!names.length) throw new Error(`没有评测样本：在 ${root}/cases/<名称>/ 下放 source 文件和 expected.json`);
  const rows = [];
  for (const name of names) {
    const folder = path.join(root, 'cases', name);
    const files = await readdir(folder);
    const sourceName = files.find(file => /^source\.(pdf|docx|txt|md)$/i.test(file));
    if (!sourceName) throw new Error(`${name}：缺少 source.pdf/.docx/.txt/.md`);
    const expected = JSON.parse(await readFile(path.join(folder, 'expected.json'), 'utf8')) as Expected;
    const source = await readSourceFile(sourceName, new Uint8Array(await readFile(path.join(folder, sourceName))));
    const rules: Reading = readAsWritten(source, newId);
    const row: Record<string, unknown> = { case: name, kind: source.kind, chars: source.text.length, rules: score(rules, expected) };
    if (resolved) {
      const started = Date.now();
      const result = await recognizeProtocolText(source.text, (system, user) => resolved.adapter.complete!(system, user));
      await resolved.gate.assertAllowed();
      row.ai = { ...score(habitTextProtocol(result.habitText, newId), expected), model: result.model ?? resolved.config.defaultModel, attempts: result.attempts, unverified: result.check.unverified, lines: result.check.lines.length, missing: result.check.missing.length, truncated: result.truncated, seconds: Math.round((Date.now() - started) / 1000) };
      await mkdir(path.join(root, 'outputs'), { recursive: true });
      await writeFile(path.join(root, 'outputs', `${name}.${providerName}.txt`), result.habitText);
    }
    rows.push(row);
    const line = (label: string, value: unknown) => { const s = value as ReturnType<typeof score> & { unverified?: number; lines?: number; attempts?: number }; return `${label} ${(s.overall * 100).toFixed(0)}%（步骤 ${s.foundSteps}/${expected.steps}，参数块 ${s.parameters === undefined ? '—' : `${(s.parameters * 100).toFixed(0)}%`}${s.lines !== undefined ? `，未核实 ${s.unverified}/${s.lines}，第 ${s.attempts} 次` : ''}）`; };
    console.log(`${name}：${line('不用 AI', row.rules)}${row.ai ? `；${line('AI', row.ai)}` : ''}`);
  }
  await mkdir(path.join(root, 'reports'), { recursive: true });
  const file = path.join(root, 'reports', `${new Date().toISOString().replace(/[:.]/g, '-')}-${providerName ?? 'rules'}.json`);
  await writeFile(file, JSON.stringify({ provider: providerName ?? null, at: new Date().toISOString(), cases: rows }, null, 2));
  console.log(`报告：${file}`);
}

main().catch(error => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
