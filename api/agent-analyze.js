import {AgentError,exactKeys,LIMITS} from "../lib/agent/contracts.js";
import {agentMode} from "../lib/agent/policy.js";
import {analyzeAgent} from "../lib/agent/service.js";
const json=(body,status=200,extra={})=>new Response(JSON.stringify(body),{status,headers:{
  "content-type":"application/json; charset=utf-8","cache-control":"no-store",
  "x-content-type-options":"nosniff",...extra}});
async function readBody(request) {
  const declared=request.headers.get("content-length");
  if(declared!==null && (!/^\d+$/.test(declared)||Number(declared)>LIMITS.bodyBytes))
    throw new AgentError("INPUT_TOO_LARGE",413);
  if(!request.body) throw new AgentError("INVALID_JSON");
  const reader=request.body.getReader();
  const decoder=new TextDecoder("utf-8",{fatal:true});
  let size=0,raw="";
  try {
    while(true) {
      const {done,value}=await reader.read();
      if(done)break;
      size+=value.byteLength;
      if(size>LIMITS.bodyBytes) {await reader.cancel();throw new AgentError("INPUT_TOO_LARGE",413);}
      raw+=decoder.decode(value,{stream:true});
    }
    raw+=decoder.decode();
    return JSON.parse(raw);
  } catch(error) {
    if(error instanceof AgentError)throw error;
    throw new AgentError("INVALID_JSON");
  } finally {reader.releaseLock();}
}
export function createHandler({env=()=>process.env}={}) {
  return async request=>{
    const mode=agentMode(env());
    if(request.method==="GET") return json({mode,enabled:mode==="mock",fixtureOnly:true,
      externalCallsAllowed:false,consentRequired:true});
    if(request.method!=="POST")return json({error:"METHOD_NOT_ALLOWED"},405,{allow:"GET, POST"});
    // Reject before reading data when disabled, even if old AI variables exist.
    if(mode!=="mock")return json({error:"AGENT_DISABLED"},503);
    if(!/^application\/json(?:\s*;|$)/i.test(request.headers.get("content-type")||""))
      return json({error:"INVALID_CONTENT_TYPE"},415);
    const origin=request.headers.get("origin");
    if(origin && origin!==new URL(request.url).origin)return json({error:"ORIGIN_NOT_ALLOWED"},403);
    try {
      const body=await readBody(request);
      if(!exactKeys(body,["consent","input"]))throw new AgentError("INVALID_REQUEST");
      return json(await analyzeAgent({mode,consent:body.consent,input:body.input}));
    } catch(error) {
      // Never return adapter errors, input text, account details or stack traces.
      if(error instanceof AgentError)return json({error:error.code},error.status);
      return json({error:"AGENT_FAILED"},502);
    }
  };
}
export default {fetch:createHandler()};
