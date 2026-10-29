import {validateUrl} from "../job-url/policy.js";
import {abortable} from "../job-url/policy.js";
import {AgentError,exactKeys} from "../agent/contracts.js";
import {ImportError,messages} from "../job-url/errors.js";
import {validateModelBody} from "../agent/posting-classifier.js";
const json=(body,status=200,headers={})=>new Response(JSON.stringify(body),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store","x-content-type-options":"nosniff",...headers}});
async function readJson(req,maxBytes){
 if(!/^application\/json(?:\s*;|$)/i.test(req.headers.get("content-type")||""))throw new AgentError("INVALID_CONTENT_TYPE",415);
 if(Number(req.headers.get("content-length")||0)>maxBytes||!req.body)throw new AgentError("INPUT_TOO_LARGE",413);
 const reader=req.body.getReader(),decoder=new TextDecoder("utf-8",{fatal:true});let bytes=0,raw="";
 const controller=new AbortController();const stop=setTimeout(()=>controller.abort(),5000);
 try{while(true){const {done,value}=await abortable(reader.read(),controller.signal);if(done)break;bytes+=value.length;if(bytes>maxBytes)throw new AgentError("INPUT_TOO_LARGE",413);raw+=decoder.decode(value,{stream:true});}return JSON.parse(raw+decoder.decode());}
 catch(e){void reader.cancel().catch(()=>{});if(e instanceof AgentError)throw e;throw new AgentError("INVALID_INPUT");}finally{clearTimeout(stop);reader.releaseLock();}
}
// Diagnostic metadata only: never log the posting, user profile, keys, or provider text.
export function safeModelDiagnostic(error){
 if(!(error instanceof AgentError))return null;
 const code=String(error.code||"");
 if(!/^(INVALID_AGENT_OUTPUT|PROVIDER_[A-Z_]+|ADAPTER_TIMEOUT|ADAPTER_FAILED|QUOTA_UNAVAILABLE)$/.test(code))return null;
 const raw=error.validation||{};
 const reason=typeof raw.reason==="string"&&/^POSTING_[A-Z_]{1,50}$/.test(raw.reason)?raw.reason:null;
 const itemIndex=Number.isInteger(raw.itemIndex)&&raw.itemIndex>=0&&raw.itemIndex<=60?raw.itemIndex:null;
 const missingLineCount=Array.isArray(raw.missingLines)?Math.min(400,raw.missingLines.length):0;
 return {code,...(reason?{reason}:{}),...(itemIndex!==null?{itemIndex}:{}),...(missingLineCount?{missingLineCount}:{})};
}
export function createPublicHandler({kind,settings,sessions,quota,analyze,importer}){
 return async req=>{
  if(!settings.enabled||!sessions||quota?.scope!=="shared")return req.method==="GET"?json({enabled:false,localOnly:false,requiresAccessCode:false,mode:"disabled"}):json({error:"SERVICE_DISABLED",message:"현재 기능을 사용할 수 없습니다. 직접 입력과 기존 비교는 계속 사용할 수 있습니다."},503);
  if(new URL(req.url).origin!==settings.origin)return json({error:"ORIGIN_NOT_ALLOWED"},403);
  if(req.method==="GET"){
   if(kind!=="session")return json({enabled:true,localOnly:false,requiresAccessCode:false,mode:"public",provider:"OpenAI",model:settings.model,reviewRequired:true});
   const established=sessions.establish(req);
   return json({enabled:true,localOnly:false,requiresAccessCode:false,mode:"public",provider:"OpenAI",model:settings.model,csrfToken:established.csrfToken,reviewRequired:true},200,{"set-cookie":established.cookie});
  }
  if(kind==="session"||req.method!=="POST")return json({error:"METHOD_NOT_ALLOWED"},405);
  if(req.headers.get("origin")!==settings.origin||req.headers.get("sec-fetch-site")==="cross-site")return json({error:"ORIGIN_NOT_ALLOWED"},403);
  const session=sessions.authorize(req),subject=sessions.subject(req);
  if(!session||!subject)return json({error:"SESSION_REQUIRED",message:"새로고침 후 다시 이용해 주세요."},403);
  try{
   const body=await readJson(req,kind==="model"?32000:6000);
   if(kind==="model"){
    validateModelBody(body);
    // The injected analyze path validates consent and input before the reservation.
    return json({data:await analyze(body,async()=>quota.reserve({kind,subject,session})),certificationLabels:settings.certificationLabels});
   }
   if(!exactKeys(body,["url"])||typeof body.url!=="string")throw new AgentError("INVALID_INPUT");
   validateUrl(body.url);
   const permission=await quota.reserve({kind,subject,session});
   if(permission!=="ALLOWED")return json({error:permission,message:permission==="RATE_LIMITED"?"짧은 시간에 요청이 많습니다. 1분 후 다시 시도해 주세요. 직접 붙여넣기도 가능합니다.":"URL 수집이 현재 제한되었습니다. 직접 붙여넣기를 사용할 수 있습니다."},429);
   return json({mode:"public",aiEnabled:false,data:await importer(body.url)});
  }catch(error){
   if(kind==="model"){
    const diagnostic=safeModelDiagnostic(error);
    if(diagnostic)console.warn("MUTTAJI_AI_DIAGNOSTIC",JSON.stringify(diagnostic));
   }
   if(error instanceof AgentError||error instanceof ImportError)return json({error:error.code,validation:error.validation||null,message:kind==="url"?(messages[error.code]||"공고 수집에 실패했습니다. 직접 붙여넣기를 사용할 수 있습니다."):undefined},error.status);
   return json({error:"SERVICE_UNAVAILABLE",message:"서버의 이용 제한 상태를 확인할 수 없어 요청을 중단했습니다."},503);
  }
 };
}
