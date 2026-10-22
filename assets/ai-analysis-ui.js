/* 뭐따지? · opt-in AI semantics UI. Never saves credentials or sends images. */
(function(){
  "use strict";
  const textInput=document.getElementById("job-text");
  const availability=document.getElementById("ai-availability");
  const controls=document.getElementById("ai-controls");
  const consent=document.getElementById("ai-consent");
  const access=document.getElementById("ai-access");
  const button=document.getElementById("ai-run");
  const feedback=document.getElementById("ai-feedback");
  const results=document.getElementById("ai-results");
  const summary=document.getElementById("ai-result-summary");
  const cards=document.getElementById("ai-result-cards");
  if(!textInput||!availability||!controls||!consent||!access||!button||!feedback||!results||!summary||!cards)return;
  const categories=[
    {key:"company",label:"기업명"},
    {key:"department",label:"모집 부서"},
    {key:"role",label:"모집 직무"},
    {key:"responsibilities",label:"담당업무"},
    {key:"required",label:"필수조건"},
    {key:"preferred",label:"우대사항"},
    {key:"unresolved",label:"확인 필요"}
  ];
  let enabled=false,busy=false;
  function el(tag,className,value){
    const node=document.createElement(tag);
    if(className)node.className=className;
    if(value!==undefined)node.textContent=String(value);
    return node;
  }
  function clear(){
    results.hidden=true;
    cards.replaceChildren();
    feedback.textContent="";
  }
  function controlsState(){
    const length=textInput.value.trim().length;
    button.disabled=!enabled||busy||!consent.checked||!access.value||length<20||length>8000;
  }
  textInput.addEventListener("input",()=>{clear();controlsState();});
  consent.addEventListener("change",controlsState);
  access.addEventListener("input",controlsState);
  async function check(){
    try{
      const response=await fetch("/api/analyze",{method:"GET",cache:"no-store"});
      if(!response.ok)throw Error("API_ERROR");
      const status=await response.json();
      enabled=status.enabled===true;
      if(enabled){
        availability.textContent="AI 서버가 준비되었습니다. 분석을 실행하면 채용공고 텍스트가 외부 AI 제공자에게 전송될 수 있습니다. 접근 코드를 입력하고 전송 동의 후 요청해 주세요.";
        controls.hidden=false;
      }else{
        availability.textContent="AI 분석 API 코드는 준비됐지만, 비용·접근 권한 설정이 완료되지 않아 현재 비활성화 상태입니다. 기존 텍스트 1차 분석과 이미지 OCR은 계속 사용할 수 있습니다.";
        controls.hidden=true;
      }
    }catch{
      availability.textContent="AI 서버 준비 상태를 확인할 수 없습니다. 기존 텍스트 1차 분석은 정상 이용할 수 있습니다.";
      controls.hidden=true;
    }
    controlsState();
  }
  function display(data){
    cards.replaceChildren();
    let total=0;
    for(const category of categories){
      const items=Array.isArray(data[category.key])?data[category.key]:[];
      total+=items.length;
      const card=el("article","result-block");
      card.appendChild(el("h3","",category.label+" · "+items.length+"개"));
      if(!items.length)card.appendChild(el("p","result-empty","원문에서 확인 가능한 항목이 없습니다."));
      else{
        const ul=el("ul","result-list");
        for(const item of items){
          const li=el("li","");
          li.appendChild(el("div","result-line",item.text));
          li.appendChild(el("small","result-evidence","근거 문구: "+item.evidence));
          ul.appendChild(li);
        }
        card.appendChild(ul);
      }
      cards.appendChild(card);
    }
    summary.textContent="AI가 제안한 항목 "+total+"개 · 모두 원문 근거 문구가 포함된 항목만 표시합니다. AI의 해석이므로 직접 확인·수정이 필요합니다.";
    results.hidden=false;
  }
  button.addEventListener("click",async function(){
    if(!enabled||busy||!consent.checked)return;
    const pasted=textInput.value.trim();
    if(pasted.length<20||pasted.length>8000){feedback.textContent="AI 분석 입력은 20~8,000자입니다.";return;}
    if(!access.value){feedback.textContent="접근 코드를 입력해 주세요.";return;}
    const snapshot=pasted;
    busy=true;clear();controlsState();
    feedback.textContent="AI가 채용공고를 분석하고 있습니다. 텍스트를 서버로 전송했습니다.";
    try{
      const response=await fetch("/api/analyze",{
        method:"POST",headers:{"content-type":"application/json","x-ai-access-token":access.value},
        body:JSON.stringify({text:snapshot,consent:true}),cache:"no-store"
      });
      const payload=await response.json();
      if(!response.ok)throw Error(payload.message||"AI 요청을 처리하지 못했습니다. ("+(payload.error||response.status)+")");
      if(snapshot!==textInput.value.trim()){
        feedback.textContent="분석 중 입력 내용이 바뀌었습니다. 현재 입력 내용을 기준으로 다시 요청해 주세요.";
        return;
      }
      if(!payload.data||payload.mode!=="semantic-ai")throw Error("AI 분석 결과 형식을 확인하지 못했습니다.");
      display(payload.data);
      feedback.textContent="AI 분석 결과를 표시했습니다. 실제 공고 원문과 반드시 비교해 주세요.";
      results.scrollIntoView({behavior:"smooth",block:"start"});
    }catch(error){
      feedback.textContent="AI 분석 실패: "+(error?.message||"알 수 없는 오류")+" 기존 규칙 기반 분석은 계속 사용할 수 있습니다.";
    }finally{
      busy=false;consent.checked=false;access.value="";controlsState();
    }
  });
  check();
})();
