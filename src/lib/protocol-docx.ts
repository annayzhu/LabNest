import { createHash } from "node:crypto";
import { DOMParser } from "@xmldom/xmldom";
import { strFromU8, unzipSync } from "fflate";
import {
  createEmptyProtocolDocument,
  projectProtocolDocument,
  protocolSectionKeys,
  protocolSectionLabels,
  type ProtocolContentBlock,
  type ProtocolDocument,
  type ProtocolSectionKey,
} from "./protocol-document";

const headingToKey = new Map(
  protocolSectionKeys.map((key) => [protocolSectionLabels[key], key] as const),
);

export type ParsedProtocolDocx = {
  humanCode?: string;
  canonicalTitle: string;
  englishTitle?: string;
  availability: "draft" | "active" | "retired" | "archived";
  reviewStage: "draft" | "ready_for_review" | "reviewed";
  displayVersion: string;
  tags: string[];
  document: ProtocolDocument;
  description: string;
  purpose: string;
  background: string;
  materials: ReturnType<typeof projectProtocolDocument>["materials"];
  equipment: ReturnType<typeof projectProtocolDocument>["equipment"];
  steps: ReturnType<typeof projectProtocolDocument>["steps"];
  resultTemplates: ReturnType<typeof projectProtocolDocument>["resultTemplates"];
  consumptionRules: ReturnType<typeof projectProtocolDocument>["consumptionRules"];
  sourceFileName: string;
  sourceFileChecksum: string;
};

function elementText(element: Element) {
  return Array.from(element.getElementsByTagName("w:t"))
    .map((node) => node.textContent ?? "")
    .join("")
    .replace(/\s+/g, " ")
    .trim();
}

function tableRows(element: Element) {
  return Array.from(element.getElementsByTagName("w:tr")).map((row) =>
    Array.from(row.getElementsByTagName("w:tc")).map((cell) => {
      const paragraphs = Array.from(cell.getElementsByTagName("w:p"))
        .map(elementText)
        .filter(Boolean);
      return paragraphs.join("\n");
    }),
  );
}

function tableCaption(element: Element) {
  const caption = element.getElementsByTagName("w:tblCaption")[0];
  return caption?.getAttribute("w:val") ?? caption?.getAttribute("val") ?? undefined;
}

function tableDescription(element: Element) {
  const description = element.getElementsByTagName("w:tblDescription")[0];
  return description?.getAttribute("w:val") ?? description?.getAttribute("val") ?? undefined;
}

function simpleValue(value: string | undefined) {
  return value?.split(/[（(]/)[0].trim();
}

function parseAvailability(value?: string): ParsedProtocolDocx["availability"] {
  const normalized = simpleValue(value)?.toLowerCase();
  if (normalized === "active" || normalized === "retired" || normalized === "archived") return normalized;
  return "draft";
}

function parseReviewStage(value?: string): ParsedProtocolDocx["reviewStage"] {
  const normalized = simpleValue(value)?.toLowerCase().replaceAll(" ", "_");
  if (normalized === "reviewed" || normalized === "ready_for_review") return normalized;
  return "draft";
}

function parseFilename(fileName: string) {
  const match = fileName.match(/^(PRT-\d{6})_(.+)_v(\d+(?:\.\d+)+)_(Draft|Active|Retired|Archived)\.docx$/i);
  if (!match) return {};
  return {
    code: match[1],
    title: match[2],
    displayVersion: match[3],
    availability: match[4].toLowerCase(),
  };
}

function newBlockId(sectionKey: ProtocolSectionKey, index: number) {
  return `${sectionKey}-${index + 1}`;
}

type ProtocolContentBlockInput = ProtocolContentBlock extends infer Block
  ? Block extends { id: string }
    ? Omit<Block, "id">
    : never
  : never;

export function parseProtocolDocumentXml(
  xml: string,
  sourceFileName: string,
  sourceFileChecksum = "test-checksum",
): ParsedProtocolDocx {
  const dom = new DOMParser().parseFromString(xml, "application/xml");
  const body = dom.getElementsByTagName("w:body")[0];
  if (!body) throw new Error("The DOCX document body is missing.");

  const document = createEmptyProtocolDocument();
  const warnings: string[] = [];
  const identityParagraphs: string[] = [];
  let identityTable: string[][] | undefined;
  let currentSection: ProtocolSectionKey | undefined;
  let checklistBuffer: string[] = [];

  const getSection = (key: ProtocolSectionKey) =>
    document.sections.find((section) => section.key === key) as ProtocolDocument["sections"][number];
  const flushChecklist = () => {
    if (!currentSection || !checklistBuffer.length) return;
    const section = getSection(currentSection);
    section.blocks.push({
      id: newBlockId(currentSection, section.blocks.length),
      type: "checklist",
      items: checklistBuffer,
    });
    checklistBuffer = [];
  };
  const pushBlock = (block: ProtocolContentBlockInput) => {
    if (!currentSection) return;
    flushChecklist();
    const section = getSection(currentSection);
    section.blocks.push({ ...block, id: newBlockId(currentSection, section.blocks.length) } as ProtocolContentBlock);
  };

  for (const node of Array.from(body.childNodes)) {
    if (node.nodeType !== 1) continue;
    const element = node as unknown as Element;
    const name = element.tagName;

    if (name === "w:p") {
      const text = elementText(element);
      if (!text) continue;
      const sectionKey = headingToKey.get(text);
      if (sectionKey) {
        flushChecklist();
        currentSection = sectionKey;
        continue;
      }
      if (!currentSection) {
        identityParagraphs.push(text);
        continue;
      }
      if (text.startsWith("☐")) {
        checklistBuffer.push(text.replace(/^☐\s*/, ""));
      } else if (/^\d+[.、]\s*/.test(text)) {
        pushBlock({ type: "heading", text });
      } else {
        pushBlock({ type: "text", text });
      }
    }

    if (name === "w:tbl") {
      const rows = tableRows(element);
      if (!currentSection && !identityTable) {
        identityTable = rows;
        continue;
      }
      if (!currentSection || !rows.length) continue;
      const flatText = rows.flat().join(" ");
      if (rows.length === 1 && rows[0]?.length === 1 && /(关键|边界|完成判定|警告|风险提示|说明|CRITICAL|WARNING|NOTE)/i.test(flatText)) {
        const tone = /(不得|Invalid|无效|关键警告|CRITICAL)/i.test(flatText)
          ? "critical"
          : /(警告|风险提示|WARNING)/i.test(flatText)
            ? "warning"
            : "note";
        pushBlock({
          type: "callout",
          tone,
          text: flatText,
        });
      } else {
        const caption = tableCaption(element);
        if (caption && currentSection) {
          const blocks = getSection(currentSection).blocks;
          const previous = blocks.at(-1);
          if (previous?.type === "text" && previous.text === caption) blocks.pop();
        }
        const rawDescription = tableDescription(element);
        let resultTemplate: Extract<ProtocolContentBlockInput, { type: "table" }>["resultTemplate"];
        if (currentSection === "result_templates" && rawDescription?.startsWith("labnest-result-template:")) {
          try { resultTemplate = JSON.parse(rawDescription.slice("labnest-result-template:".length)); }
          catch { warnings.push(`Result Template metadata for ${caption ?? "unnamed table"} could not be parsed.`); }
        }
        pushBlock({ type: "table", rows, caption, resultTemplate });
      }
    }
  }
  flushChecklist();

  const metadata = new Map<string, string>();
  for (const row of identityTable ?? []) {
    if (row[0] && row[1]) metadata.set(row[0].trim().toLowerCase(), row[1].trim());
  }
  const protocolTitle = metadata.get("protocol title") ?? "";
  const internalCode = protocolTitle.match(/PRT-\d{6}/)?.[0] ?? identityParagraphs.find((item) => /^PRT-\d{6}$/.test(item));
  const titleWithoutCode = protocolTitle.replace(/^PRT-\d{6}\s*/, "").trim();
  const canonicalTitle = titleWithoutCode || identityParagraphs.find((item) => !/^PRT-\d{6}$/.test(item)) || "Untitled Protocol";
  const englishTitleCandidate = identityParagraphs.find((item) =>
    item !== internalCode
    && item !== canonicalTitle
    && !/^PRT-(?:\d{6}|X{6})$/i.test(item)
    && /^[\x00-\x7F]+$/.test(item),
  );
  const englishTitle = /replace with english title/i.test(englishTitleCandidate ?? "")
    ? undefined
    : englishTitleCandidate;
  const availability = parseAvailability(metadata.get("availability"));
  const reviewStage = parseReviewStage(metadata.get("review stage"));
  const tags = (metadata.get("tag") ?? "").split(/[;；]/).map((item) => item.trim()).filter(Boolean);
  const filename = parseFilename(sourceFileName);
  const displayVersion = filename.displayVersion ?? "0.1";

  if (filename.code && internalCode && filename.code !== internalCode) {
    warnings.push(`Filename code ${filename.code} does not match document code ${internalCode}.`);
  }
  if (filename.availability && filename.availability !== availability) {
    warnings.push(`Filename availability ${filename.availability} does not match document availability ${availability}.`);
  }
  const missingSections = document.sections.filter((section) => section.blocks.length === 0).map((section) => section.title);
  if (missingSections.length) warnings.push(`Empty required sections: ${missingSections.join(", ")}.`);
  document.importWarnings = warnings;

  const projection = projectProtocolDocument(document);
  return {
    humanCode: internalCode,
    canonicalTitle,
    englishTitle,
    availability,
    reviewStage,
    displayVersion,
    tags,
    document,
    ...projection,
    sourceFileName,
    sourceFileChecksum,
  };
}

export function parseProtocolDocxBytes(bytes: Uint8Array, fileName: string): ParsedProtocolDocx {
  const archive = unzipSync(bytes);
  const documentXml = archive["word/document.xml"];
  if (!documentXml) throw new Error("This file is not a readable Word DOCX document.");
  const checksum = createHash("sha256").update(bytes).digest("hex");
  return parseProtocolDocumentXml(strFromU8(documentXml), fileName, checksum);
}

export async function parseProtocolDocx(file: File): Promise<ParsedProtocolDocx> {
  return parseProtocolDocxBytes(new Uint8Array(await file.arrayBuffer()), file.name);
}
