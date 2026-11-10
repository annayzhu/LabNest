-- Synthetic data only (day-record acceptance, 2026-11-09). Re-runnable: it first removes what an earlier run left.
-- Test database only (labnest_dayrecord_20261109, cloned from the formal one); never run it against `labnest`.
delete from "ItemLink" where "sourceType" = 'experiment' and "sourceId" like 'syn-dr-%';
delete from "ActivityLog" where "targetType" = 'experiment' and "targetId" like 'syn-dr-%';
delete from "Experiment" where id like 'syn-dr-%';
insert into "Experiment" (id,"runCode",title,status,"recordStatus",date,purpose,"updatedAt","scheduleDays") values
 ('syn-dr-1','EXP-901','合成测试：质粒转染后收样与 RNA 提取（四天流程，名称较长用于检查换行）','running','draft','2026-11-09T00:00:00Z','合成数据：检查执行记录按天分节与日程摘要。',now(),5),
 ('syn-dr-2','EXP-902','合成测试：单日实验（无日程）','planned','draft','2026-11-09T00:00:00Z',null,now(),null),
 ('syn-dr-3','EXP-903','合成测试：十二天长周期','planned','draft','2026-11-02T00:00:00Z',null,now(),12);
insert into "ExperimentStep" (id,"experimentId","groupKey","groupTitle","groupOrder","order",title,description,completed,"completedAt","deviationNote","deviationType") values
 ('syn-a1','syn-dr-1','manual-seed','细胞铺板',0,1,'复苏并计数细胞','合成步骤',true,'2026-11-09T02:00:00Z',null,null),
 ('syn-a2','syn-dr-1','manual-seed','细胞铺板',0,2,'按 2 × 10^5/孔铺 6 孔板，过夜培养','合成步骤',true,'2026-11-09T02:30:00Z',null,null),
 ('syn-b1','syn-dr-1','manual-tf','质粒转染',1,1,'配制转染混合液','合成步骤',true,'2026-11-10T01:40:00Z',null,null),
 ('syn-b2','syn-dr-1','manual-tf','质粒转染',1,2,'加入孔中，孵育 48 h','合成步骤',false,null,'实际孵育 50 h','timing'),
 ('syn-b3','syn-dr-1','manual-tf','质粒转染',1,3,'收样并裂解','合成步骤',false,null,null,null),
 ('syn-b4','syn-dr-1','manual-tf','质粒转染',1,4,'RNA 提取与定量','合成步骤',false,null,null,null),
 ('syn-c1','syn-dr-1','manual-qc','补充检查',2,1,'拍照记录细胞形态','合成步骤',false,null,null,null),
 ('syn-s1','syn-dr-2','manual','自定义步骤',0,1,'配制缓冲液','合成步骤',false,null,null,null),
 ('syn-s2','syn-dr-2','manual','自定义步骤',0,2,'过滤除菌','合成步骤',false,null,null,null),
 ('syn-l1','syn-dr-3','manual','长周期培养',0,1,'接种','合成步骤',false,null,null,null),
 ('syn-l2','syn-dr-3','manual','长周期培养',0,2,'换液','合成步骤',false,null,null,null),
 ('syn-l3','syn-dr-3','manual','长周期培养',0,3,'传代','合成步骤',false,null,null,null),
 ('syn-l4','syn-dr-3','manual','长周期培养',0,4,'收集上清','合成步骤',false,null,null,null);
insert into "ExperimentScheduleBlock" (id,"experimentId",kind,title,"stepRefs","startAt","allDay","estimatedMinutes","afterBlockId","minGapMinutes","maxGapMinutes","gapSource",note,"doneAt","updatedAt") values
 ('syn-bk-seed','syn-dr-1','steps',null,'{syn-a1,syn-a2}','2026-11-09T01:30:00Z',false,40,null,null,null,null,null,null,now()),
 ('syn-bk-tf','syn-dr-1','steps',null,'{syn-b1,syn-b2}','2026-11-10T01:30:00Z',false,30,'syn-bk-seed',720,1200,'overnight:syn-a2',null,null,now()),
 ('syn-bk-item','syn-dr-1','task','准备 TRIzol 与预冷离心机','{}','2026-11-11T02:00:00Z',true,null,null,null,null,null,'合成事项',null,now()),
 ('syn-bk-harvest','syn-dr-1','steps',null,'{syn-b3,syn-b4}','2026-11-12T01:30:00Z',false,90,'syn-bk-tf',2880,2880,'step:syn-b2',null,null,now()),
 ('syn-l-1','syn-dr-3','steps',null,'{syn-l1}','2026-11-02T01:00:00Z',false,30,null,null,null,null,null,null,now()),
 ('syn-l-2','syn-dr-3','steps',null,'{syn-l2}','2026-11-05T01:00:00Z',false,30,'syn-l-1',4320,4320,'manual',null,null,now()),
 ('syn-l-3','syn-dr-3','steps',null,'{syn-l3}','2026-11-09T01:00:00Z',false,30,'syn-l-2',5760,5760,'manual',null,null,now()),
 ('syn-l-4','syn-dr-3','steps',null,'{syn-l4}','2026-11-13T01:00:00Z',false,30,'syn-l-3',5760,5760,'manual',null,null,now());
-- Step 2 (换版本): a later version of a Protocol already in the cloned database, copied under a synthetic id and marked as a test.
insert into "ProtocolVersion" (id,"protocolId","versionNumber",title,purpose,background,scope,notes,"parametersJson","materialsJson","equipmentJson","stepsJson","consumptionRulesJson","resultTemplatesJson","createdAt","changeSummary","recordStatus","adaptationRationale","derivedFromVersionId","displayVersion","previousVersionId","reviewStage","contentJson","sourceFileChecksum","sourceFileName","sourceImportedAt","sourceType")
select 'syn-dr-pv-transfection-04',"protocolId","versionNumber"+1,title,purpose,background,scope,notes,"parametersJson","materialsJson","equipmentJson","stepsJson","consumptionRulesJson","resultTemplatesJson",now(),'合成测试版本（day-record 验收）',"recordStatus","adaptationRationale",id,'0.4-测试',id,"reviewStage","contentJson","sourceFileChecksum","sourceFileName","sourceImportedAt","sourceType"
from "ProtocolVersion" where id = 'cmuxs9v3d00009yos65xcvb71' on conflict (id) do nothing;
-- A line already written in the one-day experiment: it stays with day 1 once the experiment gets a second day.
update "Experiment" set "contentJson" = '{"schemaVersion":1,"sections":[{"key":"execution","title":"Execution notes","blocks":[{"id":"syn-dr-2-note","type":"text","text":"合成记录：缓冲液 pH 7.4。"}]}]}' where id = 'syn-dr-2';
