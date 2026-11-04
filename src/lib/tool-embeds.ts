import type { LabToolManifestItem } from "./tool-manifest";

export type EmbeddedToolId = "free-plate-layout" | "qpcr-plate-layout" | "cnv-plate-layout" | "qpcr-analysis" | "cnv-analysis" | "calculator" | "plasmid-workbench" | "visualization-studio";

/** How a tool runs from a record: `bridged` saves back; `framed` runs beside the record without saving; `tab` opens on its own page. */
export type ToolEmbedMode = "bridged" | "framed" | "tab";

export type ToolEmbed = { id: EmbeddedToolId; label: string; hint: string; keywords: string; mode: ToolEmbedMode; opens: string };

/**
 * The Tools group of the "/" menu, one item per tool in the catalog. The free plate planner is reached through
 * "Plate layout", which edits the same plate (Q387).
 */
export const toolEmbeds: ToolEmbed[] = [
  { id: "qpcr-plate-layout", label: "qPCR plate planning", hint: "Plate, reference wells and reaction mix", keywords: "paiban pb banbuju qpcr plate planner layout mix peiye", mode: "bridged", opens: "/tools/qpcr-plate-layout/index.html" },
  { id: "cnv-plate-layout", label: "CNV plate planning", hint: "Not saved to this record yet", keywords: "paiban pb banbuju cnv taqman plate planner layout", mode: "framed", opens: "/tools/cnv-plate-layout/index.html" },
  { id: "qpcr-analysis", label: "qPCR analysis", hint: "Instrument results, QC and figures", keywords: "fenxi fx qpcr analysis cq ddct", mode: "bridged", opens: "/tools/qpcr-analysis/index.html" },
  { id: "cnv-analysis", label: "CNV analysis", hint: "Instrument results, QC and copy number", keywords: "fenxi fx cnv analysis copy number kaobeishu", mode: "bridged", opens: "/tools/cnv-analysis/index.html" },
  { id: "calculator", label: "Calculator", hint: "Inputs and results, checked by the server", keywords: "jisuanqi jsq calculator dilution peiye", mode: "bridged", opens: "/tools/calculator?embed=record" },
  { id: "plasmid-workbench", label: "Plasmid workbench", hint: "Map snapshot and version reference", keywords: "zhili zl tupu plasmid map sequence", mode: "bridged", opens: "/tools/plasmid?embed=record" },
  { id: "visualization-studio", label: "Visualization", hint: "Opens on its own page · not saved yet", keywords: "keshihua ksh visualization figure plot", mode: "tab", opens: "/tools/visualization" },
];

/** Opened from a plate ("Open the planner") and from what it saves; "Plate layout" is its place in the menu. */
const planner: ToolEmbed = { id: "free-plate-layout", label: "Plate planner", hint: "", keywords: "", mode: "bridged", opens: "/tools/free-plate-layout/index.html" };

export const toolEmbed = (id: string) => id === planner.id ? planner : toolEmbeds.find((tool) => tool.id === id);

/** Where a tool's page lives inside the record workspace. */
export const toolFrameSource = (tool: ToolEmbed, session: string, locale: string) => `${tool.opens}${tool.opens.includes("?") ? "&" : "?"}embedded=1&session=${session}&locale=${locale}`;

/** Catalog tools without a "/" item of their own; used by the test that keeps the two lists together. */
export const mergedCatalogTools: LabToolManifestItem["id"][] = ["free-plate-layout"];
