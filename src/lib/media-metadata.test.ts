import { describe, expect, it } from "vitest";
import { buildAttachmentMetadata, readImageDimensions } from "./media-metadata";

describe("media metadata", () => {
  it("reads PNG dimensions without decoding pixels", () => {
    const buffer = Buffer.alloc(24);
    Buffer.from("89504e470d0a1a0a", "hex").copy(buffer, 0);
    buffer.writeUInt32BE(640, 16);
    buffer.writeUInt32BE(480, 20);
    expect(readImageDimensions(buffer, "image/png")).toEqual({ width: 640, height: 480 });
  });

  it("marks images as inline-previewable and other files as downloads", () => {
    expect(buildAttachmentMetadata(Buffer.alloc(2), "image/jpeg").preview).toEqual({ strategy: "original_inline", available: true });
    expect(buildAttachmentMetadata(Buffer.alloc(2), "text/csv").preview).toEqual({ strategy: "download", available: false });
  });
});
