import {
  exportProtocolDocxTemplate,
  exportProtocolExecutionExample,
  exportProtocolSystemsTemplate,
  protocolDocxTemplateFilename,
} from "@/lib/protocol-docx-template";

export async function GET(request:Request) {
  const kind = new URL(request.url).searchParams.get("example");
  const example = kind === "execution";
  const systems = kind === "systems";
  const bytes = systems ? exportProtocolSystemsTemplate() : example ? exportProtocolExecutionExample() : exportProtocolDocxTemplate();

  return new Response(bytes, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${systems ? "LabNest_Protocol_Multi_System_Template_v0.4_Draft.docx" : example?"LabNest_Protocol_Execution_Example_v0.3_Draft.docx":protocolDocxTemplateFilename}"`,
      "Content-Length": String(bytes.byteLength),
      "Cache-Control": "public, max-age=3600",
    },
  });
}
