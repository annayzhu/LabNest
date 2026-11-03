import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { buildSamples } from "./build";

// Regenerates the committed simulated samples: npx tsx src/lib/plasmid/test-samples/write-samples.ts
const root = join(process.cwd(), "src/lib/plasmid/test-samples/files");
for (const sample of buildSamples()) {
  const target = join(root, sample.path);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, sample.bytes);
}
console.log(`Wrote ${buildSamples().length} files to ${root}`);
