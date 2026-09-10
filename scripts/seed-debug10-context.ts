import { prisma } from '../src/lib/db';
async function main(){
if(!process.env.DATABASE_URL?.includes('/labnest_debug_20260910'))throw new Error('Synthetic database required');
const project=await prisma.project.create({data:{name:'Sep10 synthetic project'}});
await prisma.researchPlan.create({data:{projectId:project.id,code:`DEBUG10-${Date.now()}`,title:'Sep10 synthetic plan'}});
await prisma.$disconnect();

}
main().catch(error=>{console.error(error);process.exitCode=1});
