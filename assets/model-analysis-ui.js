/* Real model suggestions are separate from user assessments; never persisted. */
(function(){
 "use strict";
 if(typeof document==="undefined")return;
 const get=id=>document.getElementById(id),button=get("model-run"),status=get("model-status"),results=get("model-results"),consent=get("model-consent");
 if(!button||!status||!results||!consent)return;
 const fields=["goal-job","education","experience","certs","skills"];
 let publicMode=false,csrfToken=null;
 let ready=false,generation=0,controller=null,busy=false;
 const snapshot=()=>JSON.stringify([get("job-text")?.value,...fields.map(id=>get(id)?.value),window.MuttajiReviewedPosting]);
 const say=text=>{status.textContent=text;};
 const el=(tag,text)=>{const node=document.createElement(tag);node.textContent=text;return node;};
 function invalidate(){generation++;controller?.abort();controller=null;busy=false;results.replaceChildren();consent.checked=false;button.disabled=!ready;say("입력이 바뀌었습니다. 현재 내용을 확인하고 전송 동의 후 분석해 주세요.");}
 ["job-text",...fields].forEach(id=>get(id)?.addEventListener("input",invalidate));
 get("job-text")?.addEventListener("change",invalidate);
 document.addEventListener("muttaji:posting-reviewed",invalidate);
 consent.addEventListener("change",()=>{if(!consent.checked)invalidate();});
 fetch("/api/model-analysis",{cache:"no-store"}).then(async response=>{
  if(!response.ok)throw Error();const info=await response.json();ready=info.enabled===true;publicMode=info.localOnly===false;
  if(publicMode){get("model-access").hidden=true;const label=document.querySelector?.('label[for="model-access"]');if(label)label.hidden=true;}
  if(ready&&publicMode)csrfToken=await window.MuttajiSession.get();
  button.disabled=!ready;
  say(ready?(publicMode?"AI 분석을 사용할 수 있습니다. 전송 내용을 확인하고 동의 후 실행해 주세요.":"연결 준비됨 · "+info.model+" · 이 서버 실행 중 최대 "+info.remaining+"회 테스트 가능"):"실제 AI 분석은 아직 비활성화 상태입니다. 모델·비용 승인과 서버 키 설정 후 사용할 수 있습니다.");
 }).catch(()=>{ready=false;button.disabled=true;say("실제 AI 분석은 아직 비활성화 상태입니다. 기존 비교·설명은 계속 사용할 수 있습니다.");});
 button.addEventListener("click",async()=>{
  if(!ready||busy)return;
  if(!consent.checked){say("전송 내용을 확인한 뒤 동의해 주세요.");return;}
  if(!publicMode&&!get("model-access").value){say("서버에서 설정한 테스트 접근 코드를 입력해 주세요. API 키는 입력하지 마세요.");return;}
  let request,requirements;
  try{
   const posting=get("job-text").value.trim();
   request=window.MuttajiAgentInput.prepare({posting,profile:Object.fromEntries(fields.map(id=>[id,get(id).value])),imported:window.MuttajiImportedPosting,consent:true,revision:"model-"+Date.now()});
   requirements=window.MuttajiRequirements.requirements(posting,window.JobTextAnalyzer,window.MuttajiReviewedPosting).map(x=>({id:x.id,sourceQuote:posting.includes(x.source)?x.source:x.text}));
   if(!requirements.length)throw Error("필수·우대 조건을 먼저 확인해 주세요.");
   if(requirements.length>20)throw Error("초기 AI 테스트는 요건 20개까지 지원합니다. 공고 범위를 줄여 주세요.");
  }catch(e){say("분석 입력을 확인해 주세요: "+e.message);return;}
  const original=snapshot(),current=++generation;controller=new AbortController();busy=true;button.disabled=true;results.replaceChildren();say("공고와 내 경험을 분석하고 있습니다.");
  const timer=setTimeout(()=>controller?.abort(),55000);
  try{
   const response=await fetch("/api/model-analysis",{method:"POST",headers:{"content-type":"application/json",...(publicMode?{"x-muttaji-csrf":csrfToken}:{"x-agent-access-code":get("model-access").value})},body:JSON.stringify({request,requirements}),signal:controller.signal});
   const payload=await response.json();
   if(current!==generation||original!==snapshot()){if(current===generation)invalidate();return;}
   if(!response.ok&&payload.error==="INVALID_AGENT_OUTPUT"){
    const reasons={RESPONSE_FORMAT:"응답 형식이 계약과 다릅니다.",REVISION_MISMATCH:"현재 입력과 응답의 식별자가 다릅니다.",REQUIREMENT_COUNT:"일부 요건이 누락되거나 추가되었습니다.",REQUIREMENT_ID:"요건 식별자가 바뀌거나 중복되었습니다.",POSTING_QUOTE:"공고 인용이 해당 요건 원문과 일치하지 않습니다.",PROFILE_QUOTE:"경험 인용이 해당 입력란의 원문과 일치하지 않습니다.",STATUS_WITHOUT_EVIDENCE:"입력 근거 없이 확인 필요 이외의 상태를 제안했습니다.",SKILL_QUOTE:"기술 인용이 공고 원문과 일치하지 않습니다.",CERTIFICATE_ID:"자격증 제안이 제공된 DB 목록과 일치하지 않습니다.",CERTIFICATE_QUOTE:"자격증 추천 근거가 공고 원문과 일치하지 않습니다.",ITEM_FORMAT:"요건 설명의 형식이나 길이가 기준과 다릅니다.",PROFILE_FORMAT:"경험 근거의 형식이 기준과 다릅니다.",SKILL_FORMAT:"기술 목록 형식이 기준과 다릅니다.",ACTION_FORMAT:"준비 행동의 형식이나 길이가 기준과 다릅니다.",CERTIFICATE_FORMAT:"자격증 목록 형식이 기준과 다릅니다."};
    const detail=payload.validation;
    const position=Number.isInteger(detail?.itemIndex)?"응답 항목 "+(detail.itemIndex+1)+": ":"";
    throw Error("AI 응답 검증 실패 · "+position+(reasons[detail?.reason]||"응답의 근거를 확인하지 못했습니다.")+" 결과는 반영하지 않았으며 자동 재시도하지 않습니다.");
   }
   if(!response.ok)throw Error(({BUDGET_EXHAUSTED:"서비스의 AI 예산 한도에 도달했습니다. 기존 비교는 계속 사용할 수 있습니다.",TOTAL_LIMIT_REACHED:"서비스의 AI 이용 한도에 도달했습니다.",RATE_LIMITED:"오늘의 AI 이용 한도에 도달했습니다.",NOT_INITIALIZED:"AI 이용 제한 저장소가 아직 준비되지 않았습니다.",QUOTA_UNAVAILABLE:"서버 이용 한도를 확인할 수 없어 분석을 중단했습니다.",SERVICE_DISABLED:"현재 AI 분석은 비활성화 상태입니다.",SESSION_REQUIRED:"새로고침 후 다시 이용해 주세요.",PROVIDER_AUTH:"OpenAI API 키 인증에 실패했습니다. 서버 키 설정을 확인해 주세요.",PROVIDER_QUOTA:"OpenAI API 크레딧 또는 사용 한도 문제입니다. 추가 결제 없이 계정 상태부터 확인해 주세요.",PROVIDER_MODEL_UNAVAILABLE:"설정한 모델에 접근할 수 없습니다. 모델 ID·계정 권한을 확인해야 합니다.",PROVIDER_RATE_LIMIT:"OpenAI 요청 제한에 도달했습니다. 자동 재시도하지 않습니다.",PROVIDER_BAD_REQUEST:"모델이 요청 형식 또는 옵션을 거부했습니다. 코드 점검이 필요합니다.",PROVIDER_OUTPUT_LIMIT:"AI 응답이 출력 한도에 도달해 완성되지 않았습니다. 자동 재시도하지 않습니다.",PROVIDER_OUTPUT_INVALID:"AI가 정해진 JSON 형식의 응답을 완성하지 못했습니다. 자동 재시도하지 않습니다.",PROVIDER_NO_OUTPUT:"AI가 분석 결과를 반환하지 않았습니다. 자동 재시도하지 않습니다.",PROVIDER_REQUEST_TOO_LARGE:"AI 전송 요청이 서버의 크기 한도를 초과했습니다. 공고나 역량 입력 분량을 줄여 주세요.",ADAPTER_FAILED:"AI 처리 중 분류되지 않은 오류가 발생했습니다. 자동 재시도하지 않습니다.",PROVIDER_UNAVAILABLE:"OpenAI 서버 오류입니다. 자동 재시도하지 않습니다.",AGENT_DISABLED:"서버 AI 설정이 비활성화되어 있습니다.",ACCESS_DENIED:"테스트 접근 코드가 올바르지 않습니다.",TEST_LIMIT_REACHED:"이번 서버의 테스트 횟수를 모두 사용했습니다.",INPUT_TOO_LARGE:"입력 분량을 줄여 주세요.",ADAPTER_TIMEOUT:"분석 시간이 초과되었습니다. 자동 재시도하지 않습니다.",INVALID_AGENT_OUTPUT:"응답의 근거를 확인하지 못해 표시하지 않았습니다."})[payload.error]||"분석을 완료하지 못했습니다. 기존 비교 기능은 계속 사용할 수 있습니다.");
   if(payload.data?.revision!==request.revision||!Array.isArray(payload.data.items))throw Error("분석 응답을 확인하지 못했습니다.");
   for(const item of payload.data.items){
    const card=el("article","");card.className="agent-result-card";
    card.append(el("h3",item.postingQuote),el("p",item.interpretation),el("p","AI 제안 상태: "+item.proposedStatus+" · 직접 선택한 상태에 반영하지 않습니다."),el("p",item.reason));
    card.append(el("h4","설명에 사용한 근거"),el("blockquote",item.postingQuote));
    for(const ref of item.profileEvidence)card.append(el("blockquote",ref.quote));
    for(const [title,items] of [["보완·확인할 부분",item.missing],["다음 준비 행동",item.actions]]){if(!items.length)continue;card.append(el("h4",title));const ul=el("ul","");items.forEach(x=>ul.append(el("li",x)));card.append(ul);}
    if(Array.isArray(item.preparationSuggestions)&&item.preparationSuggestions.length){
     card.append(el("h4","추가 준비 참고 · 공고의 필수요건 아님"));
     const list=el("ul","");item.preparationSuggestions.forEach(text=>list.append(el("li",text)));card.append(list);
    }
    if(item.certifications.length){card.append(el("h4","관련 자격증 참고 제안"));item.certifications.forEach(x=>card.append(el("p",(payload.certificationLabels?.[x.id]||"관련 자격증")+": "+x.reason)));}
    results.append(card);
   }
   const removed=(Array.isArray(payload.data.validationWarnings)?payload.data.validationWarnings:[]).filter(x=>x.code==="UNVERIFIED_SKILL_REMOVED").reduce((sum,x)=>sum+(Number.isInteger(x.count)&&x.count>0?x.count:0),0);
   say((removed?"원문 근거를 확인하지 못한 부가 기술 항목 "+removed+"개를 제외했습니다. ":"")+"AI 보조 의견입니다. 공고와 입력 근거를 확인해 주세요. 기존 상태·로드맵은 변경하지 않았습니다.");
  }catch(e){if(current===generation)say(e.name==="AbortError"?"분석을 중단했습니다. 자동 재시도하지 않습니다.":e.message);}
  finally{clearTimeout(timer);if(current===generation){busy=false;controller=null;button.disabled=!ready;}}
 });
})();
