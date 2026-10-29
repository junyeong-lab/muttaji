// The model chooses source line IDs and categories. The server constructs every
// quote and fills every remaining source line, so a model cannot fabricate
// quotations or falsely claim that it covered the entire posting.
import {AgentError,exactKeys} from "./contracts.js";
import {sourceLineSpans,validatePostingClassification} from "./posting-classifier.js";
import {POSTING_CATEGORIES} from "./posting-schema.js";

const short={type:"string",minLength:1,maxLength:120};
const line={type:"integer",minimum:0,maximum:400};
const obj=properties=>({type:"object",properties,required:Object.keys(properties),additionalProperties:false});
export function compactPostingSchemaForRequest(request){
 return obj({
  schemaVersion:{type:"integer",enum:[2]},
  revision:{type:"string",enum:[request.revision]},
  mode:{type:"string",enum:["posting-line-classification"]},
  items:{type:"array",maxItems:32,items:obj({
   line:{type:"integer",minimum:1,maximum:400},endLine:{type:"integer",minimum:1,maximum:400},
   category:{type:"string",enum:POSTING_CATEGORIES.filter(x=>x!=="reference")},
   reason:short,basisLine:line,roleLine:line,applicantLine:line,
   applicantType:{type:"string",enum:["common","new","experienced","unclear"]},
   relation:{type:"string",enum:["single","and","or","mixed","unclear"]}
  })}
 });
}
export const COMPACT_POSTING_INSTRUCTIONS=Object.freeze([
 "Classify only the supplied original numbered posting lines, never invent text or copy quotations.",
 "Return only selected spans (up to 32) as line/endLine and category. Prefer individual important responsibility and qualification lines. The server includes ALL remaining lines in a visible user-review section.",
 "The basisLine, roleLine and applicantLine fields are 1-based exact line IDs of source text at or before the classified span, or 0 if no explicit evidence exists. NEVER invent a heading or reuse a heading from a different role.",
 "Required/preferred MUST have explicit basisLine that supports its category. If the text does not explicitly say the condition is required or preferred, choose unresolved, not required.",
 "An applicantType other than unclear requires an exact supporting applicantLine. Do not apply experienced-only requirements to entry-level applicants.",
 "Keep each range small (prefer one to three lines), no overlapping ranges. Do not include a company's descriptive text as a hiring requirement. Task descriptions are responsibilities.",
 "Use the original line numbers without reproducing source text. Keep each reason brief. The server reconstructs exact source quotes; it does not trust model-produced text or exhaustive coverage claims."
]);
const fault=()=>{throw new AgentError("INVALID_AGENT_OUTPUT",502);};
const good=(x)=>Number.isInteger(x)&&x>=1&&x<=400;
const norm=s=>s.trim().replace(/[\s\[\]：:]/g,"");
const unsafeAsRequirement=quote=>["모집인원","모집분야","담당업무","자격요건"].includes(norm(quote))||/^\s*[○0-9]+\s*명\s*$/.test(quote);
function convertItems(proposals,request,removed){
 const lines=request.posting.split(/\r\n|\r|\n/),spans=sourceLineSpans(request.posting);
 const used=new Set(),items=[];
 const cite=(n,end)=>good(n)&&n<lines.length+1&&n<=end&&lines[n-1].length<=400?lines[n-1]:"";
 for(const [i,p] of proposals.entries()){
  if(!exactKeys(p,["line","endLine","category","reason","basisLine","roleLine","applicantLine","applicantType","relation"])||!good(p.line)||!good(p.endLine)||p.endLine<p.line||p.endLine>lines.length||p.endLine-p.line>4||!POSTING_CATEGORIES.includes(p.category)||p.category==="reference"||typeof p.reason!=="string"||p.reason.length>120||!p.reason.trim()||!["common","new","experienced","unclear"].includes(p.applicantType)||!["single","and","or","mixed","unclear"].includes(p.relation)){removed.push(i);continue;}
  if(Array.from({length:p.endLine-p.line+1},(_,j)=>p.line+j).some(n=>used.has(n))){removed.push(i);continue;}
  const quote=request.posting.slice(spans[p.line-1].start,spans[p.endLine-1].end);
  if(!quote.trim()||quote.length>1500){removed.push(i);continue;}
  const basisQuote=cite(p.basisLine,p.line),roleQuote=cite(p.roleLine,p.line),applicantQuote=cite(p.applicantLine,p.line);
  let category=p.category,applicantType=p.applicantType,uncertainty="";
  if(!["company","role","responsibilities","required","preferred","unresolved"].includes(category))category="unresolved";
  if(applicantType!=="unclear"&&(!applicantQuote||(applicantType==="new"&&!/신입|신규|entry|new/i.test(applicantQuote))||(applicantType==="experienced"&&!/경력|experienced/i.test(applicantQuote))||(applicantType==="common"&&!/공통|신입.*경력|경력.*신입|무관/.test(applicantQuote)))){
   applicantType="unclear";uncertainty="신입·경력 적용 근거를 확인하지 못했습니다. ";
  }
  // An explicit experienced-only phrase in this exact span takes precedence
  // over the model's guessed applicant path.
  if(/경력\s*만\s*해당|경력의\s*경우/.test(quote)&&applicantType!=="experienced"){
   category="unresolved";applicantType="unclear";
   uncertainty+="경력자만 해당한다는 문구의 적용 범위를 직접 확인하세요. ";
  }
  if(["required","preferred"].includes(category)){
   const hasObligation=category==="required"
     ? /필수|지원\s*자격|자격\s*요건|지원\s*요건|required|requirements/i.test(basisQuote)&&!/우대|preferred/i.test(basisQuote)
     :/우대|preferred/i.test(basisQuote);
   const headerIsTable=norm(basisQuote)==="자격요건"&&lines.filter(x=>["모집분야","담당업무","모집인원"].includes(norm(x))).length>=2;
   const negative=/필수(?:가|는)?\s*아|필요(?:가|는)?\s*없/.test(quote+basisQuote);
   if(!hasObligation||(category==="required"&&headerIsTable&&!/필수|반드시|required/i.test(quote))||negative||unsafeAsRequirement(quote)||!Number.isInteger(p.basisLine)){
    category="unresolved";uncertainty+="필수·우대 구분의 명시적 원문 근거가 충분하지 않습니다. ";
   }
  }
  // If the model cannot prove a claimed applicant scope, it remains unresolved
  // instead of applying the condition to the wrong type of candidate.
  if(["required","preferred"].includes(category)&&uncertainty&&applicantType==="unclear"){
   category="unresolved";
  }
  const relation=p.relation;
  if(category==="unresolved"&&!uncertainty)uncertainty="AI가 원문 구분 또는 적용 범위를 확정하지 못한 항목입니다.";
  const id="model-line-"+i;
  items.push({id,category,quote,line:p.line,endLine:p.endLine,reason:p.reason,basisQuote:category==="required"||category==="preferred"?basisQuote:"",roleQuote,applicantType,applicantQuote:applicantType==="unclear"?"":applicantQuote,relation,uncertainty:uncertainty.slice(0,300)});
  for(let n=p.line;n<=p.endLine;n++)used.add(n);
 }
 return {items,used,lines};
}
function assemble(selected,request){
 const lines=request.posting.split(/\r\n|\r|\n/),used=new Set();
 selected.forEach(item=>{for(let n=item.line;n<=item.endLine;n++)used.add(n);});
 const references=[];
 for(let i=0;i<lines.length;i++){
  if(used.has(i+1)||!lines[i].trim())continue;
  let end=i;
  while(end+1<lines.length&&!used.has(end+2))end++;
  references.push({line:i+1,endLine:end+1,reason:"AI가 개별 분류하지 않은 원문 구간입니다. 누락된 필수·우대 조건이 없는지 반드시 검토하세요."});
  i=end;
 }
 if(!selected.length){
  const first=lines.findIndex(x=>x.trim());
  if(first>=0){
   const quote=lines[first].slice(0,1500);
   selected=[{id:"review-only",category:"unresolved",line:first+1,endLine:first+1,quote,reason:"AI가 확실하게 분류한 항목이 없어 전체 원문 검토가 필요합니다.",basisQuote:"",roleQuote:"",applicantType:"unclear",applicantQuote:"",relation:"unclear",uncertainty:"모든 지원 조건을 원문에서 직접 확인하세요."}];
   return assemble(selected,request);
  }
 }
 return {schemaVersion:1,revision:request.revision,mode:"posting-classification",complete:true,items:selected,referenceRanges:references};
}
export function expandCompactPostingOutput(value,request){
 if(!exactKeys(value,["schemaVersion","revision","mode","items"])||value.schemaVersion!==2||value.revision!==request.revision||value.mode!=="posting-line-classification"||!Array.isArray(value.items)||value.items.length>32)fault();
 const removed=[],prepared=convertItems(value.items,request,removed);
 let selected=prepared.items;
 // Model output is not trusted as a citation. Bad individual guesses are
 // rejected without silently hiding their source: their lines reappear in
 // a visible source-backed reference range. No additional AI API calls.
 for(let n=0;n<=selected.length;n++){
  const output=assemble(selected,request);
  try{validatePostingClassification(output,request);return output;}
  catch(error){
   if(error?.code!=="INVALID_AGENT_OUTPUT")throw error;
   const index=error.validation?.itemIndex;
   if(!Number.isInteger(index)||index<0||index>=selected.length)throw error;
   const bad=selected[index];
   if(["POSTING_OBLIGATION","POSTING_APPLICANT_SCOPE","POSTING_METADATA_AS_CONDITION","POSTING_UNCERTAINTY"].includes(error.validation.reason)&&bad.category!=="unresolved"){
    selected=selected.map((item,i)=>i===index?{...item,category:"unresolved",applicantType:"unclear",applicantQuote:"",basisQuote:"",uncertainty:"원문의 조건 해석 또는 지원 유형을 확인해 주세요."}:item);
    // Experienced-only inline texts cannot satisfy the legacy strict scope
    // check with unclear applicant type; a subsequent iteration omits them.
   }else selected=selected.filter((_,i)=>i!==index);
  }
 }
 fault();
}
