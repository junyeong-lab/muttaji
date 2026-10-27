import {createSupabaseQuota} from "./supabase-quota.js";
import {readFileSync} from "node:fs";
import {createOpenAI} from "@ai-sdk/openai";
import {createSdkAdapter} from "../agent/adapters/ai-sdk.js";
import {analyzePrepared} from "../agent/provider-interface.js";
import {AgentError} from "../agent/contracts.js";
import {createImporter} from "../job-url/service.js";
import {validateUrl} from "../job-url/policy.js";
import {createSessions} from "./session.js";
import {createSharedQuota} from "./quota.js";
import {createPublicHandler} from "./handler.js";
const MODEL="gpt-5.6-terra";
const catalog=JSON.parse(readFileSync(new URL("../../data/certifications.json",import.meta.url),"utf8")).certifications.map(x=>({id:String(x.id),name:x.name}));
// Limits the actual outbound JSON before it can reach the model. Request reserves
// $0.25 at reviewed $2/M input, $12/M output pricing; no retries, no tools.
export function cappedOpenAiFetch(fetchImpl=fetch){
 return async(url,options)=>{
  if(typeof options?.body==="string"&&Buffer.byteLength(options.body)>64000)throw new AgentError("PROVIDER_REQUEST_TOO_LARGE",413);
  if(String(url)!=="https://api.openai.com/v1/responses"||options?.method!=="POST"||typeof options.body!=="string"||Buffer.byteLength(options.body)>64000)throw new AgentError("INVALID_PROVIDER_REQUEST",502);
  const body=JSON.parse(options.body);
  if(body.model!==MODEL||body.max_output_tokens!==4096||body.store!==false||body.tools?.length)throw new AgentError("INVALID_PROVIDER_REQUEST",502);
  return fetchImpl(url,{...options,redirect:"error"});
 };
}
export function createPublicRuntime(env,{fetchImpl=fetch,quota:injectedQuota,adapter:injectedAdapter}={}){
 let settings={enabled:false},sessions,quota,adapter;
 try{
  const origin=new URL(env.MUTTAJI_PUBLIC_ORIGIN);
  if(env.VERCEL!=="1"||env.MUTTAJI_PUBLIC_ENABLED!=="true"||env.MUTTAJI_PUBLIC_OWNER_APPROVED!=="true"||origin.protocol!=="https:"||origin.origin!==env.MUTTAJI_PUBLIC_ORIGIN)throw Error();
  sessions=createSessions({secret:env.MUTTAJI_SESSION_SECRET});
  const quotaProvider=env.MUTTAJI_QUOTA_PROVIDER||"supabase";
  if(!["supabase","redis"].includes(quotaProvider))throw Error("INVALID_QUOTA_PROVIDER");
  quota=injectedQuota||(quotaProvider==="supabase"?createSupabaseQuota({url:env.MUTTAJI_SUPABASE_URL,secret:env.MUTTAJI_SUPABASE_SECRET_KEY,namespace:env.MUTTAJI_QUOTA_NAMESPACE||"release1",fetchImpl}):createSharedQuota({url:env.MUTTAJI_QUOTA_REST_URL,token:env.MUTTAJI_QUOTA_REST_TOKEN,budgetMicros:Number(env.MUTTAJI_AI_BUDGET_MICROUSD),totalRequests:Number(env.MUTTAJI_AI_TOTAL_REQUESTS),namespace:env.MUTTAJI_QUOTA_NAMESPACE||"release1",fetchImpl}));
  settings={enabled:true,origin:origin.origin,model:MODEL,certificationLabels:Object.fromEntries(catalog.map(x=>[x.id,x.name]))};
  if(env.OPENAI_API_KEY&&env.MUTTAJI_AI_MODEL===MODEL){
   const openai=createOpenAI({apiKey:env.OPENAI_API_KEY,baseURL:"https://api.openai.com/v1",fetch:cappedOpenAiFetch(fetchImpl)});
   adapter=injectedAdapter||createSdkAdapter({model:openai.responses(MODEL),providerOptions:{openai:{store:false,reasoningEffort:"low",reasoningSummary:null}}});
  }
 }catch{settings={enabled:false};}
 const analyze=async(body,reserve)=>{
  const guarded={async analyze(...args){
   let permission;try{permission=await reserve();}catch{throw new AgentError("QUOTA_UNAVAILABLE",503);}
   if(permission!=="ALLOWED")throw new AgentError(permission,permission==="NOT_INITIALIZED"?503:429);
   return adapter.analyze(...args);
  }};
  return analyzePrepared({request:body.request,requirements:body.requirements,catalog,adapter:guarded,enabled:true,ownerApproved:true,timeoutMs:45000});
 };
 const importer=createImporter();
 return {
  session:createPublicHandler({kind:"session",settings,sessions,quota}),
  model:createPublicHandler({kind:"model",settings:{...settings,enabled:settings.enabled&&Boolean(adapter)},sessions,quota,analyze}),
  url:createPublicHandler({kind:"url",settings:{...settings,enabled:settings.enabled&&env.MUTTAJI_PUBLIC_URL_ENABLED==="true"},sessions,quota,importer:async url=>importer(validateUrl(url).href)})
 };
}
