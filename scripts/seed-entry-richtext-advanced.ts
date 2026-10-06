import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {prisma} from '../src/lib/db';
import {buildEntryContent} from '../src/lib/entry-content';
assert.equal(new URL(process.env.DATABASE_URL!).pathname,'/labnest_entry_richtext_test_20261006');
async function main(){
 const date = await prisma.entry.create({data:{title:'测试历史仅日期',body:'TEST-DATE-ONLY',eventTimePrecision:'date',occurredAt:new Date('2026-09-30'),createdAt:new Date('2026-10-01T01:15:00Z'),contentJson:buildEntryContent('TEST-DATE-ONLY',[])}});
 const frozen = await prisma.experiment.create({data:{title:'测试冻结状态转换',runCode:'TEST-FREEZE-'+Date.now(),recordStatus:'draft'}});
 const invalid = await prisma.experiment.create({data:{title:'测试失效归属',runCode:'TEST-INVALID-'+Date.now(),status:'archived'}});
 const source = await prisma.entry.create({data:{title:'测试失效来源',body:'TEST-INVALID-SOURCE',contentJson:buildEntryContent('TEST-INVALID-SOURCE',[])}});
 await prisma.itemLink.create({data:{sourceType:'entry',sourceId:source.id,targetType:'experiment',targetId:invalid.id,linkType:'entry_primary'}});
 writeFileSync('docs/qa/evidence/entry-richtext/advanced-fixtures.json',JSON.stringify({synthetic:true,dateId:date.id,frozenId:frozen.id,invalidSourceId:source.id},null,2));
}
main().finally(()=>prisma.$disconnect());
