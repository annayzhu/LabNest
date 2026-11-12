import { AppShell } from "@/components/AppShell";
import { CalculatorCatalog } from "@/components/calculators/CalculatorCatalog";
import { CalculatorCatalogRecord } from "@/components/calculators/CalculatorCatalogRecord";

export default async function CalculatorPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}) {
  const query=await searchParams;const context=new URLSearchParams();for(const key of ["experimentId","experimentStepId","contextLabel"]){if(typeof query[key]==="string")context.set(key,query[key]);}
  if(query.embed==="record")return <CalculatorCatalogRecord contextQuery={`embed=record&locale=${query.locale==="en"?"en":"zh"}`} />;
  return <AppShell><CalculatorCatalog contextQuery={context.toString()} /></AppShell>;
}
