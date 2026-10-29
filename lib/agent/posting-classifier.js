import {AgentError,exactKeys} from "./contracts.js";
import {validateUrl} from "../job-url/policy.js";
import {locations} from "./semantic-analysis.js";
import {POSTING_CATEGORIES,POSTING_INSTRUCTIONS} from "./posting-schema.js";
import {providerCodes} from "./provider-errors.js";
const string=(s,max=1500)=>typeof s==="string"&&s.trim().length>0&&s.length<=max;
const optional=(s,max=400)=>s===""||string(s,max);
export function validatePostingRequest(request){
 if(!exactKeys(request,["schemaVersion","revision","posting","source","consent"])||request.schemaVersion!==1||typeof request.revision!=="string"||!/^[\w-]{1,64}$/.test(request.revision)||typeof request.posting!=="string"||!request.posting.trim()||request.posting.length>20000||request.posting.split(/\r\n|\r|\n/).length>400)throw new AgentError("INVALID_INPUT");
 if(!exactKeys(request.consent,["externalAi"])||request.consent.externalAi!==true)throw new AgentError("CONSENT_REQUIRED");
 if(!["manual","url"].includes(request.source?.type))throw new AgentError("INVALID_INPUT");
 if(request.source.type==="url"){
  if(request.source.reviewed!==true)throw new AgentError("IMPORT_REVIEW_REQUIRED");
  try{validateUrl(request.source.url);}catch{throw new AgentError("INVALID_INPUT");}
 }
 return structuredClone(request);
}
export function validateModelBody(body){
 if(body?.task==="classify-posting"){
  if(!exactKeys(body,["task","request"]))throw new AgentError("INVALID_INPUT");
  validatePostingRequest(body.request);return;
 }
 if(!exactKeys(body,["request","requirements"])||JSON.stringify(body.request)?.length>24000||!Array.isArray(body.requirements)||!body.requirements.length||body.requirements.length>20)throw new AgentError("INVALID_INPUT");
}
function fail(reason,itemIndex=null,missingLines=[]){const e=new AgentError("INVALID_AGENT_OUTPUT",502);e.validation={reason,itemIndex,...(missingLines.length?{missingLines}: {})};throw e;}
const column=s=>s.trim().replace(/[\s\[\]：:]/g,"");
// A table header alone cannot turn duty text into eligibility, but an explicitly\n// required qualification inside that table must remain eligible for review.\nfunction isTableHeading(lines,quote){
 const columns=new Set(["모집분야","모집부문","담당업무","자격요건","모집인원"]);
 return lines.some((s,i)=>s.trim()===quote.trim()&&lines.slice(Math.max(0,i-3),i+4).filter(x=>columns.has(column(x))).length>=3);
}
export function validatePostingClassification(value,request){
 const lines=request.posting.split(/\r\n|\r|\n/),covered=new Set(),seen=new Set();
 if(!exactKeys(value,["schemaVersion","revision","mode","complete","items","referenceRanges"])||value.schemaVersion!==1||value.revision!==request.revision||value.mode!=="posting-classification"||typeof value.complete!=="boolean"||!Array.isArray(value.items)||!value.items.length||value.items.length>60||!Array.isArray(value.referenceRanges)||value.referenceRanges.length>60)fail("POSTING_FORMAT");
 const range=(item,index)=>{
  if(!Number.isInteger(item.line)||!Number.isInteger(item.endLine)||item.line<1||item.endLine<item.line||item.endLine>lines.length)fail("POSTING_POSITION",index);
  return lines.slice(item.line-1,item.endLine).join("\n");
 };
 const items=value.items.map((item,index)=>{
  if(!exactKeys(item,["id","category","quote","line","endLine","reason","basisQuote","roleQuote","applicantType","applicantQuote","relation","uncertainty"])||!string(item.id,300)||seen.has(item.id)||!POSTING_CATEGORIES.includes(item.category)||!string(item.quote)||!string(item.reason,300)||!["common","new","experienced","unclear"].includes(item.applicantType)||!["single","and","or","mixed","unclear"].includes(item.relation)||!optional(item.uncertainty,300))fail("POSTING_ITEM_FORMAT",index);
  seen.add(item.id);const block=range(item,index);
  // Positions are computed from exact source; CRLF is never normalized in storage.
  const refs=locations(request.posting,item.quote).filter(r=>r.line===item.line&&r.endLine===item.endLine);
  if(!block.replaceAll("\r\n","\n").includes(item.quote.replaceAll("\r\n","\n"))||refs.length!==1)fail("POSTING_QUOTE",index);
  for(const q of [item.basisQuote,item.roleQuote,item.applicantQuote])if(!optional(q)||q&&!request.posting.includes(q))fail("POSTING_SCOPE_QUOTE",index);
  for(const q of [item.basisQuote,item.roleQuote,item.applicantQuote])if(q&&!locations(request.posting,q).some(r=>r.start<=refs[0].end))fail("POSTING_SCOPE_QUOTE",index);
  if(item.applicantType!=="unclear"&&!item.applicantQuote)fail("POSTING_SCOPE_QUOTE",index);
  if(item.applicantType==="new"&&!/신입|신규|entry|new/i.test(item.applicantQuote)||item.applicantType==="experienced"&&!/경력|experienced/i.test(item.applicantQuote))fail("POSTING_APPLICANT_SCOPE",index);
  if(item.applicantType==="common"&&!/공통|신입.*경력|경력.*신입|무관/.test(item.applicantQuote))fail("POSTING_APPLICANT_SCOPE",index);
  if(["new","experienced"].includes(item.applicantType)&&/신입.*경력|경력.*신입/.test(item.applicantQuote)&&!/경력\s*만\s*해당|경력의\s*경우/.test(item.applicantQuote))fail("POSTING_APPLICANT_SCOPE",index);
  if(/경력\s*만\s*해당|경력의\s*경우/.test(item.quote)&&item.applicantType!=="experienced")fail("POSTING_APPLICANT_SCOPE",index);
  if(item.category==="unresolved"&&!item.uncertainty)fail("POSTING_UNCERTAINTY",index);
  if(["required","preferred"].includes(item.category)){
   if(!item.basisQuote)fail("POSTING_OBLIGATION",index);
   if(item.category==="required"&&(/필수(?:가|는)?\s*아|필요(?:가|는)?\s*없/.test(item.quote+item.basisQuote)||/우대|preferred/i.test(item.basisQuote)||!/(?:필수|지원\s*자격|자격\s*요건|지원\s*요건|required|requirements)/i.test(item.basisQuote)||(isTableHeading(lines,item.basisQuote)&&!/(?:필수|반드시|\brequired\b)/i.test(item.quote))))fail("POSTING_OBLIGATION",index);
   if(item.category==="preferred"&&!/우대|preferred/i.test(item.basisQuote))fail("POSTING_OBLIGATION",index);
   if(item.category==="required"&&/신입\s*지원\s*가능/.test(request.posting)&&/\d+\s*(?:[~～-]\s*\d+\s*)?년.*경력|경력.*\d+\s*년/.test(item.quote)&&!/경력\s*만\s*해당|경력의\s*경우|\[경력\]|\(경력\)|경력자/.test(item.applicantQuote)&&!item.uncertainty)fail("POSTING_UNCERTAINTY",index);
   if(["모집인원","모집분야","담당업무","자격요건"].includes(column(item.quote))||/^\s*[○0-9]+\s*명\s*$/.test(item.quote))fail("POSTING_METADATA_AS_CONDITION",index);
  }
  for(let n=item.line;n<=item.endLine;n++)covered.add(n);
  return {...structuredClone(item),location:refs[0],scopeEvidence:{basis: item.basisQuote?locations(request.posting,item.basisQuote):[],role:item.roleQuote?locations(request.posting,item.roleQuote):[],applicant:item.applicantQuote?locations(request.posting,item.applicantQuote):[]}};
 });
 const references=value.referenceRanges.map((ref,index)=>{
  if(!exactKeys(ref,["line","endLine","reason"])||!string(ref.reason,300))fail("POSTING_REFERENCE",index);
  const block=range(ref,index);if(!block.trim())fail("POSTING_REFERENCE",index);for(let n=ref.line;n<=ref.endLine;n++){if(covered.has(n))fail("POSTING_REFERENCE_OVERLAP",index);covered.add(n);}
  // Reconstruct references from source lines; they are visible review items,
  // not invisible exclusions. Offsets below use a source line scanner instead.
  const spans=sourceLineSpans(request.posting),a=spans[ref.line-1],b=spans[ref.endLine-1];
  let id="reference-"+index;while(seen.has(id))id+="-extra";seen.add(id);
  return {id,category:"reference",quote:request.posting.slice(a.start,b.end),line:ref.line,endLine:ref.endLine,reason:ref.reason,basisQuote:"",roleQuote:"",applicantType:"unclear",applicantQuote:"",relation:"single",uncertainty:"AI가 참고정보로 분류한 범위입니다. 누락된 지원 조건이 없는지 원문을 검토하세요.",location:{start:a.start,end:b.end,line:ref.line,column:1,endLine:ref.endLine}};
 });
 const missingLines=lines.map((text,i)=>text.trim()&&!covered.has(i+1)?i+1:null).filter(Boolean);
 if(value.complete!==true||missingLines.length)fail("POSTING_COVERAGE",null,missingLines.length?missingLines:lines.map((_,i)=>i+1));
 return {schemaVersion:1,revision:request.revision,mode:"posting-classification",complete:true,approvalRequired:true,coverage:{totalLines:lines.length,coveredLines:covered.size,missingLines:[],kind:"structural-line-coverage-not-semantic-proof"},items:[...items,...references].sort((a,b)=>a.location.start-b.location.start)};
}
export function sourceLineSpans(posting){
 const spans=[];let start=0;
 for(const match of posting.matchAll(/\r\n|\r|\n/g)){spans.push({start,end:match.index});start=match.index+match[0].length;}
 spans.push({start,end:posting.length});return spans;
}
export async function classifyPosting({request,adapter,enabled=false,ownerApproved=false,timeoutMs=45000}){
 if(enabled!==true||ownerApproved!==true||typeof adapter?.classify!=="function")throw new AgentError("AGENT_DISABLED",503);
 const input=validatePostingRequest(request),controller=new AbortController();let timer;
 try{
  const output=await Promise.race([Promise.resolve().then(()=>adapter.classify({request:structuredClone(input),instructions:[...POSTING_INSTRUCTIONS]},{signal:controller.signal})),new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(new AgentError("ADAPTER_TIMEOUT",504));},timeoutMs);})]);
  return validatePostingClassification(output,input);
 }catch(e){
  if(e instanceof AgentError&&["INVALID_AGENT_OUTPUT","ADAPTER_TIMEOUT","BUDGET_EXHAUSTED","TOTAL_LIMIT_REACHED","RATE_LIMITED","QUOTA_UNAVAILABLE","NOT_INITIALIZED",...providerCodes].includes(e.code))throw e;
  throw new AgentError("ADAPTER_FAILED",502);
 }finally{clearTimeout(timer);}
}
