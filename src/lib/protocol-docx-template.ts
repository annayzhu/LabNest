import { exportProtocolDocx } from "./protocol-docx-export";
import { createProtocolTemplateDocument } from "./protocol-document";

export const protocolDocxTemplateTitle = "请填写实验规程标题 / Replace with Protocol title";
export const protocolDocxTemplateEnglishTitle = "Replace with English title (optional)";
export const protocolDocxTemplateFilename = "LabNest_Protocol_Import_Template_v0.2_Draft.docx";

export function isUnfilledProtocolDocxTemplateTitle(title: string) {
  return title === protocolDocxTemplateTitle
    || /replace with protocol title|请填写实验规程标题/i.test(title);
}

export function exportProtocolDocxTemplate() {
  const document = createProtocolTemplateDocument();
  const steps = document.sections.find((section) => section.key === "steps");

  // A blank rich-text paragraph keeps the section editable without creating a
  // synthetic numbered step when the DOCX is imported again.
  if (steps) {
    steps.blocks = [{
      id: "steps-rich-1",
      type: "rich_text",
      nodes: [{ type: "paragraph", content: [{ text: "" }] }],
    }];
  }

  return exportProtocolDocx({
    canonicalTitle: protocolDocxTemplateTitle,
    englishTitle: protocolDocxTemplateEnglishTitle,
    availability: "draft",
    reviewStage: "draft",
    displayVersion: "0.2",
    scope: "general",
    tags: [],
    templateMode: true,
  }, document);
}
