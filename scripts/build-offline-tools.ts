/**
 * Offline packages for the two tools that the portable bundle (scripts/build-portable-tools.mjs, maintained separately)
 * does not include: the 实验计算器 and the 可视化工作台. That script empties outputs/tools/portable-tools, so run this after it:
 *
 *   node scripts/build-portable-tools.mjs && npx tsx scripts/build-offline-tools.ts
 *
 * Each tool becomes a folder with index.html (scripts and styles inline) plus the images it loads. Data stays in the
 * browser that opens it. VISUALIZATION_STUDIO_ROOT points at the studio's checkout (default: ../Visualization-studio);
 * nothing is written there.
 */
import { build, type Plugin } from 'esbuild';
import postcss from 'postcss';
import tailwind from '@tailwindcss/postcss';
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { appearanceThemeCssText, systemThemeCssText } from '../src/lib/system-theme';

const root = process.cwd();
const outputRoot = path.join(root, 'outputs', 'tools', 'portable-tools');
const studioRoot = path.resolve(process.env.VISUALIZATION_STUDIO_ROOT ?? path.join(root, '..', 'Visualization-studio'));

const readme = (name: string, extra: string[] = []) => [
  `${name} · 离线使用说明`, '',
  '1. 完整解压文件包，保持 index.html 和同一文件夹里的其他文件在一起。',
  '2. 双击 index.html，用最新版 Chrome、Edge 或 Safari 打开。',
  '3. 数据只在当前浏览器里处理和保存，不会上传；换电脑或换浏览器不会带走。',
  ...extra.map((line, index) => `${index + 4}. ${line}`), '',
].join('\n');

/** The calculator's own calculator links become hash routes; any other Next import means a server feature slipped in. */
const offlineNext: Plugin = { name: 'offline-next', setup(builder) {
  builder.onResolve({ filter: /^next\/link$/ }, () => ({ path: path.join(root, 'src/offline/link.tsx') }));
  builder.onResolve({ filter: /^next(\/|$)/ }, args => ({ errors: [{ text: `离线版不能使用 ${args.path}（${path.relative(root, args.importer)}）` }] }));
  // Task icons load as files next to index.html instead of from the LabNest server.
  builder.onLoad({ filter: /task-presentation\.ts$/ }, async args => ({ contents: (await readFile(args.path, 'utf8')).replaceAll('`/icons/', '`./icons/'), loader: 'ts' }));
  // The 离线使用 panel caches LabNest pages from the server; in the package it says the package already is offline.
  builder.onResolve({ filter: /\/OfflineCalculator$/ }, () => ({ path: path.join(root, 'src/offline/offline-calculator.tsx') }));
} };

async function bundle(options: { entry?: string; stdin?: { contents: string; resolveDir: string }; tsconfig: string; plugins?: Plugin[] }) {
  const result = await build({
    ...(options.entry ? { entryPoints: [options.entry] } : { stdin: { ...options.stdin!, loader: 'tsx' as const, sourcefile: 'offline-entry.tsx' } }),
    bundle: true, write: false, outdir: 'offline-build', format: 'iife', platform: 'browser', target: 'es2020', minify: true, jsx: 'automatic',
    tsconfig: options.tsconfig, plugins: options.plugins ?? [], define: { 'process.env.NODE_ENV': '"production"' }, legalComments: 'none', logLevel: 'warning',
  });
  return {
    js: result.outputFiles.filter(file => file.path.endsWith('.js')).map(file => file.text).join('\n'),
    css: result.outputFiles.filter(file => file.path.endsWith('.css')).map(file => file.text).join('\n'),
  };
}

/** Tailwind v4 over a project's global stylesheet, scanning that project's sources, with that project's own Tailwind. */
async function tailwindCss(projectRoot: string, cssFile: string) {
  const require = createRequire(path.join(projectRoot, 'package.json'));
  const [projectPostcss, projectTailwind] = projectRoot === root ? [postcss, tailwind] : [require('postcss'), require('@tailwindcss/postcss')];
  const result = await projectPostcss([projectTailwind({ base: projectRoot })]).process(await readFile(cssFile, 'utf8'), { from: cssFile });
  return result.css as string;
}

const inline = (text: string, tag: string) => text.replaceAll(`</${tag}`, `<\\/${tag}`);
const page = (input: { title: string; css: string; js: string; lang: string; htmlAttributes?: string }) =>
  `<!doctype html><html lang="${input.lang}"${input.htmlAttributes ?? ''}><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${input.title}</title><style>${inline(input.css, 'style')}</style></head><body><div id="root"></div><script>${inline(input.js, 'script')}</script></body></html>`;

async function writePackage(folder: string, files: Record<string, string>, copies: Array<[string, string]> = []) {
  const destination = path.join(outputRoot, folder);
  await rm(destination, { recursive: true, force: true });
  await mkdir(destination, { recursive: true });
  for (const [name, contents] of Object.entries(files)) await writeFile(path.join(destination, name), contents);
  for (const [from, to] of copies) await cp(from, path.join(destination, to), { recursive: true });
  return destination;
}

async function calculator() {
  const [{ js, css }, base] = await Promise.all([
    bundle({ entry: path.join(root, 'src/offline/calculator.tsx'), tsconfig: path.join(root, 'tsconfig.json'), plugins: [offlineNext] }),
    tailwindCss(root, path.join(root, 'src/app/globals.css')),
  ]);
  return writePackage('06_Experimental_Calculator', {
    'index.html': page({ title: 'LabNest 实验计算器（离线版）', lang: 'zh-CN', css: systemThemeCssText() + appearanceThemeCssText() + base + css, js, htmlAttributes: ' data-labnest-theme="moon-dai" data-labnest-mode="light"' }),
    'README_使用说明.txt': readme('LabNest 实验计算器', ['离线版包含全部计算、方法说明、复制和导出；“存入实验”等需要 LabNest 服务器的功能不在离线版里。']),
  }, [[path.join(root, 'public/icons/lab-soft-v1'), 'icons/lab-soft-v1']]);
}

async function studio() {
  const entry = `import { createRoot } from "react-dom/client"; import { StudioApp } from ${JSON.stringify(path.join(studioRoot, 'src/components/studio/StudioApp'))};
createRoot(document.getElementById("root")).render(<main className="mx-auto min-h-screen w-full max-w-[1600px] px-3 py-3 sm:px-5 lg:px-6"><StudioApp /></main>);`;
  const [{ js, css }, base] = await Promise.all([
    bundle({ stdin: { contents: entry, resolveDir: studioRoot }, tsconfig: path.join(studioRoot, 'tsconfig.json'), plugins: [{ name: 'offline-next', setup(builder) {
      builder.onResolve({ filter: /^next(\/|$)/ }, args => ({ errors: [{ text: `离线版不能使用 ${args.path}（${path.relative(studioRoot, args.importer)}）` }] }));
    } }] }),
    tailwindCss(studioRoot, path.join(studioRoot, 'src/app/globals.css')),
  ]);
  return writePackage('07_Visualization_Studio', {
    'index.html': page({ title: 'Visualization Studio（离线版）', lang: 'en', css: base + css, js }),
    'README_使用说明.txt': readme('可视化工作台 Visualization Studio', ['导出的图片和工程文件保存在你选择的位置。']),
  });
}

Promise.all([calculator(), studio()])
  .then(folders => { for (const folder of folders) console.log(path.relative(root, folder)); })
  .catch(error => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
