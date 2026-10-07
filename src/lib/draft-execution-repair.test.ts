import {expect,it} from 'vitest';
import {draftExecutionRepair} from './draft-execution-repair';
const saved=(id:string)=>({id,title:'Generated fragment',description:'',protocolStepRef:'v:'+id,groupKey:'v',groupOrder:0,groupTitle:'Example',order:1,completed:false,completedAt:null,deviationNote:null,deviationType:null,deviationImpact:null,deviationAuthor:null,timerDurationSeconds:null,timerRemainingSeconds:null,timerStartedAt:null,timerPausedAt:null});
it('retains explicitly mapped saved IDs and notes while refusing incomplete mappings or started evidence',()=>{
 const heading=saved('title'),body={...saved('body'),deviationNote:'Keep this author note'},info={...saved('info'),deviationNote:'Reference note'};
 const desired=[{source_ref:'op-a',order:1,title:'Prepare',description:'Full body'}];
 const result=draftExecutionRepair([heading,body,info],desired,{title:'op-a',body:'op-a',info:'info'},{'op-a':'title'},'v');
 expect(result.updates[0].id).toBe('title');expect(result.updates[0].data.deviationNote).toBe('Keep this author note');expect(result.removed).toEqual([{id:'body',targetId:'title',informationNote:null},{id:'info',targetId:null,informationNote:'Reference note'}]);
 expect(()=>draftExecutionRepair([{...heading,completed:true}],desired,{title:'op-a'},{'op-a':'title'},'v')).toThrow('Started');
 expect(()=>draftExecutionRepair([heading,body],desired,{title:'op-a'},{'op-a':'title'},'v')).toThrow('explicit mapping');
});
