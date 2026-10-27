// In-process request/response example: no HTTP listener or network requests.
import assert from "node:assert/strict";
import {createHandler} from "../api/agent-analyze.js";
import {mockExample} from "../lib/agent/adapters/mock.js";
const originalFetch=globalThis.fetch;
globalThis.fetch=()=>{throw Error("Network is disabled in this demo");};
try {
  // Only this handler instance uses mock mode; no process env is changed.
  const handler=createHandler({env:()=>({MUTTAJI_AGENT_MODE:"mock"})});
  const response=await handler(new Request("http://localhost/api/agent-analyze",{
    method:"POST",headers:{"content-type":"application/json",origin:"http://localhost"},
    body:JSON.stringify({consent:true,input:mockExample()})
  }));
  assert.equal(response.status,200);
  console.log(JSON.stringify(await response.json(),null,2));
} finally {globalThis.fetch=originalFetch;}
