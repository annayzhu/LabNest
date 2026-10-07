import {
  exportProtocolDocxTemplate,
  exportProtocolExecutionExample,
  protocolDocxTemplateFilename,
} from "@/lib/protocol-docx-template";

export async function GET(request:Request) {
  const example=new URL(request.url).searchParams.get("example")==="execution";
  const bytes = example?exportProtocolExecutionExample():exportProtocolDocxTemplate();

  return new Response(bytes, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${example?"LabNest_Protocol_Execution_Example_v0.3_Draft.docx":protocolDocxTemplateFilename}"`,
      "Content-Length": String(bytes.byteLength),
      "Cache-Control": "public, max-age=3600",
    },
  });
}
