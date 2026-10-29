/* Source-first AI classification and explicit user-review handoff only. */
(function(){
 "use strict";
 if(typeof document==="undefined")return;
 const get=id=>document.getElementById(id),run=get("posting-ai-run"),status=get("posting-ai-status"),results=get("posting-ai-results"),consent=get("posting-ai-consent"),approve=get("posting-ai-approve"),confirm=get("posting-ai-confirm"),job=get("job-text");
 if(!run||!status||!results||!consent||!approve||!confirm||!job||!window.MuttajiPostingReview)return;
 const reviewer=window.MuttajiPostingReview.create(),labels={company:"기업명",role:"모집 직무·부서",responsibilities:"담당업무",required:"필수조건",preferred:"우대사항",reference:"참고 정보",unresolved:"확인 필요"};
 const el=(tag,text="")=>{const n=document.createElement(tag);n.textContent=text;return n;};
 const say=s=>{status.textContent=s;};
 let ready=false,publicMode=false,busy=false,generation=0,controller=null;
 const gate=state=>{window.MuttajiPostingReviewGate={requiresApproval:true,status:state,text:job.value.trim()};};gate("pending");
 function summary(prefix){const draft=reviewer.snapshot().draft;if(!draft)return;get("posting-ai-summary").textContent=prefix+" — "+Object.keys(labels).map(k=>labels[k]+" "+draft.items.filter(x=>x.category===k).length+"개").join(" · ")+". 참고 정보에도 누락된 조건이 없는지 검토해 주세요.";}
 function unconfirm(){
  // Re-analysis or a manual correction revokes previously displayed verdicts.
  // Keep profile fields intact; do not silently leave stale comparison/roadmap on screen.
  const priorApproved=window.MuttajiReviewedPosting?.provenance==="ai-user-approved";
  const panel=get("requirements-check");
  if(window.MuttajiReviewedPosting)window.MuttajiReviewedPosting=null;
  if(panel)panel.hidden=true;
  if(priorApproved)window.dispatchEvent(new CustomEvent("muttaji:comparison-changed",{detail:{items:null}}));
  confirm.checked=false;approve.disabled=true;gate("draft");summary("검토안 · 미승인");
 }
 function invalidate(){generation++;controller?.abort();controller=null;busy=false;run.disabled=!ready;reviewer.invalidate();results.replaceChildren();confirm.checked=false;approve.disabled=true;consent.checked=false;gate("pending");get("posting-ai-review").hidden=true;if(window.MuttajiReviewedPosting?.provenance==="ai-user-approved")window.MuttajiReviewedPosting=null;const panel=get("requirements-check");if(panel)panel.hidden=true;window.dispatchEvent(new CustomEvent("muttaji:comparison-changed",{detail:{items:null}}));say("원문이 변경되어 이전 AI 분석과 승인이 무효화되었습니다.");}
 job.addEventListener("input",invalidate);job.addEventListener("change",invalidate);
 window.addEventListener("muttaji:rule-reviewed",()=>{generation++;controller?.abort();controller=null;busy=false;run.disabled=!ready;window.MuttajiPostingReviewGate={requiresApproval:false,status:"rule-fallback",text:job.value.trim()};reviewer.invalidate();results.replaceChildren();get("posting-ai-review").hidden=true;confirm.checked=false;approve.disabled=true;say("규칙 기반 대체 결과를 선택했습니다. AI 확정 결과가 아닙니다.");});
 function input(label,value,tag="input"){
  const wrap=el("label",label),field=el(tag);field.value=value||"";wrap.append(field);return {wrap,field};
 }
 function render(){
  results.replaceChildren();const draft=reviewer.snapshot().draft;
  summary("AI 제안 · 미승인");
  for(const item of draft.items){
   const card=el(item.category==="reference"?"details":"article");card.className="sheet";
   card.append(el(item.category==="reference"?"summary":"h3",labels[item.category]+" · 원문 "+item.line+(item.endLine===item.line?"":"~"+item.endLine)+"행"));
   card.append(el("p",item.aiCategory?"AI 최초 제안: "+labels[item.aiCategory]+" · "+item.aiReason:"사용자가 원문에서 추가한 항목"),el("p",item.uncertainty));
   const quote=input("원문 인용 (수정 시 원문에 존재해야 함)",item.quote,"textarea"),category=el("select"),role=input("적용 직무의 원문 근거 (모르면 비워 두세요)",item.roleQuote),type=el("select"),scope=input("지원 유형의 원문 근거",item.applicantQuote),reason=input("분류 이유",item.reason,"textarea"),include=el("input");include.type="checkbox";include.checked=item.include!==false;
   for(const [key,label] of Object.entries(labels)){const option=el("option",label);option.value=key;category.append(option);}category.value=item.category;
   for(const [key,label] of Object.entries({unclear:"확인 필요",common:"공통",new:"신입",experienced:"경력"})){const option=el("option",label);option.value=key;type.append(option);}type.value=item.applicantType;
   const categoryLabel=el("label","검토 후 분류"),typeLabel=el("label","적용 지원 유형"),includeLabel=el("label","필수·우대인 경우 내 비교 대상에 포함");categoryLabel.append(category);typeLabel.append(type);includeLabel.append(include);
   card.append(quote.wrap,categoryLabel,role.wrap,typeLabel,scope.wrap,reason.wrap,includeLabel);
   const edit=()=>{unconfirm();try{reviewer.edit(item.id,{quote:quote.field.value,category:category.value,roleQuote:role.field.value,applicantType:type.value,applicantQuote:scope.field.value,reason:reason.field.value,include:include.checked});summary("사용자 수정안 · 미승인");say("사용자가 수정한 검토안입니다. 다시 확인하고 조건을 확정해 주세요.");}catch(e){say(e.message);}};
   [quote.field,category,role.field,type,scope.field,reason.field,include].forEach(n=>n.addEventListener("change",edit));
   [quote.field,role.field,scope.field,reason.field].forEach(n=>n.addEventListener("input",edit));
   results.append(card);
  }
  get("posting-ai-review").hidden=false;
 }
 confirm.addEventListener("change",()=>{approve.disabled=!confirm.checked||!reviewer.snapshot().valid||!reviewer.snapshot().draft;});
 get("posting-ai-add").addEventListener("click",()=>{unconfirm();try{reviewer.add(get("posting-ai-add-quote").value);get("posting-ai-add-quote").value="";render();say("원문 항목을 추가했습니다. 분류와 적용 범위를 확인해 주세요.");}catch(e){say(e.message);}});
 approve.addEventListener("click",()=>{
  try{
   const approved=reviewer.approve(job.value.trim(),confirm.checked);window.MuttajiReviewedPosting=approved;gate("approved");
   const panel=get("requirements-check");if(panel)panel.hidden=true;
   window.dispatchEvent(new CustomEvent("muttaji:comparison-changed",{detail:{items:null}}));
   window.dispatchEvent(new CustomEvent("muttaji:posting-reviewed"));document.dispatchEvent(new CustomEvent("muttaji:posting-reviewed"));
   approve.disabled=true;get("posting-ai-summary").textContent="사용자 확정 완료 · AI 제안과 구분된 현재 비교 입력입니다. 필수 "+approved.result.required.length+"개 · 우대 "+approved.result.preferred.length+"개. 내 역량 화면에서 비교를 실행하세요.";
   say("사용자가 조건을 확정했습니다. 내 역량 비교·기존 로드맵에 사용할 수 있습니다.");
  }catch(e){say(e.message);}
 });
 fetch("/api/model-analysis",{cache:"no-store"}).then(async r=>{if(!r.ok)throw Error();const info=await r.json();ready=info.enabled===true;publicMode=info.localOnly===false;get("posting-ai-access-wrap").hidden=publicMode;run.disabled=!ready;say(ready?"원문 전체를 AI가 분류합니다. 전송 동의와 실행이 필요하며, 결과는 승인 전까지 비교에 반영되지 않습니다.":"AI 분석이 비활성화되어 있습니다. 기존 규칙 기반 대체 기능을 선택할 수 있습니다.");}).catch(()=>{run.disabled=true;say("AI 연결 상태를 확인하지 못했습니다. 입력과 기존 결과는 유지합니다.");});
 run.addEventListener("click",async()=>{
  if(!ready||busy)return;if(!consent.checked){say("공고 원문의 외부 AI 전송에 동의해 주세요.");return;}
  const posting=job.value.trim();if(!posting||posting.length>20000||posting.split(/\r\n|\r|\n/).length>400){say("원문은 1~20,000자, 400행 이내로 입력해 주세요.");return;}
  if(!publicMode&&!get("posting-ai-access").value){say("서버의 테스트 접근 코드를 입력해 주세요. API 키는 입력하지 마세요.");return;}
  const imported=window.MuttajiImportedPosting;if(imported&&(imported.reviewed!==true||imported.text!==posting)){say("가져온 원문을 먼저 확인·적용해 주세요.");return;}
  const revision="posting-"+Date.now(),current=++generation;controller=new AbortController();busy=true;run.disabled=true;say("AI가 원문 전체의 구조와 조건을 분석하고 있습니다.");const timer=setTimeout(()=>controller?.abort(),55000);
  try{
   const headers={"content-type":"application/json",...(publicMode?{"x-muttaji-csrf":await window.MuttajiSession.get()}:{"x-agent-access-code":get("posting-ai-access").value})};
   const response=await fetch("/api/model-analysis",{method:"POST",headers,signal:controller.signal,body:JSON.stringify({task:"classify-posting",request:{schemaVersion:1,revision,posting,source:imported?{type:"url",url:imported.sourceUrl,reviewed:true}:{type:"manual"},consent:{externalAi:true}}})});
   const payload=await response.json();if(current!==generation||posting!==job.value.trim())return;
   if(!response.ok){const code=payload.error;const lines=payload.validation?.missingLines;const reason=payload.validation?.reason;const messages={BUDGET_EXHAUSTED:"AI 공유 예산 한도에 도달했습니다.",TOTAL_LIMIT_REACHED:"AI 공유 호출 한도에 도달했습니다.",RATE_LIMITED:"AI 요청 횟수가 제한되었습니다.",PROVIDER_OUTPUT_LIMIT:"AI 출력 토큰 한도로 분석이 중단됐습니다.",PROVIDER_OUTPUT_INVALID:"AI 응답의 JSON 구조가 맞지 않아 검증을 완료하지 못했습니다.",PROVIDER_NO_OUTPUT:"AI 모델이 분석 결과를 반환하지 않았습니다.",PROVIDER_BAD_REQUEST:"AI 모델이 분석 요청 형식을 수락하지 않았습니다.",PROVIDER_MODEL_UNAVAILABLE:"설정된 AI 모델을 사용할 수 없습니다.",ADAPTER_FAILED:"AI 모델의 응답을 처리하지 못했습니다.",QUOTA_UNAVAILABLE:"AI 공유 사용 한도 시스템에 연결하지 못했습니다.",ADAPTER_TIMEOUT:"분석 시간이 초과되었습니다.",PROVIDER_AUTH:"서버 AI 인증에 실패했습니다.",PROVIDER_QUOTA:"제공자의 크레딧 또는 한도 문제입니다.",SESSION_REQUIRED:"세션을 확인하지 못했습니다. 새로고침 후 다시 시도해 주세요.",ACCESS_DENIED:"테스트 접근 코드가 올바르지 않습니다."};throw Error((messages[code]||("AI 분석 응답 검증 실패"+(code==="INVALID_AGENT_OUTPUT"?" ("+({"POSTING_COVERAGE":"원문 누락","POSTING_QUOTE":"원문 인용 불일치","POSTING_POSITION":"줄번호 불일치","POSTING_OBLIGATION":"필수·우대 분류 근거 불일치","POSTING_APPLICANT_SCOPE":"지원 범위 불일치","POSTING_SCOPE_QUOTE":"적용 근거 불일치","POSTING_FORMAT":"응답 형식 오류","POSTING_ITEM_FORMAT":"항목 형식 오류"}[reason]||"기타 검증 오류")+")":"")))+(lines?.length?" 미완료 원문 행: "+lines.join(", "):"")+" 입력과 기존 사용자 결과는 유지합니다. 자동 재시도하지 않습니다.");}
   if(payload.data?.revision!==revision)throw Error("현재 입력과 분석 결과가 일치하지 않습니다.");
   reviewer.receive(posting,payload.data);unconfirm();render();say("AI 제안 · 미승인입니다. 참고 정보까지 검토하고 분류·적용 범위를 수정한 뒤 직접 확정해 주세요.");
  }catch(e){if(current===generation)say(e.name==="AbortError"?"분석을 중단했습니다. 입력과 기존 결과를 유지하며 자동 재시도하지 않습니다.":e.message);}
  finally{clearTimeout(timer);if(current===generation){busy=false;controller=null;run.disabled=!ready;}}
 });
})();
