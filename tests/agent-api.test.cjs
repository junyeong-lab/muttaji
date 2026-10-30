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
