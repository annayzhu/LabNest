import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { unzipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { buildSamples, SAMPLE_LABEL } from "./test-samples/build";

const root = "src/lib/plasmid/test-samples/files";

function committed(directory = root): string[] {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    return statSync(path).isDirectory() ? committed(path) : [relative(root, path)];
  });
}

// Plain bases and the deliberately broken A03 files cannot hold a label; the folder README covers them.
const unlabelled = new Set(["A01-plain.seq", "A03-mixed/binary.seq", "A03-mixed/words.seq", "A03-mixed/truncated.ab1"]);
const label = Buffer.from(SAMPLE_LABEL);

describe("simulated samples (软件测试用模拟序列)", () => {
  const built = buildSamples();

  it("match a rebuild of the generator", () => {
    expect(committed().sort()).toEqual(built.map((sample) => sample.path).sort());
    for (const sample of built) {
      const bytes = readFileSync(join(root, sample.path));
      // ZIP headers carry local-time stamps, so archives are compared by content.
      if (sample.path.endsWith(".zip")) {
        const entries = (archive: Uint8Array) => Object.entries(unzipSync(archive)).map(([name, data]) => [name, Buffer.from(data).toString("base64")]);
        expect(entries(new Uint8Array(bytes))).toEqual(entries(sample.bytes));
      } else expect(Buffer.from(sample.bytes).equals(bytes), sample.path).toBe(true);
    }
  });

  it("carry the label inside every file that can hold text", () => {
    for (const sample of built.filter((item) => !unlabelled.has(item.path))) {
      const parts = sample.path.endsWith(".zip")
        ? Object.entries(unzipSync(sample.bytes)).filter(([name]) => !name.startsWith("__MACOSX/")).map(([, data]) => data)
        : [sample.bytes];
      for (const part of parts) expect(Buffer.from(part).includes(label), sample.path).toBe(true);
    }
  });
});
