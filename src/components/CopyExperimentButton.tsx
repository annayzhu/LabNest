"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { newClientMutationId } from "@/lib/client-mutation-id";
import { Button } from "./ui/Button";
export function CopyExperimentButton({id}:{id:string}) {
  const requestId=useRef<string|null>(null);const [busy,setBusy]=useState(false);const [error,setError]=useState("");const router=useRouter();
  return <span><Button disabled={busy} onClick={async()=>{setBusy(true);setError("");requestId.current??=newClientMutationId();try{const r=await fetch(`/api/experiments/${id}/copy`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({clientMutationId:requestId.current})});const result=await r.json();if(!r.ok)throw new Error(result.error);router.push(`/experiments/${result.id}`);}catch(e){setError(e instanceof Error?e.message:"复制失败");setBusy(false);}}}>{busy?"复制中…":"复制为新实验"}</Button>{error?<span role="alert">{error}</span>:null}</span>;
}
