/** Decode locally from a photo; no camera-stream API, secure-context API or upload is required. */
export async function readInventoryBarcode(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const canvas = document.createElement("canvas");
    // Bound work on phone-sized CPUs while preserving enough pixels for a printed label.
    const scale = Math.min(1, 2048 / Math.max(image.naturalWidth, image.naturalHeight));
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Image canvas unavailable");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const [{ BrowserMultiFormatReader }, { DecodeHintType }] = await Promise.all([
      import("@zxing/browser"), import("@zxing/library"),
    ]);
    const reader = new BrowserMultiFormatReader(new Map([[DecodeHintType.TRY_HARDER, true]]));
    const value = reader.decodeFromCanvas(canvas).getText().trim();
    if (!value) throw new Error("No readable code");
    return value;
  } finally {
    URL.revokeObjectURL(url);
  }
}
