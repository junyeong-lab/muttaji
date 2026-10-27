import {timingSafeEqual,createHash} from "node:crypto";
import {ImportError,messages} from "./errors.js";
import {LIMITS,abortable} from "./policy.js";
import {createImporter} from "./service.js";
export function processLimiter({limit=5,windowMs=60000,clock=Date.now}={}){
 const slots=new Map();
 return {scope:"process",async take(key){
  const now=clock();for(const [k,v] of slots)if(v.until<=now)slots.delete(k);
  const bucket=slots.get(key)||{count:0,until:now+windowMs};
  if(bucket.count>=limit)return false;bucket.count++;slots.set(key,bucket);return true;
 }};
}
const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store","x-content-type-options":"nosniff"}});
const same=(left,right)=>typeof left==="string"&&typeof right==="string"&&left.length<512&&timingSafeEqual(createHash("sha256").update(left).digest(),createHash("sha256").update(right).digest());
export function createImportHandler({config=()=>({mode:"disabled"}),importer=createImporter(),limiter=processLimiter()}={}){
 return async request=>{
  const settings=config();
  const configured=["mock","live","local"].includes(settings.mode)&&typeof settings.token==="string"&&settings.token.length>=10;
  // Process memory is only a local/mock guard. Public live mode requires an
  // injected shared limiter and an explicit server-side rollout approval.
  const liveReady=settings.mode==="local"?settings.ownerApproved===true:settings.mode!=="live"||(settings.ownerApproved===true&&limiter.scope==="shared");
  const enabled=configured&&liveReady;
  if(request.method==="GET")return json({enabled,mode:enabled?settings.mode:"disabled",aiEnabled:false,requiresAccessCode:true,reviewRequired:true});
  if(request.method!=="POST")return json({error:"METHOD_NOT_ALLOWED"},405);
  const fail=code=>json({error:code,message:messages[code]||messages.INVALID_REQUEST,fallback:"채용공고 텍스트를 직접 복사해 기존 입력창에 붙여넣어 주세요."},code==="ACCESS_DENIED"?403:503);
  if(!configured)return fail("IMPORT_DISABLED");
  if(!liveReady)return fail("SHARED_LIMITER_REQUIRED");
  const origin=request.headers.get("origin");
  if(origin&&origin!==new URL(request.url).origin)return json({error:"ORIGIN_DENIED",message:messages.ORIGIN_DENIED},403);
  if(!same(request.headers.get("x-job-import-token"),settings.token))return fail("ACCESS_DENIED");
  const key=createHash("sha256").update(settings.token).digest("hex");
  let allowed;try{allowed=await limiter.take(key);}catch{return fail("IMPORT_DISABLED");}
  if(!allowed)return json({error:"RATE_LIMITED",message:messages.RATE_LIMITED},429);
  try{
   if(!/^application\/json(?:\s*;|$)/i.test(request.headers.get("content-type")||""))throw new ImportError("INVALID_REQUEST",415);
   const declared=Number(request.headers.get("content-length")||0);if(declared>LIMITS.inputBytes)throw new ImportError("INVALID_REQUEST",413);
   if(!request.body)throw new ImportError("INVALID_REQUEST",400);
   const reader=request.body.getReader();let raw="",count=0;const decoder=new TextDecoder("utf-8",{fatal:true});
   const bodyTimer=new AbortController();const stop=setTimeout(()=>bodyTimer.abort(),2000);
   try{while(true){const {done,value}=await abortable(reader.read(),bodyTimer.signal);if(done)break;count+=value.byteLength;if(count>LIMITS.inputBytes){void reader.cancel().catch(()=>{});throw new ImportError("INVALID_REQUEST",413);}raw+=decoder.decode(value,{stream:true});}raw+=decoder.decode();}
   catch(error){void reader.cancel().catch(()=>{});if(error instanceof ImportError)throw error;throw new ImportError("INVALID_REQUEST",400);}
   finally{clearTimeout(stop);reader.releaseLock();}
   let body;try{body=JSON.parse(raw);}catch{throw new ImportError("INVALID_REQUEST",400);}
   if(!body||typeof body!=="object"||Array.isArray(body)||Object.keys(body).length!==1||typeof body.url!=="string")throw new ImportError("INVALID_REQUEST",400);
   return json({mode:settings.mode,aiEnabled:false,data:await importer(body.url)});
  }catch(error){
   const code=error instanceof ImportError?error.code:"FETCH_FAILED",status=error instanceof ImportError?error.status:422;
   return json({error:code,message:messages[code]||messages.FETCH_FAILED,fallback:"채용공고 텍스트를 직접 복사해 기존 입력창에 붙여넣어 주세요."},status);
  }
 };
}