"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const modules=Promise.all([import("../api/agent-analyze.js"),import("../lib/agent/adapters/mock.js")]);
const host="http://localhost/api/agent-analyze";
const request=(body,options={})=>new Request(host,{method:"POST",
  headers:{"content-type":"application/json",origin:"http://localhost",...options.headers},
  body:JSON.stringify(body),...options});
test("API defaults to disabled, ignores old AI credentials and cannot enable live",async()=>{
  const [{createHandler},{mockExample}]=await modules;
  for(const env of [{},{MUTTAJI_AGENT_MODE:"live"},{MUTTAJI_AGENT_MODE:"MOCK"},
    {AI_ANALYSIS_ENABLED:"true",AI_GATEWAY_API_KEY:"never-used",AI_ANALYSIS_MODEL:"provider/model"}]) {
    const handler=createHandler({env:()=>env});
    const status=await handler(new Request(host));
    assert.equal((await status.json()).enabled,false);
    assert.equal((await handler(request({consent:true,input:mockExample()}))).status,503);
  }
});
test("mock API roundtrip performs no network calls, logs or persistence and returns only synthetic data",async()=>{
  const [{createHandler},{mockExample}]=await modules;
  const handler=createHandler({env:()=>({MUTTAJI_AGENT_MODE:"mock"})});
  const originalFetch=globalThis.fetch;
  const originalLog=console.log,originalError=console.error;
  let calls=0,logs=0;
  globalThis.fetch=()=>{calls++;throw Error("Network forbidden");};
  console.log=console.error=()=>{logs++;};
  try {
    const get=await handler(new Request(host));
    assert.equal((await get.json()).externalCallsAllowed,false);
    const response=await handler(request({consent:true,input:mockExample("request-2")}));
    assert.equal(response.status,200);
    assert.equal(response.headers.get("cache-control"),"no-store");
    assert.equal(response.headers.has("set-cookie"),false);
    const result=await response.json();
    assert.equal(result.revision,"request-2");
    assert.equal(result.mode,"mock");
    assert.equal(result.requirements.length,3);
    assert.equal(calls,0);assert.equal(logs,0);
  } finally {globalThis.fetch=originalFetch;console.log=originalLog;console.error=originalError;}
});
test("rejects missing consent, real profiles, request mode overrides and unexpected fields",async()=>{
  const [{createHandler},{mockExample}]=await modules;
  const handler=createHandler({env:()=>({MUTTAJI_AGENT_MODE:"mock"})});
  assert.equal((await handler(request({consent:false,input:mockExample()}))).status,400);
  const input=mockExample();input.profile.experience="PRIVATE_PROFILE_NEVER_ECHO";
  const response=await handler(request({consent:true,input}));
  assert.equal(response.status,422);
  assert.equal((await response.text()).includes("PRIVATE_PROFILE"),false);
  assert.equal((await handler(request({consent:true,input:mockExample(),mode:"live"}))).status,400);
});
test("rejects invalid JSON, content type, cross origin and unsupported methods",async()=>{
  const [{createHandler},{mockExample}]=await modules;
  const handler=createHandler({env:()=>({MUTTAJI_AGENT_MODE:"mock"})});
  const body={consent:true,input:mockExample()};
  assert.equal((await handler(request(body,{headers:{"content-type":"text/plain"}}))).status,415);
  assert.equal((await handler(request(body,{headers:{"content-type":"application/json",origin:"https://evil.example"}}))).status,403);
  assert.equal((await handler(new Request(host,{method:"POST",headers:{"content-type":"application/json"},body:"{"}))).status,400);
  const method=await handler(new Request(host,{method:"DELETE"}));
  assert.equal(method.status,405);assert.equal(method.headers.get("allow"),"GET, POST");
});
test("enforces byte limit even without Content-Length, for Unicode and chunked requests",async()=>{
  const [{createHandler}]=await modules;
  const handler=createHandler({env:()=>({MUTTAJI_AGENT_MODE:"mock"})});
  assert.equal((await handler(new Request(host,{method:"POST",headers:{"content-type":"application/json"},body:"가".repeat(22000)}))).status,413);
  let cancelled=false;
  const stream=new ReadableStream({pull(controller){controller.enqueue(new Uint8Array(33000));},cancel(){cancelled=true;}});
  const response=await handler(new Request(host,{method:"POST",headers:{"content-type":"application/json"},body:stream,duplex:"half"}));
  assert.equal(response.status,413);assert.equal(cancelled,true);
  assert.equal((await handler(new Request(host,{method:"POST",headers:{"content-type":"application/json","content-length":"999999"},body:"{}"}))).status,413);
});
