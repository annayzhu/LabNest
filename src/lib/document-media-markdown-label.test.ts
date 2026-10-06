import {describe,it,expect} from 'vitest';
import {documentMediaToMarkdown,documentMediaFromMarkdown,type DocumentMedia} from './document-media';
describe('readable Markdown export labels',()=>{
  it('can show a caption without changing the original filename or attachment identity',()=>{
    const image:DocumentMedia={id:'image',type:'media',mediaType:'image',url:'',attachmentId:'original-id',filename:'download.png',caption:'测试图注 25 µL',widthPercent:60};
    const markdown=documentMediaToMarkdown(image,image.caption);
    expect(markdown).toContain('![测试图注 25 µL](attachment:original-id)');
    expect(documentMediaFromMarkdown(markdown)).toEqual(image);
    expect(documentMediaToMarkdown(image)).toContain('![download.png]');
  });
});
