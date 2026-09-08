import 'dotenv/config';import {writeFileSync} from 'node:fs';
import {prisma} from '../src/lib/db';
if(new URL(process.env.DATABASE_URL!).pathname!=='/labnest_stage_a_acceptance')throw new Error('Only isolated acceptance database is allowed');
async function main(){
const experiment=await prisma.experiment.create({data:{runCode:'SYN-'+Date.now(),title:'Synthetic mixed materials '+Date.now(),status:'running'}});
const stock=await prisma.inventoryItem.create({data:{name:'Synthetic precise buffer',currentQuantity:100,unit:'mL'}});
writeFileSync('docs/stage-20260908/A/run-fixture.json',JSON.stringify({experimentId:experiment.id,inventoryItemId:stock.id}));await prisma.$disconnect();

}
main().catch(error=>{console.error(error);process.exitCode=1;});
