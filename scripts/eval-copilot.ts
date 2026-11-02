/**
 * The evaluation set for the Copilot task specs (Q335, Q336): fixed cases with hand-checked expectations, run the same
 * way whenever a spec or a service changes, so a new spec version replaces the old one only when it does no worse.
 *
 *   DATABASE_URL=postgresql://…/<test database> LABNEST_AI_ENCRYPTION_KEY=… \
 *     npx tsx scripts/eval-copilot.ts [--provider <AI 设置里的服务名称>] [--spec <task spec, e.g. entry.tidy>] [--repeat 3]
 *
 * Without --provider nothing is sent anywhere: each case's hand-written answer goes through the same reader and checks,
 * showing the cases and the checks agree. With --provider the cases go to that service, each --repeat times (AI must be
 * on in that database's AI 设置; this script obeys the same switch). The report gives, per case, how often the answer
 * passed every check and how often the runs agreed with each other, and is written to .local-runtime/copilot-eval/.
 * Never point it at a ChatGPT sign-in from a copied database: every token refresh there signs the original out.
 * Organizing manuals has its own runner, scripts/eval-protocol-recognition.ts.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { resolveAdapterForProvider } from '../src/lib/ai-server';
import { evalCases, type Check } from '../src/lib/copilot/eval-cases';
import { taskSpecs } from '../src/lib/copilot/specs';
import { prisma } from '../src/lib/db';

const argument = (name: string) => { const index = process.argv.indexOf(`--${name}`); return index > 0 ? process.argv[index + 1] : undefined; };
const root = '.local-runtime/copilot-eval';

async function main() {
  const providerName = argument('provider');
  const spec = argument('spec');
  const repeat = Math.max(1, Math.min(10, Number(argument('repeat') ?? 3)));
  const cases = evalCases.filter(item => !spec || item.spec === spec);
  if (!cases.length) throw new Error(`没有这个任务规范的评测样本：${spec}`);
  const resolved = providerName ? await (async () => {
    const provider = await prisma.aIProvider.findFirst({ where: { name: providerName } });
    if (!provider) throw new Error(`AI 设置里没有名为“${providerName}”的服务`);
    if (provider.type === 'chatgpt_subscription') throw new Error('不要在复制的数据库里用 ChatGPT 登录做评测：每次刷新登录都会让原数据库的登录失效');
    const result = await resolveAdapterForProvider(provider.id, undefined, { timeoutMs: 240_000 });
    if (!result.ok) throw new Error(result.error);
    if (!result.adapter.complete) throw new Error('这个服务不能生成文字');
    return result;
  })() : undefined;

  const rows = [];
  for (const item of cases) {
    const runs: { checks: Check[]; agree?: string; seconds?: number; error?: string }[] = [];
    for (let index = 0; index < (resolved ? repeat : 1); index += 1) {
      const started = Date.now();
      try {
        const text = resolved ? (await resolved.adapter.complete!(item.prompt.system, item.prompt.user, { json: true })).text : item.expected;
        if (resolved) await resolved.gate.assertAllowed();
        let agree: string | undefined;
        try { agree = item.agree?.(text); } catch { agree = undefined; }
        runs.push({ checks: item.checks(text), agree, seconds: resolved ? Math.round((Date.now() - started) / 1000) : undefined });
      } catch (error) {
        runs.push({ checks: [], error: error instanceof Error ? error.message.slice(0, 300) : String(error) });
      }
    }
    const passed = runs.filter(run => !run.error && run.checks.every(check => check.pass)).length;
    const answers = runs.map(run => run.agree).filter((value): value is string => value !== undefined);
    const agreement = answers.length ? Math.max(...answers.map(answer => answers.filter(other => other === answer).length)) / runs.length : 0;
    const failing = [...new Set(runs.flatMap(run => run.error ? [`error: ${run.error}`] : run.checks.filter(check => !check.pass).map(check => check.name)))];
    rows.push({ id: item.id, spec: item.spec, version: taskSpecs[item.spec].version, runs: runs.length, passed, agreement, failing });
    console.log(`${item.id}（${item.spec} v${taskSpecs[item.spec].version}）：${passed}/${runs.length} 次全部通过，一致 ${Math.round(agreement * 100)}%${failing.length ? `；未通过：${failing.join('；')}` : ''}`);
  }
  await mkdir(root, { recursive: true });
  const file = path.join(root, `${new Date().toISOString().replace(/[:.]/g, '-')}-${providerName ?? 'expected'}.json`);
  await writeFile(file, JSON.stringify({ provider: providerName ?? null, model: resolved?.config.defaultModel ?? null, repeat: resolved ? repeat : 1, at: new Date().toISOString(), cases: rows }, null, 2));
  console.log(`报告：${file}`);
}

main().then(() => prisma.$disconnect(), async error => { console.error(error instanceof Error ? error.message : error); await prisma.$disconnect(); process.exit(1); });
