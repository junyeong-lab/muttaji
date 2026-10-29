/* In-memory AI draft → explicit user approval. No parser, network or storage. */
(function(root,factory){const api=factory();if(typeof module==="object"&&module.exports)module.exports=api;if(root)root.MuttajiPostingReview=api;})(typeof globalThis!=="undefined"?globalThis:this,function(){
 "use strict";
 const categories=["company","role","responsibilities","required","preferred","reference","unresolved"];
 const copy=x=>JSON.parse(JSON.stringify(x));
 function locate(posting,quote,preferredLine){
  if(typeof quote!=="string"||!quote.trim())throw Error("원문 인용이 비어 있습니다.");
  const refs=[];for(let at=posting.indexOf(quote);at!==-1;at=posting.indexOf(quote,at+1))refs.push({start:at,end:at+quote.length,line:posting.slice(0,at).split(/\r\n|\r|\n/).length,endLine:posting.slice(0,at+quote.length).split(/\r\n|\r|\n/).length});
  const same=refs.filter(r=>r.line===preferredLine);
  if(same.length===1)return same[0];if(refs.length===1)return refs[0];
  throw Error(refs.length?"인용이 여러 위치에 있습니다. 해당 원문 행 전체를 인용해 주세요.":"수정한 인용이 원문에 없습니다. 원문에 있는 문구만 사용할 수 있습니다.");
 }
 function create(){
  let text="",draft=null,approved=null;const invalid=new Set();
  function check(item){
   if(!categories.includes(item.category)||typeof item.reason!=="string"||!item.reason.trim()||item.reason.length>300)throw Error("분류와 분류 이유를 확인해 주세요.");
   if(typeof item.include!=="boolean")throw Error("비교 대상 포함 여부를 확인해 주세요.");
   if(!["common","new","experienced","unclear"].includes(item.applicantType))throw Error("적용 지원 유형을 확인해 주세요.");
   for(const key of ["roleQuote","applicantQuote"]){if(typeof item[key]!=="string"||item[key].length>400||item[key]&&!text.includes(item[key]))throw Error("적용 범위 근거는 원문에서 복사해 주세요.");}
   if(item.applicantType!=="unclear"&&!item.applicantQuote)throw Error("지원 유형을 지정했다면 원문 적용 범위 근거도 입력해 주세요.");
   return {...item,...locate(text,item.quote,item.line)};
  }
  function coverage(items){const covered=new Set();items.forEach(x=>{for(let n=x.line;n<=x.endLine;n++)covered.add(n);});return text.split(/\r\n|\r|\n/).flatMap((s,i)=>s.trim()&&!covered.has(i+1)?[i+1]:[]);}
  return {
   receive(posting,data){
    if(!data||data.mode!=="posting-classification"||data.complete!==true||data.approvalRequired!==true||!Array.isArray(data.items)||!data.items.length)throw Error("전체 원문 분석을 완료한 응답이 아닙니다.");
    const previous=text;text=posting;
    try{const ids=new Set();const items=data.items.map(x=>{if(ids.has(x.id))throw Error("중복 항목입니다.");ids.add(x.id);return check({...copy(x),aiCategory:x.category,aiRoleQuote:x.roleQuote,aiApplicantType:x.applicantType,include:true,edited:false});});if(coverage(items).length)throw Error("분석하지 않은 원문 행이 남아 있습니다.");draft={revision:data.revision,items};invalid.clear();}
    catch(e){text=previous;throw e;}
    return copy(draft);
   },
   edit(id,patch){
    if(!draft)throw Error("먼저 AI 분석을 실행해 주세요.");
    const index=draft.items.findIndex(x=>x.id===id);if(index<0)throw Error("항목을 찾지 못했습니다.");
    const allowed=["quote","category","reason","roleQuote","applicantType","applicantQuote","uncertainty","include"];
    if(Object.keys(patch).some(k=>!allowed.includes(k)))throw Error("허용되지 않은 수정 항목입니다.");
    invalid.add(id);approved=null;
    const item=check({...draft.items[index],...copy(patch),edited:true});
    draft.items[index]=item;invalid.delete(id);return copy(item);
   },
   add(quote){
    if(!draft||draft.items.length>=140)throw Error("항목을 추가할 수 없습니다.");
    let id="manual-"+draft.items.length;while(draft.items.some(x=>x.id===id))id+="-new";
    const item=check({id,quote,category:"unresolved",reason:"사용자가 원문에서 추가한 검토 항목",basisQuote:"",roleQuote:"",applicantType:"unclear",applicantQuote:"",relation:"unclear",uncertainty:"분류와 적용 범위를 검토하세요.",include:true,edited:true,aiCategory:null});
    draft.items.push(item);approved=null;return copy(item);
   },
   approve(current,confirmed){
    if(!draft||current!==text||confirmed!==true||invalid.size)throw Error("원문 전체와 항목의 분류·적용 범위를 확인하고 승인해 주세요.");
    const items=draft.items.map(check);if(coverage(items).length)throw Error("원문 일부가 검토 대상에서 누락되었습니다.");
    const result=Object.fromEntries(["company","role","responsibilities","required","preferred","unresolved"].map(k=>[k,[]]));result.sourceLines=text.split(/\r\n|\r|\n/).length;
    for(const item of items){const excluded=["required","preferred"].includes(item.category)&&item.include===false;const key=excluded||item.category==="reference"?"unresolved":item.category;result[key].push({text:item.quote,source:item.quote,line:item.line,endLine:item.endLine,manualReviewed:true,sectionHeading:false,roleQuote:item.roleQuote,applicantType:item.applicantType,applicantQuote:item.applicantQuote,kindHint:excluded?"사용자가 비교 대상에서 제외한 조건":item.uncertainty,classificationReason:item.reason});}
    approved={text,result,provenance:"ai-user-approved",userApproved:true,revision:draft.revision};return copy(approved);
   },
   invalidate(){text="";draft=null;approved=null;invalid.clear();},
   snapshot(){return {draft:copy(draft),approved:copy(approved),valid:invalid.size===0};}
  };
 }
 return {create,locate,categories};
});
