import {prisma} from '@/lib/db';
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}) {
 const {id}=await params;
 const experiment=await prisma.experiment.findUnique({where:{id},include:{steps:{orderBy:[{groupOrder:'asc'},{order:'asc'}]},protocolRun:true}});
 return experiment?Response.json({experiment},{headers:{'Cache-Control':'no-store'}}):Response.json({error:'Experiment not found'},{status:404});
}
