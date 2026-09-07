import type { DocumentMedia } from "./document-media";
import { documentMediaAttachmentId } from "./document-media";

export type DocxImageAsset = { bytes: Uint8Array; extension: string; mimeType: string; width: number; height: number };
export type DocxImageAssets = Record<string, DocxImageAsset>;
const escapeXml = (text: string) => text.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

export function createDocxMedia(assets: DocxImageAssets) {
  const files: Record<string, Uint8Array> = {};
  const relationships: string[] = [];
  const types = new Map<string, string>();
  return {
    files, relationships,
    contentTypes: () => [...types].map(([extension, mime]) => `<Default Extension="${escapeXml(extension)}" ContentType="${escapeXml(mime)}"/>`).join(""),
    image(block: DocumentMedia) {
      const id = documentMediaAttachmentId(block);
      const asset = id ? assets[id] : undefined;
      if (!asset) throw new Error(`图片 ${block.filename || block.caption || block.id} 无法嵌入，请先上传或恢复原文件。 / Image original is required for Word export.`);
      const sequence = relationships.length + 1;
      const name = `media/image-${sequence}.${asset.extension}`;
      files[`word/${name}`] = asset.bytes;
      types.set(asset.extension, asset.mimeType);
      relationships.push(`<Relationship Id="rIdMedia${sequence}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="${name}"/>`);
      const desiredWidth = 6080760 * (block.widthPercent ?? 100) / 100;
      const scale = Math.min(desiredWidth / asset.width, 7315200 / asset.height);
      const cx = Math.round(asset.width * scale), cy = Math.round(asset.height * scale);
      const description = escapeXml(JSON.stringify({ caption: block.caption, filename: block.filename, widthPercent: block.widthPercent }));
      return `<w:r><w:drawing><wp:inline xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><wp:extent cx="${cx}" cy="${cy}"/><wp:docPr id="${sequence}" name="Image ${sequence}" descr="labnest-media:${description}"/><wp:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect="1"/></wp:cNvGraphicFramePr><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="${sequence}" name="${escapeXml(block.filename || name)}"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="rIdMedia${sequence}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`;
    },
  };
}
