import { readdirSync } from "node:fs";
import path from "node:path";

const plannerSource = process.env.CNV_PLANNER_SOURCE;
const labNestRoot = process.env.LABNEST_ROOT;

if (!plannerSource || !labNestRoot) {
  throw new Error("CNV_PLANNER_SOURCE and LABNEST_ROOT are required.");
}

const builtCssDirectory = path.join(plannerSource, "dist", "server", "assets");
const builtCssFile = readdirSync(builtCssDirectory).find((file) => file.endsWith(".css"));

if (!builtCssFile) {
  throw new Error(`No built planner CSS was found in ${builtCssDirectory}.`);
}

const plannerReact = path.join(plannerSource, "node_modules", "react");
const plannerReactDom = path.join(plannerSource, "node_modules", "react-dom");

const viteConfig = {
  base: "./",
  resolve: {
    alias: [
      {
        find: "@cnv-planner-entry",
        replacement: path.join(plannerSource, "app", "CnvPlanner.tsx"),
      },
      {
        find: "@cnv-planner-style",
        replacement: path.join(builtCssDirectory, builtCssFile),
      },
      { find: /^react$/, replacement: path.join(plannerReact, "index.js") },
      { find: /^react\/jsx-runtime$/, replacement: path.join(plannerReact, "jsx-runtime.js") },
      { find: /^react-dom$/, replacement: path.join(plannerReactDom, "index.js") },
      { find: /^react-dom\/client$/, replacement: path.join(plannerReactDom, "client.js") },
      { find: "@", replacement: plannerSource },
    ],
  },
  build: {
    emptyOutDir: true,
    outDir: path.join(labNestRoot, "public", "tools", "cnv-plate-layout"),
    sourcemap: false,
  },
};

export default viteConfig;
