import { z } from "zod";
import { isRichTextFontSizePt, type RichTextFontSizePt } from "@/lib/rich-text-font-size";

export const richTextFontSizeSchema = z.custom<RichTextFontSizePt>(
  isRichTextFontSizePt,
  "Unsupported rich-text font size",
);
