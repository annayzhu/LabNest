import {describe,it,expect} from 'vitest';
import {documentMediaSchema,documentMediaToMarkdown,documentMediaFromMarkdown} from './document-media';
import {normalizeResultDocument,createScientificDocument,resultSections} from './scientific-document';
import {normalizeProtocolDocument,createEmptyProtocolDocument} from './protocol-document';
describe('image dimensions survive every persisted editor format',()=>{
 it('keeps original identity, display width and source dimensions through Markdown, scientific and Protocol documents',()=>{
  const image={id:'node-1',type:'media',mediaType:'image',url:'',attachmentId:'original-1',widthPercent:60,imageWidth:1000,imageHeight:100,caption:'中文图注'} as const;
  expect(documentMediaFromMarkdown(documentMediaToMarkdown(documentMediaSchema.parse(image)))).toMatchObject(image);
  const scientific=createScientificDocument(resultSections);scientific.sections[0].blocks=[image];
  expect(normalizeResultDocument(scientific).sections[0].blocks[0]).toMatchObject(image);
  const protocol=createEmptyProtocolDocument();protocol.sections[0].blocks=[image];
  expect(normalizeProtocolDocument(protocol)!.sections[0].blocks[0]).toMatchObject(image);
 });
 it('continues accepting legacy media without pixel dimensions',()=>{
  expect(documentMediaSchema.parse({id:'legacy',type:'media',mediaType:'image',url:'',attachmentId:'original-old'}).attachmentId).toBe('original-old');
 });
});
