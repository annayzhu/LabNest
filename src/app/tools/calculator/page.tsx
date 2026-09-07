import { AppShell } from "@/components/AppShell";
import { CalculatorCatalog } from "@/components/calculators/CalculatorCatalog";

export default async function CalculatorPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}) {
  const query=await searchParams;const context=new URLSearchParams();for(const key of ["experimentId","experimentStepId"]){if(typeof query[key]==="string")context.set(key,query[key]);}
  return <AppShell><CalculatorCatalog contextQuery={context.toString()} /></AppShell>;
}
