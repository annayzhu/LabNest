import 'dotenv/config';
import {prisma} from '../src/lib/db';
const url=new URL(process.env.DATABASE_URL!);if(url.pathname!=='/labnest_calculator_acceptance_20260906')throw Error('Isolated database required');
async function main(){await prisma.project.upsert({where:{id:'calculator-v12-project'},update:{},create:{id:'calculator-v12-project',name:'Calculator synthetic project'}});await prisma.researchPlan.upsert({where:{id:'calculator-v12-plan'},update:{},create:{id:'calculator-v12-plan',projectId:'calculator-v12-project',code:'CALC-V12-PLAN',title:'Synthetic run acceptance'}});await prisma.$disconnect();}
main();
