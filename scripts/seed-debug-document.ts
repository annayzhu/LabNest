import 'dotenv/config';import {prisma} from '../src/lib/db';import {readFileSync} from 'node:fs';
if(new URL(process.env.DATABASE_URL!).pathname!=='/labnest_stage_a_acceptance')throw Error('Synthetic database only');
async function main(){
const {experimentId}=JSON.parse(readFileSync('docs/stage-20260908/A/run-fixture.json','utf8'));
await prisma.experiment.update({where:{id:experimentId},data:{contentJson:{schemaVersion:1,sections:[{key:'execution',title:'执行记录',blocks:[{id:'authored',type:'text',text:'手写正文必须保留'}]}]},protocolSnapshotJson:{methodMode:'protocol',versions:[{protocolTitle:'合成固定规程',displayVersion:'1.2'}]}}});
await prisma.experimentStep.createMany({data:[{order:1,title:'取样',completed:true,deviationNote:null},{order:2,title:'培养',completed:true,deviationNote:'实际延长 5 分钟'},{order:3,title:'检测',completed:false,deviationNote:null}].map(s=>({...s,experimentId,description:'不应默认重复的完整原始说明',groupTitle:'合成固定规程 · 1.2'}))});await prisma.$disconnect();

}
main().catch(e=>{console.error(e);process.exitCode=1;});
