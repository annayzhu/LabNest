import { Activity, BarChart3, Calculator, ChartScatter, Dna, Grid3x3, LayoutGrid, type LucideIcon } from "lucide-react";
import type { Editor } from "@tiptap/core";
import { toolEmbeds, type EmbeddedToolId } from "@/lib/tool-embeds";
import type { WritingInsert } from "./WritingCommandMenu";

const toolIcons: Record<EmbeddedToolId, LucideIcon> = { "free-plate-layout": Grid3x3, "qpcr-plate-layout": Grid3x3, "cnv-plate-layout": LayoutGrid, "qpcr-analysis": BarChart3, "cnv-analysis": Activity, calculator: Calculator, "plasmid-workbench": Dna, "visualization-studio": ChartScatter };

/** The Tools group of "/": a tool without a workspace in the record opens on its own page. */
export const toolInserts = (open: (editor: Editor, toolId: EmbeddedToolId) => void): WritingInsert[] => toolEmbeds.map((tool) => ({
  id: tool.id, group: "Tools", label: tool.label, hint: tool.hint, keywords: tool.keywords, icon: toolIcons[tool.id],
  insert: (editor) => {
    if (tool.mode === "tab") { window.open(tool.opens, "_blank", "noopener"); return; }
    open(editor, tool.id);
  },
}));
