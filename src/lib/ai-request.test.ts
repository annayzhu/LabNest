import { describe, expect, it } from "vitest";
import { validateAIRequest } from "./ai-request";

describe("explicit AI request boundary", () => {
  const request=(headers:Record<string,string>)=>new Request("http://localhost:3000/api/ai/generate",{method:"POST",headers,body:"{}"});
  it("accepts the browser origin and Host including the published port",()=>{
    expect(validateAIRequest(request({origin:"http://localhost:3001",host:"localhost:3001","content-type":"application/json"}))).toBeUndefined();
  });
  it("blocks foreign, missing and opaque origins and simple text submissions",()=>{
    const cases:Record<string,string>[]=[{origin:"https://foreign.example",host:"localhost:3001","content-type":"application/json"},{host:"localhost:3001","content-type":"application/json"},{origin:"null",host:"localhost:3001","content-type":"application/json"},{origin:"http://localhost:3001",host:"localhost:3001","content-type":"text/plain"}];
    for(const headers of cases) {
      expect(validateAIRequest(request(headers))).toBeDefined();
    }
  });
  it("accepts multipart only when the route asks for it",()=>{
    const multipart={origin:"http://localhost:3001",host:"localhost:3001","content-type":"multipart/form-data; boundary=x"};
    expect(validateAIRequest(request(multipart))).toBeDefined();
    expect(validateAIRequest(request(multipart),"multipart/form-data")).toBeUndefined();
    expect(validateAIRequest(request({...multipart,origin:"https://foreign.example"}),"multipart/form-data")).toBeDefined();
  });
});
