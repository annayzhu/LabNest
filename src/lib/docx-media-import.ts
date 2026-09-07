import { DOMParser, XMLSerializer } from "@xmldom/xmldom";
import { strFromU8, unzipSync } from "fflate";
import { documentMediaToMarkdown, type DocumentMedia } from "./document-media";

export type DocxEmbeddedImage = { key: string; filename: string; mimeType: string; bytes: Uint8Array };
const wordNamespace = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";

/** Extract only package-local images; external relationships are never fetched. */
export function extractDocxMedia(bytes: Uint8Array) {
  const archive = unzipSync(bytes);
  if (!archive["word/document.xml"]) throw new Error("DOCX document body missing");
  const parser = new DOMParser();
  const dom = parser.parseFromString(strFromU8(archive["word/document.xml"]), "application/xml");
  const rels = parser.parseFromString(archive["word/_rels/document.xml.rels"] ? strFromU8(archive["word/_rels/document.xml.rels"]) : "<Relationships/>", "application/xml");
  const relationships = new Map(Array.from(rels.getElementsByTagName("Relationship")).map(rel => [rel.getAttribute("Id"), rel]));
  const images: DocxEmbeddedImage[] = [];
  const warnings: string[] = [];
  let total = 0;
  for (const paragraph of Array.from(dom.getElementsByTagName("w:p"))) {
    if (!paragraph.getElementsByTagName("w:drawing").length) continue;
    const segments: string[] = [];
    let text = "";
    const flush = () => { if (text.trim()) segments.push(text); text = ""; };
    const walk = (node: typeof paragraph) => {
      if (node.nodeName === "w:drawing") {
        flush();
        const blip = node.getElementsByTagName("a:blip")[0];
        const relationship = relationships.get(blip?.getAttribute("r:embed") || "");
        const target = relationship?.getAttribute("Target") || "";
        const path = target.startsWith("/") ? target.slice(1) : `word/${target.replace(/^\.\//, "")}`;
        const body = !relationship?.getAttribute("TargetMode") && !path.includes("..") ? archive[path] : undefined;
        const extension = path.split(".").at(-1)?.toLowerCase() || "";
        const mimeType = ({ png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp", avif: "image/avif" } as Record<string, string>)[extension];
        if (!body || !mimeType) { warnings.push("DOCX_IMAGE_UNAVAILABLE: 图片格式或外部链接无法导入 / Unsupported or external image."); return; }
        total += body.length;
        if (body.length > 25 * 1024 * 1024 || total > 100 * 1024 * 1024) throw new Error("Word 内嵌图片超出附件大小限制 / Embedded images exceed attachment limits");
        const key = `docx-image-${images.length + 1}`;
        let metadata: Record<string, unknown> = {};
        const raw = node.getElementsByTagName("wp:docPr")[0]?.getAttribute("descr");
        if (raw?.startsWith("labnest-media:")) { try { metadata = JSON.parse(raw.slice("labnest-media:".length)); } catch { /* Fall back to source filename, never trust malformed metadata. */ } }
        const filename = typeof metadata.filename === "string" ? metadata.filename : path.split("/").at(-1)!;
        images.push({ key, filename, mimeType, bytes: body });
        const media: DocumentMedia = { id: key, type: "media", mediaType: "image", url: "", importImageKey: key, filename, mimeType, size: body.length,
          ...(typeof metadata.caption === "string" ? { caption: metadata.caption } : {}),
          ...(typeof metadata.widthPercent === "number" && metadata.widthPercent >= 10 && metadata.widthPercent <= 100 ? { widthPercent: metadata.widthPercent } : {}),
        };
        segments.push(documentMediaToMarkdown(media));
        return;
      }
      if (node.nodeName === "w:t") { text += node.textContent || ""; return; }
      if (node.nodeName === "w:tab" || node.nodeName === "w:br") { text += " "; return; }
      for (const child of Array.from(node.childNodes)) if (child.nodeType === 1) walk(child as typeof paragraph);
    };
    walk(paragraph); flush();
    for (const segment of segments) {
      const replacement = dom.createElementNS(wordNamespace, "w:p");
      const run = dom.createElementNS(wordNamespace, "w:r"), value = dom.createElementNS(wordNamespace, "w:t");
      value.appendChild(dom.createTextNode(segment)); run.appendChild(value); replacement.appendChild(run);
      paragraph.parentNode?.insertBefore(replacement, paragraph);
    }
    paragraph.parentNode?.removeChild(paragraph);
  }
  return { xml: new XMLSerializer().serializeToString(dom), images, warnings };
}
