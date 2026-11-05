import type { LabToolManifestItem } from "./tool-manifest";

export type EmbeddedToolId = "free-plate-layout" | "qpcr-plate-layout" | "cnv-plate-layout" | "qpcr-analysis" | "cnv-analysis" | "calculator" | "plasmid-workbench" | "visualization-studio";

export type ToolEmbed = { id: EmbeddedToolId; label: string; hint: string; keywords: string; opens: string };

/**
 * The Tools group of the "/" menu, one item per tool in the catalog. The free plate planner is reached through
 * "Plate layout", which edits the same plate (Q387).
 */
export const toolEmbeds: ToolEmbed[] = [
  { id: "qpcr-plate-layout", label: "qPCR plate planning", hint: "Plate, reference wells and reaction mix", keywords: "paiban pb banbuju qpcr plate planner layout mix peiye", opens: "/tools/qpcr-plate-layout/index.html" },
  { id: "cnv-plate-layout", label: "CNV plate planning", hint: "Plate, controls and reaction mix", keywords: "paiban pb banbuju cnv taqman plate planner layout mix peiye", opens: "/tools/cnv-plate-layout/index.html" },
  { id: "qpcr-analysis", label: "qPCR analysis", hint: "Instrument results, QC and figures", keywords: "fenxi fx qpcr analysis cq ddct", opens: "/tools/qpcr-analysis/index.html" },
  { id: "cnv-analysis", label: "CNV analysis", hint: "Instrument results, QC and copy number", keywords: "fenxi fx cnv analysis copy number kaobeishu", opens: "/tools/cnv-analysis/index.html" },
  { id: "calculator", label: "Calculator", hint: "Inputs and results, checked by the server", keywords: "jisuanqi jsq calculator dilution peiye", opens: "/tools/calculator?embed=record" },
  { id: "plasmid-workbench", label: "Plasmid workbench", hint: "Map snapshot and version reference", keywords: "zhili zl tupu plasmid map sequence", opens: "/tools/plasmid?embed=record" },
  { id: "visualization-studio", label: "Visualization", hint: "Figures from this record's tables", keywords: "keshihua ksh visualization figure plot tubiao", opens: "" },
];

/** Opened from a plate ("Open the planner") and from what it saves; "Plate layout" is its place in the menu. */
const planner: ToolEmbed = { id: "free-plate-layout", label: "Plate planner", hint: "", keywords: "", opens: "/tools/free-plate-layout/index.html" };

export const toolEmbed = (id: string) => id === planner.id ? planner : toolEmbeds.find((tool) => tool.id === id);

/** Where a tool's page lives inside the record workspace. */
export const toolFrameSource = (tool: ToolEmbed, session: string, locale: string, externalUrl?: string) => {
  const opens = externalUrl ?? tool.opens;
  // A tool on another address cannot see who opened it, so it is told; it decides whether to answer.
  return `${opens}${opens.includes("?") ? "&" : "?"}embedded=1&session=${session}&locale=${locale}${externalUrl ? `&host=${encodeURIComponent(window.location.origin)}` : ""}`;
};

/** Catalog tools without a "/" item of their own; used by the test that keeps the two lists together. */
export const mergedCatalogTools: LabToolManifestItem["id"][] = ["free-plate-layout"];
