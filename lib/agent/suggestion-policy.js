// Deterministic presentation rules for validated model suggestions only.
// Never changes the user's own assessments or mutates request/model input.
const normalize=value=>String(value||"").normalize("NFKC").toLowerCase().replace(/\s+/g,"");
const entryAlternative=/^(?:경력\s*[:：]\s*)?신입\s*[·ㆍ/]\s*경력\s*\d+\s*년\s*(?:↑|이상)?$/;
const additionalTopics=[
 {claim:/민간/,posting:/민간/},
 {claim:/컨설팅.*(?:산출물|보고서)|진단보고서/,posting:/컨설팅.*(?:산출물|보고서)|진단보고서/},
 {claim:/고객/,posting:/고객/},
 {claim:/개인정보보호.*(?:진단|컨설팅)/,posting:/개인정보보호.*(?:진단|컨설팅)/}
];
function addPreparation(item,text){
 item.preparationSuggestions??=[];
 if(!item.preparationSuggestions.includes(text))item.preparationSuggestions.push(text);
}
function refineExplanation(item,{plain,request}){
 if(entryAlternative.test(plain)&&Array.isArray(item.actions)){
  item.actions=item.actions.filter(action=>!(/신입/.test(action)&&/지원|경로/.test(action)&&/확인|문의/.test(action)));
 }
 // Narrow named-major conditions only; broad related-major/equivalency wording
 // remains for review rather than an inferred equivalence rule.
 const major=plain.match(/^전공\s*[:：]\s*(.+)$/);
 if(major&&item.proposedStatus==="부분 충족"&&!/관련|계열|동등|등(?:\s|$)/.test(major[1])){
  const names=major[1].split(/[,，/]|또는/).map(x=>normalize(x).replace(/전공자?$|과$/g,"")).filter(x=>x.length>=3);
  const education=normalize(request.profile.education);
  if(names.length&&!names.some(name=>education.includes(name))){
   item.proposedStatus="확인 필요";
   item.reason="입력한 전공이 공고에 열거된 전공과 일치하는지 확인 필요합니다. 관련 기술 실습이나 프로젝트가 명시된 전공 조건을 부분 충족하는 것으로 판단하지 않습니다.";
   item.profileEvidence=item.profileEvidence.filter(ref=>ref.field==="education");
   addPreparation(item,"관련 기술·프로젝트 경험은 전공 일치 여부와 구분해 직무 역량을 소개하는 자료로 활용할 수 있습니다.");
  }
 }
 if(Array.isArray(item.missing)){
  const moved=item.missing.filter(gap=>additionalTopics.some(topic=>topic.claim.test(gap)&&!topic.posting.test(request.posting)));
  if(moved.length){
   item.missing=item.missing.filter(gap=>!moved.includes(gap));
   moved.forEach(gap=>addPreparation(item,"필수 보완사항이 아닌 준비 참고: "+gap));
   if(additionalTopics.some(topic=>topic.claim.test(item.reason)&&!topic.posting.test(request.posting)))
    item.reason="공고에 명시된 조건과 입력 근거를 중심으로 살펴볼 수 있습니다. 공고에 없는 추가 경험·산출물은 부족한 자격요건이 아닌 지원 준비 참고로 구분했습니다.";
  }
 }
}
// Conservative display correction, separate from user's own assessments.
export function applySuggestionPolicy(value,{request,requirements,catalog}){
 const copy=structuredClone(value),known=new Map(requirements.map(x=>[x.id,x]));
 const norm=x=>String(x||"").normalize("NFKC").toLowerCase().replace(/\s+/g,"");
 for(const item of copy.items){
  const quote=known.get(item.id)?.sourceQuote||"";
  const plain=quote.replace(/^[\sㆍ•-]+/,"").trim();
  if(/^(?:경력\s*[:：]\s*)?신입\s*[·ㆍ/]\s*경력\s*\d+\s*년\s*(?:↑|이상)?$/.test(plain)&&item.proposedStatus==="충족"&&/신입[^.!?。]*(?:경로|지원|가능)/.test(item.reason)){
   item.proposedStatus="확인 필요";
   item.reason="신입 지원이 가능한 공고입니다. 지원 경로가 열려 있다는 사실만으로 경력 요건을 충족했다고 확정하지 않습니다. 경력 지원 시에는 실제 수행 업무와 회사의 경력 인정 기준을 구분해 살펴볼 수 있습니다.";
  }
  if(/^유관\s*업무\s*경험자\s*\(\s*인턴\s*[·ㆍ/]\s*알바\s*\)$/.test(plain)){
   item.interpretation="관련 업무 경험자를 우대하며, 인턴·알바는 경험 형태의 예시로 표시되어 있습니다.";
   item.reason="인턴·알바 경험의 유무를 별도 필수조건으로 보지 않고, 입력한 업무 내용과 공고 업무의 관련성을 중심으로 설명합니다. 회사가 인정하는 경험 범위는 별개입니다.";
   const formOnly=x=>/인턴|알바|아르바이트/.test(x)&&/여부|형태|유무|민간/.test(x);
   item.missing=item.missing.filter(x=>!formOnly(x));
   item.actions=item.actions.filter(x=>!formOnly(x));
  }
  refineExplanation(item,{plain,request});
  if(item.proposedStatus!=="미충족")continue;
  const names=catalog.map(x=>x.name).filter(x=>typeof x==="string"&&x.length>=2&&norm(quote).includes(norm(x)));
  if(!names.length)continue;
  const lines=request.profile.certs.split(/[\r\n.!?。]+/);
  const explicitlyAbsent=names.every(name=>lines.some(line=>norm(line).includes(norm(name))&&/미보유|미취득|없(?:음|습니다|어요|다)|취득하지\s*않/.test(line)));
  if(!explicitlyAbsent){
   item.proposedStatus="확인 필요";
   item.reason="공고에 명시된 자격증의 미보유를 직접 밝힌 근거가 없어 보유 여부는 확인 필요합니다. 입력 미기재나 다른 자격증 보유만으로 미충족을 판단하지 않습니다.";
   item.profileEvidence=[];
  }
 }
 return copy;
}
