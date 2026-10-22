"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const source=fs.readFileSync(path.join(__dirname,"../api/analyze.js"),"utf8");
function load(env,modelFetch) {
  const exported=source.replace(/export default \{fetch:handler\};/, "return {fetch:handler,grounded,schema};");
  return new Function("process","Response","fetch","AbortSignal","URL",exported)(
    {env},Response,modelFetch,AbortSignal,URL
  );
}
const host="https://project-muttaji.vercel.app/api/analyze";
function request(method,body,token="test-long-private-token",origin="https://project-muttaji.vercel.app") {
  const headers={"content-type":"application/json","x-ai-access-token":token};
  if(origin)headers.origin=origin;
  return new Request(host,{method,headers,...(method==="POST"?{body:JSON.stringify(body)}:{})});
}
const off={
  AI_ANALYSIS_ENABLED:"false",AI_ANALYSIS_MODEL:"provider/model",
  AI_ANALYSIS_ACCESS_TOKEN:"test-long-private-token",AI_GATEWAY_API_KEY:"test-only"
};
const on={...off,AI_ANALYSIS_ENABLED:"true"};
test("GET reveals disabled status, no user text sent",async()=>{
  const api=load(off,()=>{throw Error("called");});
  const r=await api.fetch(request("GET"));
  assert.equal(r.status,200);
  assert.equal((await r.json()).enabled,false);
});
test("disabled POST cannot call billed gateway",async()=>{
  let calls=0;const api=load(off,()=>{calls++;throw Error("called");});
  const r=await api.fetch(request("POST",{text:"담당업무 로그 분석 및 장애 대응",consent:true}));
  assert.equal(r.status,503);assert.equal(calls,0);
});
test("reject wrong token, cross-origin, missing consent, oversized text",async()=>{
  let calls=0;const api=load(on,()=>{calls++;throw Error("called");});
  const body={text:"담당업무 로그 분석 및 장애 대응",consent:true};
  assert.equal((await api.fetch(request("POST",body,"wrong"))).status,403);
  assert.equal((await api.fetch(request("POST",body,"test-long-private-token","https://evil.example"))).status,403);
  assert.equal((await api.fetch(request("POST",{text:body.text},undefined))).status,400);
  assert.equal((await api.fetch(request("POST",{text:"a".repeat(8100),consent:true}))).status,400);
  assert.equal(calls,0);
});
test("model JSON is validated against exact quote in posting",async()=>{
  let calls=0;
  const completion={
    company:[],department:[
      {text:"ES기술부",evidence:"ES기술부"},
      {text:"없는 팀",evidence:"없는 원문 인용"}],
    role:[],responsibilities:[{text:"보안 솔루션 구축",evidence:"보안 솔루션 구축"}],
    required:[],preferred:[],unresolved:[]
  };
  const api=load(on,async(url,init)=>{
    calls++;
    assert.equal(url,"https://ai-gateway.vercel.sh/v1/chat/completions");
    const body=JSON.parse(init.body);
    assert.equal(body.response_format.type,"json_schema");
    assert.equal(body.response_format.json_schema.strict,true);
    return {ok:true,text:async()=>JSON.stringify({choices:[{message:{content:JSON.stringify(completion)}}]})};
  });
  const response=await api.fetch(request("POST",{text:"ES기술부\n담당업무\n보안 솔루션 구축 및 유지보수",consent:true}));
  assert.equal(response.status,200);
  const output=await response.json();
  assert.equal(output.data.department.length,1);
  assert.equal(output.data.responsibilities.length,1);
  assert.equal(output.needsHumanReview,true);
  assert.equal(calls,1);
});

test("no-inference diagnostic verifies configured model via GET only",async()=>{
  let calls=[];
  const api=load(on,async(url,init)=>{
    calls.push({url,method:init.method});
    return {ok:true,text:async()=>JSON.stringify({data:[{id:"openai/gpt-4o-mini"},{id:"other/model"}]})};
  });
  const r=await api.fetch(request("POST",{diagnose:true}));
  assert.equal(r.status,200);
  const result=await r.json();
  assert.equal(result.diagnostic,"ready");
  assert.equal(result.credentialAccepted,true);
  assert.equal(result.modelListed,false); // the test env intentionally uses provider/model
  assert.equal(calls.length,1);
  assert.equal(calls[0].method,"GET");
  assert.equal(calls[0].url,"https://ai-gateway.vercel.sh/v1/models");
});
test("diagnostic also requires private application access code",async()=>{
  let calls=0;
  const api=load(on,async()=>{calls++;throw Error("unexpected Gateway request")});
  const r=await api.fetch(request("POST",{diagnose:true},"wrong-code"));
  assert.equal(r.status,403);
  assert.equal(calls,0);
});
test("Gateway rejection safely exposes status, never private upstream message",async()=>{
  const api=load(on,async()=>({
    ok:false,status:402,text:async()=>JSON.stringify({
      error:{type:"quota_for_entity_exceeded",message:"PRIVATE ACCOUNT DATA NEVER DISPLAY"}
    })
  }));
  const r=await api.fetch(request("POST",{
    text:"ES기술부 담당업무 엔드포인트 보안솔루션 구축",consent:true
  }));
  assert.equal(r.status,502);
  const out=await r.json();
  assert.equal(out.gatewayStatus,402);
  assert.equal(out.gatewayCode,"quota_for_entity_exceeded");
  assert.equal(JSON.stringify(out).includes("PRIVATE ACCOUNT DATA"),false);
});

test("local-only diagnostic validates auth and never calls upstream",async()=>{
  let calls=0;
  const api=load(on,async()=>{calls++;throw Error("unexpected upstream")});
  const response=await api.fetch(request("POST",{diagnose:"local"}));
  assert.equal(response.status,200);
  const body=await response.json();
  assert.equal(body.diagnostic,"local_ok");
  assert.equal(body.serverConfigured,true);
  assert.equal(calls,0);
});
test("local-only diagnostic rejects invalid password before any upstream",async()=>{
  let calls=0;
  const api=load(on,async()=>{calls++;throw Error("unexpected upstream")});
  const response=await api.fetch(request("POST",{diagnose:"local"},"incorrect"));
  assert.equal(response.status,403);
  assert.equal(calls,0);
});
