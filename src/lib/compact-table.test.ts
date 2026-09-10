import type {JSONContent} from "@tiptap/core";
import {plainTextFromEntryMarkdown} from "./entry-content";
import {describe,it,expect} from 'vitest';
import {markdownRichTextToTiptap,tiptapToMarkdownRichText} from './scientific-tiptap';
import {scientificBlocksFromText} from './scientific-document';
import {protocolRichTextNodeSchema} from './protocol-document';
import {protocolRichTextToTiptap,tiptapToProtocolRichText} from './protocol-tiptap';
const table={type:'table',content:[{type:'tableRow',content:[{type:'tableHeader',content:[{type:'paragraph',content:[{type:'text',text:'组分'}]}]},{type:'tableHeader',content:[{type:'paragraph',attrs:{textAlign:'right',documentIndent:1},content:[{type:'text',text:'12 µL × ± ≥ CO₂',marks:[{type:'bold'}]}]}]}]}]};
describe('compact rich editors retain pasted tables',()=>{
 it('Entry markdown reopens rich cells and promotes the same table into scientific documents',()=>{const stored=tiptapToMarkdownRichText({type:'doc',content:[table]});expect(plainTextFromEntryMarkdown(stored)).toBe("组分 12 µL × ± ≥ CO₂");const reopened=markdownRichTextToTiptap(stored).content![0];expect(reopened.type).toBe('table');expect(reopened.content![0].content![1].content![0]).toMatchObject(table.content[0].content[1].content[0]);expect(scientificBlocksFromText(stored,'entry')[0]).toMatchObject({type:'table',rows:[['组分','12 µL × ± ≥ CO₂']]});});
 it('template instructions retain table content through their existing validated rich nodes',()=>{const stored=tiptapToProtocolRichText({type:'doc',content:[table]}).map(n=>protocolRichTextNodeSchema.parse(n));const reopened=protocolRichTextToTiptap(stored);expect(reopened.content?.find(n=>n.type==='table')).toEqual(table);expect(tiptapToProtocolRichText(reopened)).toEqual(stored);});
});

it('associates images inside Entry table cells and rejects pending uploads',async()=>{
 const {collectDocumentMedia,assertDocumentMediaReady}=await import('./document-media');
 const block={id:'cell-image',type:'media',mediaType:'image',url:'/attachments/fixture-image',attachmentId:'fixture-image',caption:'表内图'};
 const withImage:JSONContent={type:'table',content:[{type:'tableRow',content:[{type:'tableCell',content:[{type:'documentMedia',attrs:{block}}]}]}]};
 const stored=tiptapToMarkdownRichText({type:'doc',content:[withImage]});expect(collectDocumentMedia(stored)).toHaveLength(1);expect(collectDocumentMedia(stored)[0].attachmentId).toBe('fixture-image');
 for(const pending of [{url:'blob:pending',pendingUploadId:'pending'},{url:'data:image/png;base64,eA=='}]){withImage.content![0].content![0].content=[{type:'documentMedia',attrs:{block:{...block,...pending}}}];expect(()=>assertDocumentMediaReady(tiptapToMarkdownRichText({type:'doc',content:[withImage]}))).toThrow();}
});
