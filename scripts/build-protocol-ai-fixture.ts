/**
 * Writes a synthetic transfection Protocol DOCX for AI-extraction acceptance and demos.
 * The numbers illustrate structure only; this is not a validated laboratory method.
 *
 *   npx tsx scripts/build-protocol-ai-fixture.ts [output-directory]
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { exportProtocolDocx, protocolDocxFilename } from "../src/lib/protocol-docx-export";
import { createProtocolTemplateDocument } from "../src/lib/protocol-document";

const outputDirectory = process.argv[2] ?? "docs/ai/20261009/fixtures";
const document = createProtocolTemplateDocument();
const section = (key: string) => document.sections.find((item) => item.key === key)!;
const paragraph = (id: string, text: string) => ({ id, type: "rich_text" as const, nodes: [{ type: "paragraph" as const, content: [{ text }] }] });

section("description").blocks = [paragraph("description", "Synthetic demonstration fixture for AI-assisted import. Not a validated laboratory method.")];
section("purpose").blocks = [paragraph("purpose", "Transiently express a GFP reporter plasmid in adherent cells cultured in a 24-well plate.")];
section("material").blocks = [{
  id: "materials",
  type: "table",
  caption: "Materials",
  rows: [
    ["Name", "Unit", "Role", "Notes"],
    ["Opti-MEM", "µL", "Diluent", "Reduced-serum medium"],
    ["Lipofectamine 3000", "µL", "Transfection reagent", "Keep at 4 °C"],
    ["P3000 reagent", "µL", "Enhancer", ""],
    ["GFP reporter plasmid", "ng", "DNA", "Endotoxin-free preparation"],
  ],
}];
section("steps").blocks = [
  { id: "step-1", type: "heading", text: "1. Seed cells" },
  paragraph("step-1-text", "Seed 1.0 × 10^5 cells per well in 500 µL complete medium one day before transfection, aiming for 70–90% confluence."),
  { id: "step-2", type: "heading", text: "2. Prepare DNA mix" },
  paragraph("step-2-text", "For each well, dilute 500 ng GFP reporter plasmid and 1 µL P3000 reagent in 25 µL Opti-MEM."),
  { id: "step-3", type: "heading", text: "3. Prepare lipid mix" },
  paragraph("step-3-text", "For each well, dilute 1.5 µL Lipofectamine 3000 in 25 µL Opti-MEM. Prepare 10% extra volume to cover pipetting loss."),
  { id: "step-4", type: "heading", text: "4. Combine and add to cells" },
  paragraph("step-4-text", "Combine the DNA mix and lipid mix, incubate 15 min at room temperature, then add 50 µL dropwise to each well. Do not vortex the complex."),
  { id: "step-5", type: "heading", text: "5. Read out expression" },
  paragraph("step-5-text", "Image GFP 48 h after transfection and record the percentage of GFP-positive cells and the mean fluorescence intensity. The imaging time may be adjusted between 24 h and 72 h."),
];

const identity = {
  humanCode: "PRT-900901",
  canonicalTitle: "GFP 质粒瞬时转染（合成示例）",
  englishTitle: "GFP plasmid transient transfection (synthetic fixture)",
  availability: "draft",
  reviewStage: "draft",
  displayVersion: "0.1",
  scope: "general",
  tags: ["AI fixture"],
};

const bytes = exportProtocolDocx(identity, document);
mkdirSync(outputDirectory, { recursive: true });
const target = path.join(outputDirectory, protocolDocxFilename(identity));
writeFileSync(target, bytes);
console.log(target);
