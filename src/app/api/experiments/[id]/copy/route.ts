import { copyExperiment } from "@/lib/experiment-copy";
import { acceptsRequestOrigin } from "@/lib/request-origin";
export async function POST(request: Request, { params }: { params: Promise<{id:string}> }) {
  if(!acceptsRequestOrigin(request))return Response.json({error:"Origin mismatch"},{status:403});
  try { return Response.json(await copyExperiment((await params).id,await request.json()),{status:201}); }
  catch(error){return Response.json({error:error instanceof Error?error.message:"Copy failed"},{status:409});}
}
