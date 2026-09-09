import 'dotenv/config';import {prisma} from '../src/lib/db';import {readFileSync} from 'node:fs';import {createEmptyProtocolDocument} from '../src/lib/protocol-document';
async function main(){
if(new URL(process.env.DATABASE_URL!).pathname!=='/labnest_stage_a_acceptance')throw Error('Synthetic database only');
const {experimentId}=JSON.parse(readFileSync('docs/debug-20260909/evidence/run-fixture.json','utf8'));
const d=createEmptyProtocolDocument();d.sections.find(s=>s.key==='consumption_rules')!.blocks=[{id:'rule',type:'table',rows:[['Material','Formula','Unit'],['Synthetic mix','sample_count * reaction_volume','µL']]}];
await prisma.experiment.update({where:{id:experimentId},data:{protocolSnapshotJson:{methodMode:'protocol',versions:[{protocolVersionId:'synthetic-rule-v1',protocolTitle:'合成固定规程',displayVersion:'1.2',contentJson:d}]}}});await prisma.$disconnect();
}main().catch(e=>{console.error(e);process.exitCode=1;});
