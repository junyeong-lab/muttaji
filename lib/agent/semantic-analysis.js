// AI-only evidence contract. Does not classify the posting or update assessments.
import {AgentError,exactKeys} from "./contracts.js";
const nonRequired=/필수(?:가|는)?\s*(?:아니|아닙)|필요(?:가|는)?\s*없/;
const labels={required:"필수",preferred:"우대",not_required:"필수 아님",unclear:"확인 필요"};
const bounded=s=>typeof s==="string"&&s.trim().length>0&&s.length<=1500;
const optional=s=>s===""||bounded(s);
export const SEMANTIC_INSTRUCTIONS=Object.freeze([
 "For each item return semantics.units, separating clauses without dropping negation, examples, alternatives or qualification. When conditionQuote is supplied it is the selected condition inside sourceQuote; analyze and quote conditionQuote, not other conditions on that physical line. Quotes must cover conditionQuote (otherwise sourceQuote) in original order, except whitespace, bullets, punctuation and connecting words; return 1 to 8 units. Do not invent unquoted units. Split explicit 및/또는/혹은 into connected units, preserving the shared qualification without inserting words inside quotes.",
 "Each unit has obligation required/preferred/not_required/unclear; a sentence saying 필수가 아닙니다 is not_required, even inside a required section. A following positive sentence has its own unit. Never treat absence of a requirement as absence of user skill.",
 "Read the whole posting for scope. roleScope is common/specific/unclear; roleQuote cites the exact applicable role heading or an explicit common heading, otherwise empty with unclear. Never select a role from the profile goal. Optional analysisContext contains only an explicit user selection.",
 "applicantType is common/new/experienced/unclear. applicantQuote cites the exact common/new/experienced heading or inline qualification. 경력만 해당 or 경력의 경우 applies only to experienced applicants; do not carry it into the next common/new section. Preserve arrows and examples with their parent condition.",
 "relation is start for the first unit, then and/or/unclear. Use or only for an explicit alternative; a comma-separated example list or 등 is not automatically OR. For mixed operators with ambiguous precedence use unclear and explain in uncertainties. One held certificate cannot satisfy an AND of career, skill and qualification.",
 "semantics.uncertainties contains exact posting quote and reason for ambiguities/conflicts. If 신입 지원 가능 and a mandatory experience threshold coexist without a clear scope, cite the conflicting sentences and use 확인 필요; do not resolve the contradiction yourself.",
 "Use actions as optional roadmap supplements tied to this condition. Never replace the existing roadmap or decisions. Never recommend acquiring an already-held certificate, invent a mandatory certificate, promise that labs satisfy years of work, or invent probabilities or study duration.",
 "Military security work is relevant evidence, not proof of commercial solution operations, civil consulting or ISMS-P auditor credentials. Keep labs, planned projects, production operations and official qualification distinct. Missing information is unknown. Use only quoted profile evidence for claims about the user."
]);

// The ordinary parser intentionally leaves mixed negative sentences unresolved.
// Include those exact source lines in this AI request only, bounded by the same cap.
export function prepareSemanticRequirements(posting,requirements){
 const result=structuredClone(requirements),pending=[];
 const used=new Set(result.map(x=>x.id));
 let line=0;
 for(const quote of posting.split(/\r\n|\r|\n/)){
  line++;
  if(!nonRequired.test(quote)||!quote.trim()||result.some(x=>(x.conditionQuote||x.sourceQuote).includes(quote)))continue;
  if(quote.length>1500){pending.push({quote,line,reason:"CONTEXT_LENGTH_LIMIT"});continue;}
  if(result.length>=20){pending.push({quote,line,reason:"REQUEST_ITEM_LIMIT"});continue;}
  let id="semantic-context-"+line;while(used.has(id))id+="-extra";used.add(id);
  result.push({id,sourceQuote:quote});
 }
 return {requirements:result,pending};
}

export function validateAnalysisContext(value){
 if(value===undefined)return {selectedRole:"",applicantType:"unspecified"};
 if(!exactKeys(value,["selectedRole","applicantType"])||typeof value.selectedRole!=="string"||value.selectedRole.length>120||!["new","experienced","unspecified"].includes(value.applicantType))throw new AgentError("INVALID_INPUT");
 return structuredClone(value);
}

// UTF-16 offsets match JavaScript slicing. Keep up to 32 repeated occurrences;
// we never assign the first occurrence as an unambiguous source location.
export function locations(posting,quote){
 const found=[];
 for(let at=posting.indexOf(quote);at!==-1&&found.length<32;at=posting.indexOf(quote,at+1)){
  const before=posting.slice(0,at),last=before.match(/(?:\r\n|\r|\n)[^\r\n]*$/)?.[0]||before;
  found.push({start:at,end:at+quote.length,line:before.split(/\r\n|\r|\n/).length,column:last.replace(/^(?:\r\n|\r|\n)/,"").length+1,endLine:posting.slice(0,at+quote.length).split(/\r\n|\r|\n/).length});
 }
 return found;
}

export function validateSemantics(semantics,{item,requirement,request,fail}){
 const condition=requirement.conditionQuote||requirement.sourceQuote;
 if(!exactKeys(semantics,["units","uncertainties"])||!Array.isArray(semantics.units)||!semantics.units.length||semantics.units.length>8||!Array.isArray(semantics.uncertainties)||semantics.uncertainties.length>4)fail("SEMANTIC_FORMAT");
 let cursor=0;const offsets=[];
 const separator=s=>!s.replace(/또는|혹은|그리고|및|\b(?:and|or)\b/gi,"").replace(/[\sㆍ•·º▶▷→,，.;:：/()\[\]{}\-]+/g,"");
 for(const [index,unit] of semantics.units.entries()){
  if(!exactKeys(unit,["quote","obligation","roleScope","roleQuote","applicantType","applicantQuote","relation"])||!bounded(unit.quote)||!Object.hasOwn(labels,unit.obligation)||!["common","specific","unclear"].includes(unit.roleScope)||!["common","new","experienced","unclear"].includes(unit.applicantType)||!optional(unit.roleQuote)||!optional(unit.applicantQuote)||!(index===0?unit.relation==="start":["and","or","unclear"].includes(unit.relation)))fail("SEMANTIC_FORMAT");
  const at=condition.indexOf(unit.quote,cursor);
  if(at<0||!request.posting.includes(unit.quote))fail("SEMANTIC_QUOTE");
  if(at<cursor||!separator(condition.slice(cursor,at)))fail("SEMANTIC_COVERAGE");
  cursor=at+unit.quote.length;
  offsets.push(at);
  for(const quote of [unit.roleQuote,unit.applicantQuote])if(quote&&!request.posting.includes(quote))fail("SEMANTIC_SCOPE_QUOTE");
  if(unit.roleScope!=="unclear"&&!unit.roleQuote)fail("SEMANTIC_SCOPE_QUOTE");
  if(unit.applicantType!=="unclear"&&!unit.applicantQuote)fail("SEMANTIC_SCOPE_QUOTE");
  if(unit.applicantType==="new"&&!/신입|신규|new|entry/i.test(unit.applicantQuote))fail("SEMANTIC_SCOPE_QUOTE");
  if(unit.applicantType==="experienced"&&!/경력|experienced/i.test(unit.applicantQuote))fail("SEMANTIC_SCOPE_QUOTE");
  if(["new","experienced"].includes(unit.applicantType)&&/신입.*경력|경력.*신입/.test(unit.applicantQuote)&&!/경력\s*만\s*해당|경력의\s*경우/.test(unit.applicantQuote))fail("SEMANTIC_APPLICANT_SCOPE");
  if(unit.applicantType==="common"&&!/공통|신입.*경력|경력.*신입|무관/.test(unit.applicantQuote))fail("SEMANTIC_SCOPE_QUOTE");
  if(unit.roleScope==="common"&&!/공통|모든|전\s*직무/.test(unit.roleQuote))fail("SEMANTIC_SCOPE_QUOTE");
  if(nonRequired.test(unit.quote)&&unit.obligation!=="not_required")fail("SEMANTIC_NEGATION");
  if(!nonRequired.test(unit.quote)){
   const required=/필수/.test(unit.quote),preferred=/우대/.test(unit.quote);
   if((required&&preferred&&unit.obligation!=="unclear")||(preferred&&!required&&!["preferred","unclear"].includes(unit.obligation))||(required&&!preferred&&!["required","unclear"].includes(unit.obligation)))fail("SEMANTIC_OBLIGATION");
  }
  if(/\s(?:및|또는|혹은)\s/.test(unit.quote))fail("SEMANTIC_LOGIC");
  if(nonRequired.test(unit.quote)&&/아닙니다\.[\s\S]*\S/.test(unit.quote))fail("SEMANTIC_NEGATION");
  if(/경력\s*만\s*해당|경력의\s*경우/.test(unit.quote)&&unit.applicantType!=="experienced")fail("SEMANTIC_APPLICANT_SCOPE");
  const refs=locations(request.posting,unit.quote);
  if(refs.length===1){
   const at=refs[0].start;
   for(const anchor of [unit.roleQuote,unit.applicantQuote])if(anchor&&!locations(request.posting,anchor).some(ref=>ref.start<=at+unit.quote.length))fail("SEMANTIC_SCOPE_QUOTE");
   const before=request.posting.slice(0,at),headings=[...before.matchAll(/^\s*\[(공통|경력|신입)\]\s*$/gm)];
   const nearest=headings.at(-1)?.[1],expected={공통:"common",경력:"experienced",신입:"new"}[nearest];
   if(expected&&unit.applicantType!=="unclear"&&unit.applicantType!==expected&&!/경력\s*만\s*해당|경력의\s*경우/.test(unit.quote))fail("SEMANTIC_APPLICANT_SCOPE");
  }
 }
 if(!separator(condition.slice(cursor)))fail("SEMANTIC_COVERAGE");
 for(const u of semantics.uncertainties)if(!exactKeys(u,["quote","reason"])||!bounded(u.quote)||!bounded(u.reason)||!request.posting.includes(u.quote))fail("SEMANTIC_QUOTE");
 // Explicit AND/OR markers in quoted spans cannot silently change operator.
 for(let i=1;i<semantics.units.length;i++){
  const a=semantics.units[i-1],b=semantics.units[i];
  const start=offsets[i-1],end=offsets[i];
  const connector=condition.slice(start+a.quote.length,end).trim();
  if(/^(?:또는|혹은|or)$/i.test(connector)&&!["or","unclear"].includes(b.relation))fail("SEMANTIC_LOGIC");
  if(/^(?:및|그리고|and)$/i.test(connector)&&!["and","unclear"].includes(b.relation))fail("SEMANTIC_LOGIC");
 }
 for(const action of [item.interpretation,item.reason,...item.actions,...item.missing]){
  if(/합격[^.!?\n]{0,30}\d+\s*%|\d+\s*%[^.!?\n]{0,20}합격/.test(action)||/실습[^.!?\n]*(?:경력\s*(?:기간|\d+\s*년))[^.!?\n]*(?:충족|대체)/.test(action)||/\d+\s*(?:주|개월|년|일)\s*(?:안에|내에|만에|이면)[^.!?\n]*(?:취득|완성|합격)/.test(action))fail("SEMANTIC_UNSUPPORTED_CLAIM");
 }
 return semantics;
}

export function attachSemanticAnalysis(value,{request,requirements,catalog}){
 const copy=structuredClone(value),known=new Map(requirements.map(x=>[x.id,x]));
 const context=validateAnalysisContext(request.analysisContext);
 const norm=s=>s.normalize("NFKC").toLowerCase().replace(/\s+/g,"");
 const held=catalog.filter(c=>request.profile.certs.split(/[\r\n,，;]+/).some(line=>{
  if(/미보유|미취득|없(?:음|습니다|어요|다)|준비|예정|취득하지\s*않/.test(line))return false;
  const text=norm(line),name=norm(c.name),at=text.indexOf(name);
  return at>=0&&(!/[a-z0-9]/.test(name[0])||!/[a-z0-9]/.test(text[at-1]||""))&&(!/[a-z0-9]/.test(name.at(-1))||!/[a-z0-9]/.test(text[at+name.length]||""));
 }));
 for(const item of copy.items){
  const reasons=[];
  if(item.semantics){
   const units=item.semantics.units;
   if(item.semantics.uncertainties.length)reasons.push("원문 해석에 확인할 사항이 있습니다.");
   if(units.some(u=>locations(request.posting,u.quote).length!==1))reasons.push("동일 인용이 여러 위치에 있어 적용 문맥을 확인해야 합니다.");
   if(units.some(u=>u.relation==="unclear"))reasons.push("조건 간 논리 관계를 확정하지 않았습니다.");
   if(units.some(u=>u.roleScope==="specific"&&(!context.selectedRole||!u.roleQuote.includes(context.selectedRole))))reasons.push(context.selectedRole?"선택 직무에 적용되는 조건인지 확인 필요합니다.":"직무별 조건이며 지원 직무는 선택되지 않았습니다.");
   if(units.some(u=>["new","experienced"].includes(u.applicantType)&&u.applicantType!==context.applicantType))reasons.push(context.applicantType==="unspecified"?"지원 유형별 조건이며 신입·경력 경로는 선택되지 않았습니다.":"선택한 지원 유형에 그대로 적용하는 조건이 아닙니다.");
   if(units.every(u=>u.obligation==="not_required"))reasons.push("공고가 필수가 아니라고 명시한 항목입니다. 미충족 요건으로 취급하지 않습니다.");
   if(units.length>1&&units.some(u=>u.relation==="and")&&item.proposedStatus==="충족")reasons.push("복합 AND 조건은 한 항목의 근거만으로 전체 충족을 확정하지 않습니다.");
   const ops=new Set(units.slice(1).map(u=>u.relation));
   if(ops.has("and")&&ops.has("or"))reasons.push("AND·OR가 함께 있어 적용 순서와 범위를 확인해야 합니다.");
   if(/신입\s*지원\s*가능/.test(request.posting)&&units.some(u=>/\d+\s*(?:[~～-]\s*\d+\s*)?년.*경력|경력.*\d+\s*년/.test(u.quote)&&!/경력\s*만\s*해당|경력의\s*경우|\[경력\]|\(경력\)|경력자/.test(u.applicantQuote)))reasons.push("신입 지원 가능 문구와 경력 기간 요건의 관계가 명확하지 않아 확인 필요합니다.");
   const condition=known.get(item.id).conditionQuote||known.get(item.id).sourceQuote;
   item.semanticAnalysis={sourceQuote:condition,contextQuote:known.get(item.id).sourceQuote,locations:locations(request.posting,condition),units:units.map(u=>({...u,locations:locations(request.posting,u.quote),roleLocations:u.roleQuote?locations(request.posting,u.roleQuote):[],applicantLocations:u.applicantQuote?locations(request.posting,u.applicantQuote):[]})),uncertainties:item.semantics.uncertainties.map(u=>({...u,locations:locations(request.posting,u.quote)})),reviewNotes:reasons};
   delete item.semantics;
  }
  // Never promote a lab/planned project into commercial tenure or auditor status.
  const evidence=item.profileEvidence.map(x=>x.quote).join("\n");
  const quote=known.get(item.id).conditionQuote||known.get(item.id).sourceQuote;
  if(item.proposedStatus==="충족"&&(/상용|운영\s*경력|\d+\s*(?:~\s*\d+\s*)?년|인증\s*심사원/.test(quote))&&/실습|학습|예정|프로젝트|군|해군|기관평가/.test(evidence))reasons.push("실습·군 업무 근거를 해당 운영 경력 기간이나 심사원 자격과 동일하게 확정하지 않습니다.");
  if(reasons.length){item.proposedStatus="확인 필요";item.reason=reasons.join(" ");}
  const owned=new Set(held.map(c=>String(c.id)));
  item.certifications=item.certifications.filter(c=>!owned.has(String(c.id)));
  item.actions=item.actions.filter(action=>!held.some(c=>norm(action).includes(norm(c.name))&&/취득|준비|응시/.test(action)));
  if(item.semanticAnalysis)item.roadmapSupplement={requirementInterpretation:item.interpretation,currentRelation:item.reason,actions:[...item.actions],postingEvidence:item.semanticAnalysis.locations,profileEvidence:structuredClone(item.profileEvidence),advisoryOnly:true};
 }
 return copy;
}
