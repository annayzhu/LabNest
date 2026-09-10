import { z } from "zod";
export const paragraphLayoutFields = {
  textAlign:z.enum(["left","center","right","justify"]).optional(),
  documentIndent:z.number().min(0).max(8).optional(),
  spaceBeforePt:z.number().min(0).max(48).optional(),
  spaceAfterPt:z.number().min(0).max(48).optional(),
};
/** Shared paragraph layout values; the existing adapters own persistence. */
export type ParagraphLayout = {textAlign?: 'left'|'center'|'right'|'justify'; documentIndent?: number; spaceBeforePt?: number; spaceAfterPt?: number};
export function paragraphLayout(value: Record<string, unknown> = {}): ParagraphLayout {
 const result: ParagraphLayout = {};
 if (['left','center','right','justify'].includes(String(value.textAlign))) result.textAlign=value.textAlign as ParagraphLayout['textAlign'];
 for (const key of ['documentIndent','spaceBeforePt','spaceAfterPt'] as const) {
  const number=value[key];
  if(typeof number==='number' && Number.isFinite(number) && number>=0 && number<=(key==='documentIndent'?8:48))result[key]=number;
 }
 return result;
}
export function paragraphLayoutStyle(value: Record<string, unknown>) {
 const layout=paragraphLayout(value);
 return {textAlign:layout.textAlign,paddingInlineStart:layout.documentIndent===undefined?undefined:`${layout.documentIndent*1.5}em`,marginBlockStart:layout.spaceBeforePt===undefined?undefined:`${layout.spaceBeforePt}pt`,marginBlockEnd:layout.spaceAfterPt===undefined?undefined:`${layout.spaceAfterPt}pt`};
}
export function paragraphLayoutPrefix(value:Record<string,unknown>) {
 const layout=paragraphLayout(value);
 return Object.keys(layout).length?`<!--labnest-paragraph:${encodeURIComponent(JSON.stringify(layout))}-->`:'';
}
export function parseParagraphLayoutLine(value:string) {
 const match=value.match(/^<!--labnest-paragraph:([^>]+)-->(.*)$/);
 if(match)try{return {layout:paragraphLayout(JSON.parse(decodeURIComponent(match[1]))),content:match[2]};}catch{/* Preserve malformed user content verbatim. */}
 return {layout:{} as ParagraphLayout,content:value};
}

export function stripParagraphLayoutMarkup(value:string) {
 return value.split("\n").map(line=>parseParagraphLayoutLine(line).content).join("\n");
}
