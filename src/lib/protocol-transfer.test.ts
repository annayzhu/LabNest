import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { documentMediaFromMarkdown, documentMediaToMarkdown, type DocumentMedia } from "./document-media";
import { detachFromSourceLabNest, documentAttachmentIds, protocolTransferEnvelope, PROTOCOL_TRANSFER_VERSION, readProtocolTransfer, transferImageKey } from "./protocol-transfer";
import { parseStructuredFile } from "./structured-files";

const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");
const media = (attachmentId = "att-source-1") => ({ attachmentId, filename: "gel.png", mimeType: "image/png", sha256: createHash("sha256").update(png).digest("hex"), base64: png.toString("base64") });
const picture: DocumentMedia = { id: "m1", type: "media", mediaType: "image", url: "", attachmentId: "att-source-1", filename: "gel.png", widthPercent: 60 };

describe("Protocol file for another LabNest", () => {
  it("reads the pictures a LabNest export carries, keyed by the ID they had there", () => {
    const transfer = readProtocolTransfer(protocolTransferEnvelope([{ canonicalTitle: "RNA extraction" }], [media()], "2026-11-11T00:00:00.000Z"));
    expect(transfer?.info).toEqual({ version: PROTOCOL_TRANSFER_VERSION, exportedAt: "2026-11-11T00:00:00.000Z" });
    expect(transfer?.images).toHaveLength(1);
    expect(transfer?.images[0]).toMatchObject({ key: "transfer:att-source-1", sourceAttachmentId: "att-source-1", filename: "gel.png", mimeType: "image/png" });
    expect(Buffer.from(transfer!.images[0].bytes).equals(png)).toBe(true);
  });

  it("leaves a hand-written or template JSON file to the ordinary import", () => {
    expect(readProtocolTransfer([{ canonicalTitle: "A" }])).toBeUndefined();
    expect(readProtocolTransfer({ schemaVersion: "labnest.structured-import/v1", module: "protocols", records: [] })).toBeUndefined();
  });

  it("reads an export written before pictures travelled with the file as carrying none", () => {
    expect(readProtocolTransfer({ schemaVersion: "labnest.structured-export/v1", module: "protocols", records: [] })).toEqual({ info: { version: 0 }, images: [] });
  });

  it("refuses a file from a newer LabNest instead of importing part of it", () => {
    const newer = { ...protocolTransferEnvelope([], []), protocolTransferVersion: PROTOCOL_TRANSFER_VERSION + 1 };
    expect(() => readProtocolTransfer(newer)).toThrow("exported by a newer LabNest");
    expect(() => readProtocolTransfer({ ...protocolTransferEnvelope([], []), schemaVersion: "labnest.structured-export/v2" })).toThrow("exported by a newer LabNest");
  });

  it("refuses a damaged picture and an export of another kind of record", () => {
    expect(() => readProtocolTransfer(protocolTransferEnvelope([], [{ ...media(), sha256: "0".repeat(64) }]))).toThrow("damaged");
    expect(() => readProtocolTransfer(protocolTransferEnvelope([], [{ ...media(), base64: "not base64!" }]))).toThrow("cannot be read");
    expect(() => readProtocolTransfer({ ...protocolTransferEnvelope([], []), module: "experiments" })).toThrow("another kind of record");
  });

  it("points pictures to the copies in the file: as blocks, in table cells and in rich cell content", () => {
    const line = documentMediaToMarkdown(picture);
    const document = {
      sections: [{ key: "steps", blocks: [
        { ...picture, id: "b1" },
        { id: "b2", type: "table", rows: [["Lane", `Marker\n${line}`]], cellRichContent: [[null, [{ type: "documentMedia", attrs: { block: picture } }]]] },
        { id: "b3", type: "media", mediaType: "image", url: "/api/attachments/att-source-2", caption: "by URL" },
        { id: "b4", type: "media", mediaType: "image", url: "https://example.org/figure.png" },
      ] }],
    };
    const { value } = detachFromSourceLabNest(document, new Set(["att-source-1", "att-source-2"]));
    const blocks = value.sections[0].blocks as Array<Record<string, unknown>>;
    expect(blocks[0]).toMatchObject({ importImageKey: transferImageKey("att-source-1"), url: "", widthPercent: 60 });
    expect(blocks[0]).not.toHaveProperty("attachmentId");
    const cellLine = (blocks[1].rows as string[][])[0][1].split("\n")[1];
    expect(documentMediaFromMarkdown(cellLine)).toMatchObject({ importImageKey: "transfer:att-source-1" });
    expect((blocks[1].cellRichContent as Array<Array<Array<{ attrs: { block: Record<string, unknown> } }> | null>>)[0][1]![0].attrs.block).toMatchObject({ importImageKey: "transfer:att-source-1" });
    expect(blocks[2]).toMatchObject({ importImageKey: "transfer:att-source-2", url: "" });
    // A picture on the web is not a file of the other LabNest.
    expect(blocks[3]).toEqual(document.sections[0].blocks[3]);
    // Nothing still points to a file that only the other LabNest has.
    expect(documentAttachmentIds(value)).toEqual([]);
  });

  it("keeps a picture that is not in the file as it was, so the preview can say it is missing", () => {
    const { value } = detachFromSourceLabNest({ blocks: [{ ...picture, id: "b1" }] }, new Set());
    expect(documentAttachmentIds(value)).toEqual(["att-source-1"]);
  });

  it("turns tags and links to the other LabNest's records into the text written at the time", () => {
    const document = {
      text: "Add [RNase A · LOT-22](/inventory/cku3abc) to [S-014 liver](/samples/ckx9) and see [the paper](https://doi.org/10.1000/x).",
      nodes: [{ type: "paragraph", content: [{ text: "EXP-012", link: "/experiments/ck1" }, { text: "protocols.io", link: "https://www.protocols.io/view/x" }] }],
      cellRichContent: [[[{ type: "paragraph", content: [{ type: "text", text: "Buffer RLT", marks: [{ type: "bold" }, { type: "link", attrs: { href: "/inventory/products/ckp" } }] }] }]]],
      embedded: { type: "embedded_tool", url: "/tools/qpcr", label: "qPCR" },
    };
    const { value, unlinked } = detachFromSourceLabNest(document, new Set());
    expect(value.text).toBe("Add RNase A · LOT-22 to S-014 liver and see [the paper](https://doi.org/10.1000/x).");
    expect(value.nodes[0].content).toEqual([{ text: "EXP-012" }, { text: "protocols.io", link: "https://www.protocols.io/view/x" }]);
    expect(value.cellRichContent[0][0][0].content[0]).toEqual({ type: "text", text: "Buffer RLT", marks: [{ type: "bold" }] });
    // A tool is part of every LabNest, not a record of one.
    expect(value.embedded).toEqual(document.embedded);
    expect(unlinked).toBe(4);
  });

  it("leaves alone text that only looks like a link, code, and pages every LabNest has", () => {
    const document = {
      nodes: [{ type: "paragraph", content: [
        { text: "ratio [Mg2+](/[ATP]) and arr[i](/2)", code: true },
        { text: "see [x](/y), [the list](/inventory/list) and [a new one](/protocols/new)" },
        { text: "library", link: "/protocols" },
        { text: "gel.tif", link: "/api/attachments/ckfile01" },
      ] }],
      cellRichContent: [[[
        { type: "codeBlock", content: [{ type: "text", text: "[S-1](/samples/ck1)" }] },
        { type: "paragraph", content: [{ type: "text", text: "[S-2](/samples/ck2)", marks: [{ type: "code" }] }] },
      ]]],
    };
    const { value, unlinked } = detachFromSourceLabNest(document, new Set());
    expect(value.nodes[0].content.slice(0, 3)).toEqual(document.nodes[0].content.slice(0, 3));
    // A file kept in the other LabNest is not here either.
    expect(value.nodes[0].content[3]).toEqual({ text: "gel.tif" });
    expect(value.cellRichContent).toEqual(document.cellRichContent);
    expect(unlinked).toBe(1);
  });

  it("refuses a file that lists the same picture twice", () => {
    expect(() => readProtocolTransfer(protocolTransferEnvelope([], [media(), media()]))).toThrow("cannot be read");
  });

  it("changes nothing else: parameters, systems, mix cards and programs arrive as written", () => {
    const document = {
      schemaVersion: 1,
      systems: { dimensions: [{ id: "d1", label: "体系", options: [{ id: "o1", label: "350 µL" }, { id: "o2", label: "600 µL" }] }] },
      sections: [{ key: "steps", title: "Steps", blocks: [
        { id: "s1", type: "rich_text", execution: { role: "step" }, nodes: [{ type: "numbered", content: [{ text: "加入 {{p:pk|350=50 µL|600=80 µL}} Proteinase K", bold: true }] }] },
        { id: "s2", type: "mix", title: "qPCR mix", per: "反应", overagePercent: 10, minPipetteUl: 0.5, components: [{ id: "c1", name: "SYBR", amount: "{{p:sybr|10 µL}}", mode: "premix" }] },
        { id: "s3", type: "program", label: "PCR", stages: [{ id: "g1", cycles: 40, steps: [{ id: "t1", temperatureC: 95, seconds: 15 }, { id: "t2", temperatureC: 60, seconds: null }] }] },
      ] }],
    };
    expect(detachFromSourceLabNest(document, new Set(["unused"]))).toEqual({ value: document, unlinked: 0 });
  });

  it("parses an export file into records, its pictures and the transfer mark", async () => {
    const body = JSON.stringify(protocolTransferEnvelope([{ humanCode: "PRT-000012", canonicalTitle: "RNA extraction", displayVersion: "1.2", contentJson: { schemaVersion: 1, sections: [] } }], [media()]));
    const parsed = await parseStructuredFile(new File([body], "PRT-000012_v1.2.json", { type: "application/json" }), "protocols");
    expect(parsed.protocolTransfer?.version).toBe(PROTOCOL_TRANSFER_VERSION);
    expect(parsed.embeddedImages).toHaveLength(1);
    expect(parsed.records[0]).toMatchObject({ humanCode: "PRT-000012", canonicalTitle: "RNA extraction", displayVersion: "1.2" });
    const template = await parseStructuredFile(new File([JSON.stringify([{ canonicalTitle: "Hand-written" }])], "batch.json"), "protocols");
    expect(template.protocolTransfer).toBeUndefined();
  });
});
