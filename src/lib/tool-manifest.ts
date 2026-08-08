export type LabToolCategory = "Planning" | "Analysis";

export type LabToolManifestItem = {
  id: string;
  name: string;
  version: string;
  category: LabToolCategory;
  description: string;
  accepts: string[];
  produces: string[];
  launchUrl?: string;
};

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
    launchUrl: process.env.QPCR_LAYOUT_TOOL_URL,
  },
  {
    id: "cnv-plate-layout",
    name: "TaqMan CNV Plate Planner",
    version: "1.0",
    category: "Planning",
    description: "Prepare CNV assay layouts with calibrators, controls, and technical replicates.",
    accepts: ["sample list", "assay configuration", "replicate policy"],
    produces: ["plate map", "pipetting plan", "layout export"],
    launchUrl: process.env.CNV_LAYOUT_TOOL_URL,
  },
  {
    id: "qpcr-analysis",
    name: "qPCR Analysis Studio",
    version: "1.0",
    category: "Analysis",
    description: "Review amplification data and calculate QC-aware relative expression results.",
    accepts: ["instrument export", "sample metadata", "layout file"],
    produces: ["QC table", "analysis table", "figures"],
    launchUrl: process.env.QPCR_ANALYSIS_TOOL_URL,
  },
  {
    id: "cnv-analysis",
    name: "CNV Analyzer",
    version: "1.0",
    category: "Analysis",
    description: "Calculate and review copy-number calls from CNV assay output with traceable QC.",
    accepts: ["instrument export", "calibrator", "layout file"],
    produces: ["copy-number calls", "QC report", "analysis export"],
    launchUrl: process.env.CNV_ANALYSIS_TOOL_URL,
  },
];
