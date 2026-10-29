import {validateUrl,resolvePublic,abortable,LIMITS} from "./policy.js";
import {pinnedRequest} from "./network.js";
import {checkRobots} from "./robots.js";
import {extractPosting} from "./extract.js";
import {ImportError} from "./errors.js";
export function createImporter({resolver,transport=pinnedRequest,timeoutMs=LIMITS.timeoutMs}={}){
 return async value=>{
  let url=validateUrl(value);
  // The relay shell advertises this public canonical page for the same posting.
  // Preserve only its numeric identity, not tracking parameters or arbitrary targets.
  if(url.hostname==="www.saramin.co.kr"&&url.pathname==="/zf_user/jobs/relay/view"){
   const ids=url.searchParams.getAll("rec_idx");
   if(ids.length!==1||!/^\d{1,12}$/.test(ids[0]))throw new ImportError("UNSAFE_URL");
   url=validateUrl("https://www.saramin.co.kr/zf_user/jobs/view?rec_idx="+ids[0]);
  }
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),timeoutMs);const signal=controller.signal;
  const policies=new Map();
  const request=async(target,kind)=>{
   const resolved=await resolvePublic(target,signal,resolver);
   const options={signal,maxBytes:kind==="robots"?LIMITS.robotsBytes:LIMITS.bytes,kind};
   try{return await abortable(transport(target,resolved,options),signal);}
   catch(error){
    // GET request bodies can fail abruptly on external job boards. A single
    // retry of the SAME vetted endpoint is safe only after robots verification
    // and only for an actual transport failure, within the existing time cap.
    // Never retry robots, DNS/policy errors, 403/429, invalid HTML or timeouts.
    if(kind!=="html" || signal.aborted || !(error instanceof ImportError) || error.code!=="FETCH_FAILED")throw error;
    return abortable(transport(target,resolved,options),signal);
   }
  };
  try{
   for(let hop=0;hop<=LIMITS.redirects;hop++){
    if(!policies.has(url.origin)){
     const robots=await request(new URL("/robots.txt",url),"robots");
     if(robots.status===200)policies.set(url.origin,robots.body);
     else if(robots.status===404||robots.status===410)policies.set(url.origin,"");
     else throw new ImportError("ROBOTS_UNAVAILABLE");
    }
    checkRobots(policies.get(url.origin),url);
    if(/\/(?:login|signin|sign-in)(?:\/|$)/i.test(url.pathname))throw new ImportError("LOGIN_REQUIRED");
    const response=await request(url,"html");
    if([301,302,303,307,308].includes(response.status)){
     if(hop===LIMITS.redirects)throw new ImportError("TOO_MANY_REDIRECTS");
     if(!response.headers.location)throw new ImportError("REMOTE_ERROR");
     url=validateUrl(new URL(response.headers.location,url).href);continue;
    }
    if(response.status===401)throw new ImportError("LOGIN_REQUIRED");
    if([403,429,451].includes(response.status))throw new ImportError("REMOTE_BLOCKED");
    if(response.status!==200)throw new ImportError("REMOTE_ERROR");
    // Only this validated JobKorea posting path may recover from a missing shell body.
    // Authentication, bot, ambiguity, size and policy failures still stop immediately.
    const match=url.hostname==="www.jobkorea.co.kr"&&url.pathname.match(/^\/Recruit\/GI_Read\/(\d+)$/i);
    let result;
    try{result=extractPosting(response.body,url.href,{allowMetadataOnly:Boolean(match)});}
    catch(error){
     if(!match||!(error instanceof ImportError)||!["NO_POSTING","PARTIAL_POSTING"].includes(error.code))throw error;
    }
    if(match){
     const detailUrl=validateUrl("https://www.jobkorea.co.kr/Recruit/GI_Read_Comt_Ifrm?Gno="+match[1]+"&isHiringCenter=false&hideMapView=false");
     checkRobots(policies.get(url.origin),detailUrl);
     const detailResponse=await request(detailUrl,"html");
     if(detailResponse.status===401)throw new ImportError("LOGIN_REQUIRED");
     // Fixed detail requests never follow redirects or arbitrary iframe targets.
     if(detailResponse.status!==200)throw new ImportError([403,429,451].includes(detailResponse.status)?"REMOTE_BLOCKED":"REMOTE_ERROR");
     const detail=extractPosting(detailResponse.body,detailUrl.href);
     if(detail.contentStatus!=="body")throw new ImportError("PARTIAL_POSTING");
     const shellText=result?.text||"";
     // Drop identical complete paragraphs, not individual repeated requirement lines.
     // Repeated duties under different roles therefore keep their context.
     const text=shellText.includes(detail.text)?shellText:
      [...shellText.split(/\n\n+/).filter(chunk=>chunk&&!detail.text.includes(chunk)),detail.text].join("\n\n");
     if(text.length>20000||text.split("\n").length>400)throw new ImportError("EXTRACT_TOO_LONG");
     const fields=Object.fromEntries(Object.keys(detail.fields).map(key=>{
      const entries=[...result?.fields[key]||[],...detail.fields[key]];
      return [key,[...new Map(entries.map(entry=>[entry.value,entry])).values()]];
     }));
     result={...detail,sourceUrl:url.href,fields,text,method:"jobkorea-public-detail",contentStatus:detail.contentStatus,
      analysisInput:{...detail.analysisInput,postingText:text,source:{...detail.analysisInput.source,url:url.href,method:"jobkorea-public-detail"}}};
    }
    return result;
   }
  }catch(error){
   if(error instanceof ImportError)throw error;
   throw new ImportError(signal.aborted?"TIMEOUT":"FETCH_FAILED",signal.aborted?504:422);
  }finally{clearTimeout(timer);controller.abort();}
 };
}