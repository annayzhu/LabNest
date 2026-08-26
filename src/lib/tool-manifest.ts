export type LabToolCategory = "Planning" | "Calculators" | "Analysis";

export type LabToolManifestItem = {
  id: string;
  name: string;
  version: string;
  category: LabToolCategory;
  description: string;
  accepts: string[];
  produces: string[];
  launchUrl?: string;
  external?: boolean;
};

export const standaloneToolDefaultUrls = {
  qpcrLayout: "https://rt-qpcr-plate-planner.pountneycitlali784.chatgpt.site",
  cnvLayout: "https://taqman-cnv-plate-planner-anna.pountneycitlali784.chatgpt.site",
  qpcrAnalysis: "https://qpcr-analysis-studio.pountneycitlali784.chatgpt.site",
  cnvAnalysis: "https://cnv-analysis-tool.pountneycitlali784.chatgpt.site",
} as const;

function configuredToolUrl(value: string | undefined, fallback: string) {
  return value?.trim() || fallback;
}

/**
 * External tools remain independently deployable applications. LabNest is the
 * directory and future provenance hub; the tool itself owns its calculations.
 */
export const labToolManifest: LabToolManifestItem[] = [
  {
    id: "qpcr-plate-layout",
    name: "qPCR Plate Layout Planner",
    version: "1.0",
    category: "Planning",
    description: "Design sample, target, control, and replicate placement before a qPCR run.",
    accepts: ["sample list", "assay list", "plate format"],
    produces: ["plate map", "run sheet", "layout export"],
    launchUrl: configuredToolUrl(process.env.QPCR_LAYOUT_TOOL_URL, standaloneToolDefaultUrls.qpcrLayout),
    external: true,
  },
  {
    id: "cnv-plate-layout",
    name: "TaqMan CNV Plate Planner",
    version: "1.0",
    category: "Planning",
    description: "Prepare CNV assay layouts with calibrators, controls, and technical replicates.",
    accepts: ["sample list", "assay configuration", "replicate policy"],
    produces: ["plate map", "pipetting plan", "layout export"],
    launchUrl: configuredToolUrl(process.env.CNV_LAYOUT_TOOL_URL, standaloneToolDefaultUrls.cnvLayout),
    external: true,
  },
  {
    id: "free-plate-layout",
    name: "Free Plate Layout Planner",
    version: "0.2",
    category: "Planning",
    description: "Plan independent multi-plate experiments, shared liquid preparation, and execution-ready Excel workbooks.",
    accepts: ["sample list", "one or more plate formats", "custom labels", "saved liquid recipes"],
    produces: ["multi-plate map", "shared liquid summary", "pipetting checklist", "XLSX workbook"],
    launchUrl: "/tools/free-plate-layout/index.html",
    external: false,
  },
  {
    id: "calculator",
    name: "Experimental Calculator",
    version: "1.0",
    category: "Calculators",
    description: "Run 31 browser-local wet-lab calculations with bilingual methods, presets, and reviewable results.",
    accepts: ["experimental parameters", "units", "optional plate context"],
    produces: ["calculated values", "warnings", "local history"],
    launchUrl: "/tools/calculator",
    external: false,
  },
  {
    id: "qpcr-analysis",
    name: "qPCR Analysis Studio",
    version: "1.0",
    category: "Analysis",
    description: "Review amplification data and calculate QC-aware relative expression results.",
    accepts: ["instrument export", "sample metadata", "layout file"],
    produces: ["QC table", "analysis table", "figures"],
    launchUrl: configuredToolUrl(process.env.QPCR_ANALYSIS_TOOL_URL, standaloneToolDefaultUrls.qpcrAnalysis),
    external: true,
  },
  {
    id: "cnv-analysis",
    name: "CNV Analysis Studio",
    version: "1.0",
    category: "Analysis",
    description: "Calculate and review copy-number calls from CNV assay output with traceable QC.",
    accepts: ["instrument export", "calibrator", "layout file"],
    produces: ["copy-number calls", "QC report", "analysis export"],
    launchUrl: configuredToolUrl(process.env.CNV_ANALYSIS_TOOL_URL, standaloneToolDefaultUrls.cnvAnalysis),
    external: true,
  },
  {
    id: "visualization-studio",
    name: "Visualization Studio",
    version: "0.1",
    category: "Analysis",
    description: "Create compact, publication-ready figures with editable journal palettes, mappings, and export settings.",
    accepts: ["CSV or TSV data", "column mapping", "figure parameters"],
    produces: ["SVG", "600 dpi PNG", "reproducible config"],
    launchUrl: "/tools/visualization",
    external: false,
  },
];
