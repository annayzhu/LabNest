import { spawnSync } from 'node:child_process';
const commands = [
  ['npx', ['tsx', 'scripts/seed-inventory-run.ts']],
  ...['verify-inventory-containers', 'verify-purchase-receipts', 'verify-run-materials', 'verify-independent-import', 'verify-inventory-import-modes', 'verify-quote-import', 'verify-inventory-xlsx', 'verify-inventory-concurrency', 'verify-inventory-followup', 'verify-inventory-pages'].map(name => [process.execPath, [`scripts/${name}.mjs`]]),
  ['npx', ['tsx', 'scripts/verify-inventory-run-completion.ts']],
  ...['verify-inventory-completion', 'verify-school-export', 'verify-inventory-export-formats'].map(name => ['npx', ['tsx', `scripts/${name}.ts`]]),
];
for (const [command, args] of commands) {
  console.log(`Running ${args.join(' ')}`);
  const result = spawnSync(command, args, { stdio: 'inherit', env: process.env });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
