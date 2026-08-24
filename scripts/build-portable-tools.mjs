import { build } from "esbuild";
import { cp, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const workspace = process.cwd();
const outputRoot = path.join(workspace, "outputs", "portable-tools");
const materialRoot = process.env.LABNEST_TOOL_SOURCE_ROOT;
if (!materialRoot) {
  throw new Error("Set LABNEST_TOOL_SOURCE_ROOT to the directory containing the portable tool source projects.");
}
const projects = {
  qpcrPlate: path.join(materialRoot, "qpcr-plate-planner"),
  cnvPlate: path.join(materialRoot, "C_Taqman_CNV", "CNV_Plate_Planner"),
  freePlate: path.join(materialRoot, "plate-layout-studio"),
  qpcrAnalysis: path.join(materialRoot, "qpcr-analysis-studio"),
  cnvAnalysis: path.join(materialRoot, "C_Taqman_CNV", "CopyNumber_Analyzer"),
  visualization: path.join(workspace, "standalone", "visualization-studio"),
};

const temporaryRoot = await mkdtemp(path.join(tmpdir(), "labnest-portable-tools-"));

async function findStylesheets(root) {
  const paths = [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const entryPath = path.join(root, entry.name);
    if (entry.isDirectory()) paths.push(...await findStylesheets(entryPath));
    else if (entry.isFile() && entry.name.endsWith(".css")) paths.push(entryPath);
  }
  return paths.sort();
}

function escapeInline(source, tag) {
  return source.replaceAll(new RegExp(`</${tag}`, "gi"), `<\\/${tag}`);
}

function aliasPlugin(projectRoot) {
  return {
    name: "project-alias",
    setup(context) {
      context.onResolve({ filter: /^@\// }, (args) =>
        context.resolve(`./${args.path.slice(2)}`, {
          resolveDir: projectRoot,
          kind: args.kind,
        }),
      );
    },
  };
}

async function writePortableHtml({ folder, filename, title, rootId, entrySource, projectRoot, dependencyRoot = projectRoot, cssPaths }) {
  const entryPath = path.join(temporaryRoot, `${folder}.tsx`);
  const bundlePath = path.join(temporaryRoot, `${folder}.js`);
  await writeFile(entryPath, entrySource);
  await build({
    entryPoints: [entryPath],
    outfile: bundlePath,
    bundle: true,
    splitting: false,
    format: "iife",
    platform: "browser",
    target: ["chrome100", "edge100", "firefox100", "safari15.4"],
    jsx: "automatic",
    minify: true,
    sourcemap: false,
    legalComments: "none",
    define: { "process.env.NODE_ENV": '"production"' },
    plugins: [aliasPlugin(projectRoot)],
    absWorkingDir: projectRoot,
    nodePaths: [path.join(dependencyRoot, "node_modules")],
  });
  const [javascript, ...styles] = await Promise.all([
    readFile(bundlePath, "utf8"),
    ...cssPaths.map((cssPath) => readFile(cssPath, "utf8")),
  ]);
  const css = styles.join("\n").replace(/^@import\s+["']tailwindcss["'];\s*/gmu, "");
  const html = `<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${title}</title><style>${escapeInline(css, "style")}</style></head><body><noscript>请启用浏览器 JavaScript 后使用本工具。</noscript><div id="${rootId}"></div><script>${escapeInline(javascript, "script")}</script></body></html>`;
  const destination = path.join(outputRoot, folder);
  await mkdir(destination, { recursive: true });
  await writeFile(path.join(destination, filename), html);
  await writeFile(path.join(destination, "README_使用说明.txt"), `离线使用说明\n\n1. 完整解压文件包。\n2. 双击 ${filename}。\n3. 推荐使用最新版 Chrome、Edge 或 Safari。\n4. 数据仅在当前浏览器本地处理；更换电脑不会自动迁移浏览器本地草稿。\n5. 仅供科研使用，输出结果请结合实验设计与原始数据复核。\n`);
}

try {
  await rm(outputRoot, { recursive: true, force: true });
  await mkdir(outputRoot, { recursive: true });

  await cp(path.join(projects.qpcrPlate, "outputs", "portable", "qPCR_Plate_Layout_Planner_Portable"), path.join(outputRoot, "01_qPCR_Plate_Layout_Planner"), { recursive: true });
  await cp(path.join(projects.cnvAnalysis, "offline-release", "CNVtool_v1.3_offline_20260803"), path.join(outputRoot, "05_CNV_Analysis_Studio"), { recursive: true });
  await mkdir(path.join(outputRoot, "03_Free_Plate_Layout_Planner"), { recursive: true });
  for (const filename of ["index.html", "styles.css", "core.js", "color-core.js", "liquid-core.js", "liquid-plan-core.js", "workspace-core.js", "xlsx-core.js", "app.js", "README.md"]) {
    await cp(path.join(projects.freePlate, filename), path.join(outputRoot, "03_Free_Plate_Layout_Planner", filename));
  }

  await writePortableHtml({
    folder: "02_CNV_Plate_Layout_Planner",
    filename: "index.html",
    title: "CNV Plate Layout Planner",
    rootId: "cnv-planner-root",
    projectRoot: projects.cnvPlate,
    cssPaths: [path.join(projects.cnvPlate, "app", "globals.css")],
    entrySource: `import { createRoot } from "react-dom/client"; import { CnvPlanner } from ${JSON.stringify(path.join(projects.cnvPlate, "app", "CnvPlanner.tsx"))}; createRoot(document.getElementById("cnv-planner-root")).render(<CnvPlanner />);`,
  });

  await writePortableHtml({
    folder: "04_qPCR_Analysis_Studio",
    filename: "index.html",
    title: "qPCR Analysis Studio",
    rootId: "qpcr-analysis-root",
    projectRoot: projects.qpcrAnalysis,
    cssPaths: [path.join(projects.qpcrAnalysis, "app", "globals.css")],
    entrySource: `import { createRoot } from "react-dom/client"; import QpcrAnalysisStudio from ${JSON.stringify(path.join(projects.qpcrAnalysis, "app", "QpcrAnalysisStudio.tsx"))}; import { LanguageProvider } from ${JSON.stringify(path.join(projects.qpcrAnalysis, "app", "i18n.tsx"))}; createRoot(document.getElementById("qpcr-analysis-root")).render(<LanguageProvider><QpcrAnalysisStudio /></LanguageProvider>);`,
  });

  await writePortableHtml({
    folder: "06_Visualization_Studio",
    filename: "index.html",
    title: "Visualization Studio",
    rootId: "visualization-root",
    projectRoot: path.join(projects.visualization, "src"),
    dependencyRoot: projects.visualization,
    cssPaths: await findStylesheets(path.join(projects.visualization, ".next", "static", "chunks")),
    entrySource: `import { createRoot } from "react-dom/client"; import { VisualizationStudio } from ${JSON.stringify(path.join(projects.visualization, "src", "components", "VisualizationStudio.tsx"))}; createRoot(document.getElementById("visualization-root")).render(<VisualizationStudio />);`,
  });
} finally {
  await rm(temporaryRoot, { recursive: true, force: true });
}

console.log(outputRoot);
