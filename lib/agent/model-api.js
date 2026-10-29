import {createHash,timingSafeEqual} from "node:crypto";
import {analyzePrepared} from "./provider-interface.js";
import {AgentError,exactKeys} from "./contracts.js";
import {validateModelBody,classifyPosting} from "./posting-classifier.js";
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store","x-content-type-options":"nosniff"}});
const hash=s=>createHash("sha256").update(s).digest();
// Local lifetime cap counts failed calls too; restart resets it. Never public.
export function createModelHandler({config=()=>({enabled:false}),adapter,catalog=[],maxCalls=3}={}){
 let calls=0,busy=false,lastError=null,lastValidation=null;const cap=Math.max(0,Math.min(3,Number.isInteger(maxCalls)?maxCalls:0));
 return async req=>{
  const settings=config();const enabled=settings.enabled===true&&Boolean(adapter)&&typeof settings.token==="string"&&settings.token.length>=16;
  if(req.method==="GET")return json({enabled,provider:enabled?"OpenAI":null,model:enabled?settings.model:null,remaining:enabled?Math.max(0,cap-calls):0,localOnly:true,lastError,lastValidation});
  if(req.method!=="POST")return json({error:"METHOD_NOT_ALLOWED"},405);
  if(!enabled)return json({error:"AGENT_DISABLED"},503);
  if(req.headers.get("origin")!==new URL(req.url).origin)return json({error:"ORIGIN_NOT_ALLOWED"},403);
  const token=req.headers.get("x-agent-access-code")||"";
  if(token.length>512||!timingSafeEqual(hash(token),hash(settings.token)))return json({error:"ACCESS_DENIED"},403);
  if(busy||calls>=cap)return json({error:busy?"ANALYSIS_BUSY":"TEST_LIMIT_REACHED"},429);
  if(!/^application\/json(?:\s*;|$)/i.test(req.headers.get("content-type")||""))return json({error:"INVALID_CONTENT_TYPE"},415);
  try{
   const bytes=await req.arrayBuffer();if(bytes.byteLength>32000)throw new AgentError("INPUT_TOO_LARGE",413);
   const body=JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(bytes));
   validateModelBody(body);
   if(busy||calls>=cap)return json({error:busy?"ANALYSIS_BUSY":"TEST_LIMIT_REACHED"},429);
   busy=true;lastError=null;lastValidation=null;
   const guarded={analyze:async(...args)=>{calls++;return adapter.analyze(...args);},classify:typeof adapter.classify==="function"?async(...args)=>{calls++;return adapter.classify(...args);}:undefined};
   try{return json({data:body.task==="classify-posting"?await classifyPosting({request:body.request,adapter:guarded,enabled:true,ownerApproved:true}):await analyzePrepared({request:body.request,requirements:body.requirements,catalog,adapter:guarded,enabled:true,ownerApproved:true,timeoutMs:45000}),certificationLabels:Object.fromEntries(catalog.map(x=>[x.id,x.name]))});}
   finally{busy=false;}
  }catch(e){lastError=e instanceof AgentError?e.code:"ANALYSIS_FAILED";lastValidation=e instanceof AgentError&&e.code==="INVALID_AGENT_OUTPUT"?e.validation||null:null;return json({error:lastError,validation:lastValidation},e instanceof AgentError?e.status:502);}
 };
}
