/* Public URL import review UI. Never sends profiles, invokes AI or runs HTML. */
(function(root,factory){
 const api=factory();if(typeof module==="object"&&module.exports)module.exports=api;
 if(root)root.MuttajiUrlImport=api;
 if(typeof document!=="undefined"&&typeof window!=="undefined")api.mount(document,window);
})(typeof globalThis!=="undefined"?globalThis:this,function(){
 "use strict";
 function httpsUrl(value){
  let url;try{url=new URL(String(value).trim());}catch{throw Error("https://로 시작하는 공고 링크를 입력해 주세요.");}
  if(url.protocol!=="https:"||url.username||url.password||(url.port&&url.port!=="443")||url.href.length>2048)
   throw Error("인증정보 없는 https:// 공고 링크를 입력해 주세요.");
  return url.href;
 }
 function mount(doc,win){
  const ids=["job-url","job-url-access","job-url-fetch","job-url-demo","job-url-status","job-url-review","job-url-draft","job-url-confirm","job-url-apply","job-url-undo","job-url-evidence","job-url-source","job-text"];
  const nodes=Object.fromEntries(ids.map(id=>[id,doc.getElementById(id)]));if(ids.some(id=>!nodes[id]))return null;
  const get=id=>nodes[id];let available=true,publicMode=false,csrfToken=null;let generation=0,active=null,result=null,previousText=null,appliedText=null;
  const message=text=>{get("job-url-status").textContent=text;};
  const buttonState=()=>{get("job-url-apply").disabled=!result||!get("job-url-confirm").checked||!get("job-url-draft").value.trim();};
  function invalidate(){generation++;active?.abort();active=null;result=null;get("job-url-review").hidden=true;get("job-url-confirm").checked=false;get("job-url-fetch").disabled=!available;buttonState();}
  get("job-url").addEventListener("input",()=>{invalidate();message(available?"링크 입력만으로 수집하거나 AI를 호출하지 않습니다.":"URL 수집은 현재 사용할 수 없습니다. 본문을 직접 붙여넣어 주세요.");});
  get("job-url-draft").addEventListener("input",()=>{get("job-url-confirm").checked=false;buttonState();});
  get("job-url-confirm").addEventListener("change",buttonState);
  get("job-url-demo").addEventListener("click",()=>{
   invalidate();get("job-url").value="https://jobs.example.org/demo/security";get("job-url-access").value="local-demo-code";
   message("로컬 가상 예제 링크와 공개 예제 코드를 입력했습니다. ‘본문 가져오기’를 눌러 확인하세요.");
  });
  get("job-url-fetch").addEventListener("click",async()=>{
   if(!available){message("URL 수집은 현재 사용할 수 없습니다. 본문을 직접 붙여넣어 주세요.");return;}
   let url;try{url=httpsUrl(get("job-url").value);}catch(error){message(error.message);return;}
   if(!publicMode&&!get("job-url-access").value){message("URL 수집 접근 코드를 입력해 주세요. 로컬 예제는 ‘가상 예제 링크 넣기’를 사용할 수 있습니다.");return;}
   invalidate();const current=generation;const controller=new AbortController();active=controller;
   get("job-url-fetch").disabled=true;message("공개 본문을 가져오고 있습니다. 사용자 프로필과 AI 분석은 전송하지 않습니다.");
   const timer=setTimeout(()=>controller.abort(),19000);
   try{
    const response=await win.fetch("/api/job-url-import",{method:"POST",headers:{"content-type":"application/json",...(publicMode?{"x-muttaji-csrf":csrfToken}:{"x-job-import-token":get("job-url-access").value})},body:JSON.stringify({url}),cache:"no-store",signal:controller.signal});
    if(current!==generation)return;
    if(!/^application\/json\b/i.test(response.headers.get("content-type")||""))throw Error("URL 수집 API가 준비되지 않았습니다. 공고 본문을 직접 붙여넣어 주세요.");
    const raw=await response.text();if(raw.length>1000000)throw Error("수집 응답이 너무 큽니다. 직접 붙여넣기를 사용해 주세요.");
    const payload=JSON.parse(raw);
    if(!response.ok)throw Error((typeof payload.message==="string"?payload.message.slice(0,250):"본문을 가져오지 못했습니다.")+" 공고 내용을 직접 복사해 아래 입력창에 붙여넣을 수 있습니다.");
    const data=payload.data;
    if(!data||data.schemaVersion!==1||typeof data.text!=="string"||data.text.length>20000||data.text.split("\n").length>400||!data.text.trim()||data.reviewRequired!==true)throw Error("추출 결과 형식을 확인하지 못했습니다.");
    const source=httpsUrl(data.sourceUrl);
    if(current!==generation)return;
    result={...data,sourceUrl:source};get("job-url-draft").value=data.text;
    get("job-url-source").textContent=(payload.mode==="mock"?"가상 예제 · 실제 사이트 수집 아님 · ":"")+(data.contentStatus==="partial"?"일부 정보만 추출 · ":"")+"수집 출처: "+source+" · 방식: "+data.method;
    if(Array.isArray(data.warnings)&&data.warnings.some(note=>typeof note==="string"&&note.startsWith("여러 모집 포지션")))get("job-url-source").textContent+=" · 여러 직무가 포함된 공고입니다. 지원할 직무의 조건만 남겨서 확인하세요.";
    if(Array.isArray(data.warnings)&&data.warnings.some(note=>typeof note==="string"&&note.startsWith("공고 작성자가 상세내용을 입력하지 않은")))get("job-url-source").textContent+=" · 공고에 미작성 항목이 있어 자동 분류 결과를 완전한 조건으로 볼 수 없습니다.";
    get("job-url-evidence").replaceChildren();
    const labels={company:"기업명",department:"모집 부서",role:"모집 직무",responsibilities:"담당업무",required:"필수조건",preferred:"우대사항",location:"근무지",deadline:"모집기간·마감일",skills:"기술·지식"};
    for(const [key,label] of Object.entries(labels))for(const entry of (Array.isArray(data.fields?.[key])?data.fields[key]:[]).slice(0,20)){
     if(typeof entry?.evidence?.quote!=="string")continue;
     const dt=doc.createElement("dt");dt.textContent=label;
     const dd=doc.createElement("dd");dd.textContent=entry.evidence.quote;
     get("job-url-evidence").appendChild(dt);get("job-url-evidence").appendChild(dd);
    }
    get("job-url-review").hidden=false;buttonState();
    message((payload.mode==="mock"?"모의 수집 결과입니다. ":"")+(data.contentStatus==="partial"?"본문 요건이 충분히 추출되지 않았습니다. 원문을 직접 복사해 보완하거나 기존 붙여넣기를 사용하세요.":"추출 본문을 확인·수정한 뒤 체크하고 적용하세요.")+" AI 분석은 실행하지 않았습니다.");
   }catch(error){if(current===generation)message(controller.signal.aborted?"본문 가져오기가 취소되거나 제한 시간을 넘었습니다. 직접 붙여넣기도 가능합니다.":error instanceof SyntaxError?"서버 응답을 읽지 못했습니다. 직접 붙여넣기를 사용해 주세요.":String(error.message||"본문 가져오기에 실패했습니다."));}
   finally{clearTimeout(timer);if(current===generation){active=null;get("job-url-fetch").disabled=!available;get("job-url-access").value="";}}
  });
  get("job-url-apply").addEventListener("click",()=>{
   if(!result||!get("job-url-confirm").checked)return;
   const text=get("job-url-draft").value.trim();if(!text||text.length>20000||text.split("\n").length>400){message("입력은 20,000자·400줄 이내로 작성해 주세요.");return;}
   previousText=get("job-text").value;appliedText=text;get("job-text").value=text;
   get("job-text").dispatchEvent(new win.Event("input",{bubbles:true}));
   win.MuttajiImportedPosting={text,originalText:result.text,sourceUrl:result.sourceUrl,method:result.method,reviewed:true,edited:text!==result.text.trim()};
   get("job-url-undo").disabled=false;
   message("확인한 본문을 기존 입력창에 적용했습니다. ‘텍스트 1차 분석하기’를 누르면 기존 비교·자격증 추천·로드맵으로 이어집니다. AI는 별도 동의·서버 활성화 후에만 실행됩니다.");
  });
  get("job-text").addEventListener("input",()=>{
   if(get("job-text").value!==appliedText){win.MuttajiImportedPosting=null;get("job-url-undo").disabled=true;}
  });
  get("job-url-undo").addEventListener("click",()=>{
   if(previousText===null||get("job-text").value!==appliedText)return;
   get("job-text").value=previousText;get("job-text").dispatchEvent(new win.Event("input",{bubbles:true}));
   win.MuttajiImportedPosting=null;previousText=null;appliedText=null;get("job-url-undo").disabled=true;message("URL 본문 적용을 취소하고 이전 입력으로 되돌렸습니다.");
  });
  message("URL을 입력하고 ‘본문 가져오기’를 누르세요. 가져온 내용은 확인 전까지 분석에 반영되지 않습니다.");
  if(win.MuttajiSession)win.fetch("/api/job-url-import",{cache:"no-store"}).then(async response=>{
   if(!response.ok)return;const info=await response.json();
   if(info.requiresAccessCode===false){
    // Do not allow a URL click while the visible access-code field is hidden
    // but the public CSRF session has not finished initializing yet.
    available=false;get("job-url-fetch").disabled=true;
    get("job-url-access").hidden=true;const label=doc.querySelector?.('label[for="job-url-access"]');if(label)label.hidden=true;
    get("job-url-demo").hidden=true;
    if(info.enabled){
      csrfToken=await win.MuttajiSession.get();
      publicMode=true;available=true;
      message("URL 수집 준비가 완료됐습니다. 공고 링크를 입력하고 본문 가져오기를 누르세요.");
    }else message("URL 수집은 현재 비활성화 상태입니다. 본문을 직접 붙여넣어 주세요.");
    get("job-url-fetch").disabled=!available;
   }
  }).catch(()=>{available=false;get("job-url-fetch").disabled=true;message("URL 수집 준비 상태를 확인하지 못했습니다. 직접 붙여넣기를 사용해 주세요.");});
  return {invalidate};
 }
 return {httpsUrl,mount};
});