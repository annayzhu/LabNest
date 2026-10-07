import { describe, expect, it } from 'vitest';
import { createEmptyProtocolDocument, projectProtocolDocument, protocolDocumentSchema } from './protocol-document';
import { protocolDocumentToTiptap, tiptapToProtocolDocument } from './protocol-tiptap';

const fixture = () => protocolDocumentSchema.parse({ ...createEmptyProtocolDocument(), sections: [{ key: 'steps', title: 'Steps', blocks: [
  { id: 'dosage', type: 'checklist', items: ['以下为1个样本的工作用量'], execution: { role: 'info' } },
  { id: 'table', type: 'table', rows: [['规格', '用量'], ['示例', '200 µL']], execution: { role: 'info' } },
  { id: 'basis', type: 'text', text: '计算依据与配比说明', execution: { role: 'info' } },
  { id: 'a', type: 'checklist', items: ['去培养液并原位裂解'], execution: { role: 'step', stepId: 'operation-a', title: '去培养液并原位裂解' } },
  { id: 'body', type: 'rich_text', nodes: [{ type: 'paragraph', content: [{ text: '去培养液并原位裂解' }] }, { type: 'paragraph', content: [{ text: '加入200 µL，20–25°C。' }] }], execution: { role: 'detail', stepId: 'operation-a' } },
  { id: 'wash', type: 'checklist', items: ['轻柔吹打', '核对管号'], execution: { role: 'detail', stepId: 'operation-a' } },
  { id: 'b', type: 'heading', text: '分管并完成裂解', execution: { role: 'step', stepId: 'operation-b', title: '分管并完成裂解' } },
  { id: 'body-b', type: 'text', text: '室温放置5 min；确认分管关系。', execution: { role: 'detail', stepId: 'operation-b' } },
  { id: 'references', type: 'text', text: '参考资料：示例来源', execution: { role: 'info' } },
] }] });

describe('Protocol execution contract', () => {
  it('counts confirmed operations, retains dosage/reference blocks and removes only the exact leading generated title once', () => {
    const document = fixture(); const before = JSON.stringify(document);
    const result = projectProtocolDocument(document);
    expect(result.steps.map(step => step.title)).toEqual(['去培养液并原位裂解', '分管并完成裂解']);
    expect(result.steps.map(step => step.source_ref)).toEqual(['operation-a', 'operation-b']);
    expect(result.commonBlocks.map(block => block.id)).toEqual(['dosage', 'table', 'basis', 'references']);
    expect(result.steps[0].content_blocks?.map(block => block.id)).toEqual(['body', 'wash']);
    expect(JSON.stringify(result.steps[0].content_blocks)).not.toContain('去培养液并原位裂解');
    expect(JSON.stringify(result.steps[0].content_blocks)).toContain('200 µL');
    expect(JSON.stringify(document)).toBe(before);
  });
  it('keeps operation identity and confirmed ownership through editor serialization and reordering', () => {
    const document = fixture(); const roundtrip = tiptapToProtocolDocument(protocolDocumentToTiptap(document));
    expect(projectProtocolDocument(roundtrip).steps.map(step => step.source_ref)).toEqual(['operation-a', 'operation-b']);
    const blocks = roundtrip.sections.find(section => section.key === 'steps')!.blocks;
    blocks.splice(3, 0, ...blocks.splice(6, 2));
    expect(projectProtocolDocument(roundtrip).steps.map(step => step.source_ref)).toEqual(['operation-b', 'operation-a']);
    expect(projectProtocolDocument(roundtrip).steps[1].description).toContain('200 µL');
  });
  it('keeps ordinary checklists under their operation and does not invent steps from unstructured explanation paragraphs', () => {
    const document = createEmptyProtocolDocument(); const section = document.sections.find(s => s.key === 'steps')!;
    section.blocks = [{ id: 'heading', type: 'heading', text: '1. Prepare' }, { id: 'list', type: 'checklist', items: ['Tube', 'Buffer'] }, { id: 'note', type: 'text', text: 'Keep on ice.' }];
    expect(projectProtocolDocument(document).steps).toHaveLength(1);
    expect(projectProtocolDocument(document).steps[0].description).toContain('Keep on ice.');
    section.blocks = [{ id: 'explanation', type: 'text', text: 'Working dose basis only' }];
    expect(projectProtocolDocument(document).steps).toEqual([]);
    expect(projectProtocolDocument(document).commonBlocks).toHaveLength(1);
  });
});

it('keeps confirmed rich source, nested lists, scripts and media through the actual DOCX export/import path', async () => {
 const {exportProtocolDocx}=await import('./protocol-docx-export');
 const {parseProtocolDocxBytes}=await import('./protocol-docx');
 const document=fixture();document.sections[0].blocks.push({id:'rich-details',type:'rich_text',execution:{role:'detail',stepId:'operation-b'},nodes:[{type:'paragraph',content:[{text:'H'},{text:'2',subscript:true},{text:'O 10'},{text:'6',superscript:true},{text:' cells',link:'https://example.org/source',bold:true}],childContent:[{type:'bulletList',content:[{type:'listItem',content:[{type:'paragraph',content:[{type:'text',text:'Nested detail 30 µL'}]}]}]}]}]} as never);
 const bytes=exportProtocolDocx({canonicalTitle:'Synthetic protocol',availability:'draft',reviewStage:'draft',displayVersion:'1.0',scope:'general',tags:[]},document);
 const parsed=parseProtocolDocxBytes(bytes,'Synthetic_v1.0.docx');
 expect(projectProtocolDocument(parsed.document).steps.map(step=>step.source_ref)).toEqual(['operation-a','operation-b']);
 expect(JSON.stringify(parsed.document)).toContain('superscript');
 expect(JSON.stringify(parsed.document)).toContain('https://example.org/source');
 expect(JSON.stringify(parsed.document)).toContain('Nested detail 30 µL');
});

it('keeps repeated operations and parameter differences, uses a neutral label for body-only steps, and blocks orphan/unconfirmed roles', () => {
 const document=fixture(),section=document.sections[0];
 section.blocks=[
  {id:'first',type:'text',text:'洗涤',execution:{role:'step',stepId:'one',title:'洗涤'}},
  {id:'one-dose',type:'text',text:'洗涤：加入100 µL，保持2 min。',execution:{role:'detail',stepId:'one'}},
  {id:'second',type:'heading',text:'洗涤',execution:{role:'step',stepId:'two',title:'洗涤'}},
  {id:'two-dose',type:'text',text:'洗涤：加入200 µL，保持3 min。',execution:{role:'detail',stepId:'two'}},
  {id:'body-only',type:'text',text:'必须保留的完整正文。',execution:{role:'step',stepId:'three'}},
 ];
 const result=projectProtocolDocument(document);
 expect(result.steps.map(step=>step.title)).toEqual(['洗涤','洗涤','Step 3']);
 expect(result.steps[0].description).toContain('100 µL');expect(result.steps[1].description).toContain('200 µL');expect(result.steps[2].description).toBe('必须保留的完整正文。');
 expect(projectProtocolDocument({...document,executionConfirmed:false}).executionNeedsReview).toBe(true);
 section.blocks.push({id:'orphan',type:'text',text:'归属待确认',execution:{role:'detail',stepId:'missing'}});
 expect(projectProtocolDocument(document).executionNeedsReview).toBe(true);
});

it('retains the flags of an existing structured contract instead of inferring them from text', async()=>{
 const {protocolDocumentFromLegacy}=await import('./protocol-document');
 const document=protocolDocumentFromLegacy({materials:[],equipment:[],resultTemplates:[],consumptionRules:[],steps:[{source_ref:'stable',order:1,title:'Inspect',description:'Keep original settings',requires_confirmation:false,allows_deviation:false}]});
 expect(projectProtocolDocument(document).steps[0]).toMatchObject({source_ref:'stable',requires_confirmation:false,allows_deviation:false});
});

it('keeps a paragraph-owned nested list in one operation through the actual editor JSON seam',()=>{
 const document=fixture();document.sections[0].blocks=[{id:'owned',type:'rich_text',execution:{role:'step',stepId:'op',title:'Add reagent'},nodes:[{type:'paragraph',content:[{text:'Add 5 µL'}],childContent:[{type:'bulletList',content:[{type:'listItem',content:[{type:'paragraph',content:[{type:'text',text:'Keep on ice'}]}]}]}]},{type:'paragraph',content:[{text:'Incubate 10 min'}]}]}];
 const roundtrip=tiptapToProtocolDocument(protocolDocumentToTiptap(document)),projection=projectProtocolDocument(roundtrip);
 expect(projection.steps).toHaveLength(1);expect(projection.steps[0].source_ref).toBe('op');expect(projection.executionNeedsReview).toBe(false);
 expect(JSON.stringify(roundtrip)).toContain('childContent');expect(JSON.stringify(roundtrip)).toContain('Keep on ice');
 expect(projection.steps[0].description).toContain('Incubate 10 min');
});

it('preserves scripts and links inside an audited title prefix',async()=>{
 const {executionBodyWithoutTitle}=await import('./protocol-execution');
 const block={id:'formula',type:'checklist' as const,items:['H2O — Add water'],itemNodes:[[{type:'paragraph' as const,content:[{text:'H'},{text:'2',subscript:true},{text:'O — '},{text:'Add water',bold:true}]}]],execution:{role:'step' as const,stepId:'op',title:'H2O',titlePrefix:'H2O — '}};
 expect(executionBodyWithoutTitle([block],'H2O')[0]).toEqual(block);
});

it('preserves scientific scripts/links during title dedup and in visible Word XML rather than only the embedded JSON',async()=>{
 const {executionBodyWithoutTitle}=await import('./protocol-execution'),{exportProtocolDocx}=await import('./protocol-docx-export'),{unzipSync,strFromU8}=await import('fflate');
 const scientific={id:'formula',type:'text' as const,text:'H2O',nodes:[{type:'paragraph' as const,content:[{text:'H'},{text:'2',subscript:true},{text:'O',link:'https://example.org/method'}]}],execution:{role:'step' as const,stepId:'formula',title:'H2O'}};
 expect(executionBodyWithoutTitle([scientific],'H2O')).toHaveLength(1);
 const document=fixture();document.sections[0].blocks=[scientific,{id:'formatted-list',type:'checklist',items:['10⁶ cells'],itemNodes:[[{type:'paragraph',content:[{text:'10'},{text:'6',superscript:true},{text:' cells'}],childContent:[{type:'bulletList',content:[{type:'listItem',content:[{type:'paragraph',content:[{type:'text',text:'Essential note 5 µL'}]}]}]}]}]]}];
 const archive=unzipSync(exportProtocolDocx({canonicalTitle:'Visible export test',availability:'draft',reviewStage:'draft',displayVersion:'1.0',scope:'general',tags:[]},document));
 const visible=strFromU8(archive['word/document.xml']),relationships=strFromU8(archive['word/_rels/document.xml.rels']);
 expect(visible).toContain('w:val="subscript"');expect(visible).toContain('w:val="superscript"');expect(visible).toContain('Essential note 5 µL');expect(visible).toContain('w:hyperlink');expect(relationships).toContain('https://example.org/method');
});
it('adapts the original plate_reader template labels without discarding its measured fields',async()=>{
 const {exportProtocolDocx}=await import('./protocol-docx-export'),{parseProtocolDocxBytes}=await import('./protocol-docx'),{unzipSync,zipSync,strFromU8,strToU8}=await import('fflate');
 const document=fixture();document.sections.push({key:'result_templates',title:'Result Templates',blocks:[{id:'legacy',type:'table',rows:[['Key','Label'],['od','OD450']],resultTemplate:{result_type:'CCK8',templateKey:'cck8',resultKind:'assay',fields:[{key:'od',name:'OD450',label:'OD450',type:'number',dataType:'number',unit:'AU'}],view:{preset:'generic',charts:[]}}}]});
 const archive=unzipSync(exportProtocolDocx({canonicalTitle:'Legacy template test',availability:'draft',reviewStage:'draft',displayVersion:'1.0',scope:'general',tags:[]},document));
 archive['word/document.xml']=strToU8(strFromU8(archive['word/document.xml']).replaceAll('&quot;resultKind&quot;:&quot;assay&quot;','&quot;resultKind&quot;:&quot;plate_reader&quot;').replaceAll('&quot;preset&quot;:&quot;generic&quot;','&quot;preset&quot;:&quot;plate_reader&quot;'));
 const parsed=parseProtocolDocxBytes(zipSync(archive),'Legacy_v1.0_Draft.docx');
 expect(protocolDocumentSchema.safeParse(parsed.document).success).toBe(true);expect(parsed.resultTemplates[0].fields[0]).toMatchObject({key:'od',unit:'AU'});expect(parsed.resultTemplates[0].resultKind).toBe('assay');expect(parsed.document.importWarnings?.join(' ')).toContain('plate_reader');
});
