import { createHash } from "node:crypto";
import { readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = path.join(process.cwd(), "outputs", "portable-tools");
const entries = (await readdir(root, { withFileTypes: true }))
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

if (entries.length !== 6) throw new Error(`Expected 6 portable tool folders, found ${entries.length}.`);

const checksums = [];
for (const folder of entries) {
  const zipName = `${folder}.zip`;
  const zipPath = path.join(root, zipName);
  await rm(zipPath, { force: true });
  const result = spawnSync("zip", ["-q", "-r", zipName, folder], { cwd: root, encoding: "utf8" });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`zip failed for ${folder}: ${result.stderr}`);
  const bytes = await readFile(zipPath);
  checksums.push({
    filename: zipName,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    size: (await stat(zipPath)).size,
  });
}

await writeFile(path.join(root, "SHA256SUMS.txt"), `${checksums.map((item) => `${item.sha256}  ${item.filename}`).join("\n")}\n`);
await writeFile(path.join(root, "README_六个离线工具包.txt"), `LabNest 六个离线科研工具包\n\n使用方法\n1. 选择对应 ZIP 并完整解压。\n2. 在解压目录中双击 HTML 文件。\n3. 推荐最新版 Chrome、Edge 或 Safari。\n4. 无需安装 Node.js、Python 或 LabNest，也不需要联网。\n\n验证摘要\n- 6/6 工具已通过 Chromium file:// 直接打开验证。\n- 浏览器验证未发现 JavaScript 或控制台错误。\n- 各工具的单元测试、构建结果和版本应以对应源码仓库的发布记录为准；本文件不写入可能过期的固定测试数量。\n\n注意\n- 浏览器 localStorage 草稿不会自动跨电脑迁移，请使用工具自身的 JSON/Excel/CSV 导出功能转移记录。\n- 仅供科研使用，正式实验或结论输出前须复核原始数据、板位、参数和质控。\n`);

console.log(JSON.stringify(checksums, null, 2));
