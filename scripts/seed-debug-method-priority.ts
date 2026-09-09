import 'dotenv/config';import {prisma} from '../src/lib/db';import {readFileSync} from 'node:fs';
if(new URL(process.env.DATABASE_URL!).pathname!=='/labnest_stage_a_acceptance')throw Error('Synthetic only');
const f=JSON.parse(readFileSync('docs/debug-20260909/evidence/font-fixtures.json','utf8'));
prisma.researchPlanProtocol.upsert({where:{researchPlanId_protocolId:{researchPlanId:f.planId,protocolId:f.protocolId}},create:{researchPlanId:f.planId,protocolId:f.protocolId},update:{}}).finally(()=>prisma.$disconnect());
