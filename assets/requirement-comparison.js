/* 뭐따지? · 입력한 공고와 보유역량의 근거 중심 수동 비교.
 * AI, 외부 통신, 비율 산출 및 서버 저장 없음.
 */
(function(root,factory){
  "use strict";
  const api=factory();
  if(typeof module==="object"&&module.exports)module.exports=api;
  if(root)root.MuttajiRequirements=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(){
  "use strict";
  const verdicts=["확인 필요","충족","부분 충족","미충족"];

  function normCert(value){return String(value||"").normalize("NFKC").toLocaleLowerCase("ko-KR").replace(/\s+/g," ").trim();}
  // Deterministic matching only for a simple certificate-only requirement.
  // Other constraints (degree, experience, role, etc.) remain 확인 필요.
  function cleanCertRequirement(text,catalog){
    const input=normCert(text);
    if(!input||!Array.isArray(catalog))return null;
    const candidates=catalog.filter(c=>c&&typeof c.name==="string"&&
      c.verification_status==="needs_official_review"&&c.name!=="ISMS-P 인증심사원")
      .map(c=>({name:c.name,normalizedName:normCert(c.name)}))
      .sort((a,b)=>b.normalizedName.length-a.normalizedName.length);
    let remaining=input;
    const mentioned=[];
    for(const cert of candidates){
      const start=remaining.indexOf(cert.normalizedName);
      if(start<0)continue;
      const before=remaining[start-1]||"",tail=remaining.slice(start+cert.normalizedName.length);
      const after=tail[0]||"";
      if(/[가-힣a-z0-9]/i.test(before))continue;
      if(/[가-힣a-z0-9]/i.test(after)&& !/^(?:자격|보유|소지|취득|우대|필수|필요)/.test(tail))continue;
      remaining=remaining.slice(0,start)+" # "+tail;
      mentioned.push(cert.name);
    }
    if(!mentioned.length)return null;
    const cleaned=remaining.replace(/#/g," ").replace(/[()]/g," ").trim();
    const leftover=cleaned.replace(/(?:자격증|자격|보유자|보유|소지자|소지|취득자|취득|우대사항|우대|필수조건|필수|요건|조건|필요|必|or|또는|혹은|및|and)/gi,"")
      .replace(/[\s,.·:;/+\-]/g,"").trim();
    if(leftover)return null;
    const any=/\b(or)\b|또는|혹은/i.test(cleaned);
    const all=/\b(and)\b|및/i.test(cleaned);
    if(mentioned.length>1&&!any&&!all)return null;
    if(any&&all)return null;
    return {names:mentioned,mode:all?"all":any?"any":"single"};
  }
  function enteredCertificateNames(entered,catalog){
    const claims=String(entered||"").split(/[,;\n|]+/).map(normCert).filter(Boolean);
    return (Array.isArray(catalog)?catalog:[]).filter(c=>c&&typeof c.name==="string"&&
      claims.some(x=>[c.name,...String(c.aliases||"").split(";")].map(normCert).includes(x)));
  }
  function suggestCertificateAssessment(item,entered,catalog){
    if(!item||typeof item.text!=="string")return null;
    const requirement=cleanCertRequirement(item.text,catalog);
    if(!requirement)return null;
    const owned=enteredCertificateNames(entered,catalog);
    const matched=requirement.names.filter(name=>owned.some(c=>c.name===name));
    const meets=requirement.mode==="all"?matched.length===requirement.names.length:matched.length>=1;
    if(!meets)return null;
    return {status:"충족",
      explanation:"자동 일치(입력 기준): 공고의 자격증 조건과 내 역량의 보유 자격증란에 입력한 '"+matched.join(", ")+"' 이름이 일치합니다. 실제 취득·유효성 및 다른 지원 요건은 별도 확인이 필요합니다.",
      matched,basis:"profile-cert-name"};
  }
  function requirements(posting,parser,reviewed){
    if(typeof posting!=="string"||!parser||typeof parser.analyze!=="function")throw new TypeError("공고 분석기를 불러올 수 없습니다.");
    // Only trust manually corrected categories for the exact current posting.
    // Never persist reviews or infer a verified CV from parsed text.
    const result=reviewed && reviewed.text===posting.trim() &&
      reviewed.result && Array.isArray(reviewed.result.required) && Array.isArray(reviewed.result.preferred)
        ? reviewed.result : parser.analyze(posting);
    return ["required","preferred"].flatMap(kind=>result[kind].filter(item=>!item.sectionHeading).map((item,index)=>({
      id:kind+"-"+index,kind,text:item.text,source:item.source,
      line:item.line,endLine:item.endLine||item.line
    })));
  }
  function assessment(item,status,reason){
    if(!item||!verdicts.includes(status))throw new TypeError("평가 상태가 올바르지 않습니다.");
    const explanation=String(reason||"").trim();
    // A verdict without a stated reason is not accepted as established.
    const effective=(status!=="확인 필요" && explanation.length<5)?"확인 필요":status;
    return {...item,requestedStatus:status,status:effective,
      explanation:effective===status?explanation:"",
      needsReason:status!=="확인 필요"&&effective==="확인 필요"};
  }
  function tally(items){
    const sum={"충족":0,"부분 충족":0,"미충족":0,"확인 필요":0};
    for(const item of items)sum[item.status==="충족"||item.status==="부분 충족"||item.status==="미충족"?item.status:"확인 필요"]++;
    return sum;
  }
  function create(){
    const form=document.getElementById("profile-form");
    const job=document.getElementById("job-text");
    const panel=document.getElementById("requirements-check");
    const list=document.getElementById("requirements-list");
    const summary=document.getElementById("requirements-summary");
    const help=document.getElementById("requirements-message");
    const profileFields=["goal-job","education","experience","certs","skills"];
    if(!form||!job||!panel||!list||!summary||!help)return null;
    const el=(tag,cls,content)=>{
      const node=document.createElement(tag);
      if(cls)node.className=cls;
      if(content!=null)node.textContent=String(content);
      return node;
    };
    let current=[],sourceText="",sourceProfile="";
    function invalidateRoadmap(){
      const result=document.getElementById("roadmap-result");
      if(result)result.hidden=true;
      const notice=document.getElementById("roadmap-message");
      if(notice){notice.hidden=false;notice.textContent="요건별 평가가 변경됐습니다. 최신 비교 결과로 로드맵을 다시 생성해 주세요.";}
    }
    window.MuttajiComparisonSnapshot=null;
    function snapshot(){
      return profileFields.map(id=>String(document.getElementById(id)?.value||"")).join("\n---\n");
    }
    function collect(){
      return [...list.querySelectorAll("[data-requirement]")].map((node,i)=>{
        const status=node.querySelector("select").value;
        const reason=node.querySelector("textarea").value;
        return assessment(current[i],status,reason);
      });
    }
    function update(){
      const outcomes=collect();
      invalidateRoadmap();
      const total=tally(outcomes);
      // In-memory snapshot used by the separate roadmap screen. Never uploaded.
      window.MuttajiComparisonSnapshot={posting:sourceText,profile:sourceProfile,
        profileCerts:String(document.getElementById("certs")?.value||""),items:outcomes};
      summary.textContent="총 "+outcomes.length+"개 요건 · 충족 "+total["충족"]+" · 부분 충족 "+total["부분 충족"]+
        " · 미충족 "+total["미충족"]+" · 확인 필요 "+total["확인 필요"]+
        ". 사용자 확인·입력 기준이며 자동 검증 또는 합격 가능성 평가가 아닙니다.";
      outcomes.forEach((outcome,i)=>{
        const card=list.children[i],flag=card.querySelector("[data-assessment-note]");
        if(flag)flag.textContent=outcome.needsReason
          ?"사유가 5자 이상 입력되기 전에는 '확인 필요'로 집계합니다."
          :(outcome.status==="확인 필요"?"확인 필요: 입력하신 이력만으로 해당 요건 충족을 단정하지 않습니다."
          :"선택한 상태: "+outcome.status+" · 본인이 입력한 근거 기준");
      });
    }
    function checkStale(){
      // The comparison must become invalid even if the result panel is already
      // hidden or the browser/autofill changed values without an input event.
      if(!sourceText)return;
      if(job.value!==sourceText||snapshot()!==sourceProfile){
        panel.hidden=true;
        window.MuttajiComparisonSnapshot=null;
        invalidateRoadmap();
        current=[];
        sourceText="";sourceProfile="";
        help.textContent="채용공고 또는 프로필이 변경되었습니다. 아래 '채용공고와 내 역량 비교하기'를 다시 눌러 최신 내용으로 검토하세요.";
        help.hidden=false;
      }
    }
    const button=document.getElementById("requirements-run");
    button.addEventListener("click",()=>{
      list.replaceChildren();panel.hidden=true;
      window.MuttajiComparisonSnapshot=null;
      invalidateRoadmap();
      const parser=window.JobTextAnalyzer;
      if(!parser){help.textContent="공고 분류기를 불러오지 못했습니다. 새로고침한 뒤 다시 시도해 주세요.";help.hidden=false;return;}
      const text=job.value.trim();
      if(!text){help.textContent="먼저 '채용공고' 화면에 공고 텍스트를 입력해 주세요.";help.hidden=false;return;}
      const profile=profileFields.map(id=>document.getElementById(id).value.trim());
      if(!profile.some(Boolean)){help.textContent="내 역량 정보를 한 가지 이상 입력해 주세요.";help.hidden=false;return;}
      try{current=requirements(text,parser,window.MuttajiReviewedPosting);}
      catch(error){help.textContent="공고 내용에 문제가 있습니다: "+(error?.message||"분석 실패");help.hidden=false;return;}
      if(!current.length){help.textContent="공고에서 필수·우대 요건이 추출되지 않았습니다. 공고의 필수/우대 제목을 확인하거나 직접 추가해 주세요.";help.hidden=false;return;}
      current.forEach((item,i)=>{
        const card=el("article","req-item");card.dataset.requirement=item.id;
        const label=item.kind==="required"?"필수조건":"우대사항";
        card.appendChild(el("h3","",label+" "+(i+1)+" · 원문 "+item.line+(item.endLine!==item.line?"~"+item.endLine:"")+"행"));
        card.appendChild(el("p","req-source",item.text));
        const selectLabel=el("label","label","이 조건의 현재 상태 (본인이 확인 후 선택)");
        const select=el("select","req-verdict");
        const selectId="req-verdict-"+i;select.id=selectId;selectLabel.htmlFor=selectId;
        verdicts.forEach(v=>{const opt=el("option","",v);opt.value=v;select.appendChild(opt);});
        const proposal=suggestCertificateAssessment(item,document.getElementById("certs")?.value,window.MuttajiCertCatalog);
        select.value=proposal?proposal.status:"확인 필요";
        selectLabel.appendChild(select);
        card.appendChild(selectLabel);
        const reasonLabel=el("label","label","판단 근거 또는 부족한 점");
        const reason=el("textarea","req-reason");reason.rows=3;
        reason.placeholder="예: 실제로 수행한 프로젝트, 취득 자격증, 확인할 경력 조건 또는 아직 경험이 없는 이유. 자격증과 실무경력은 구분해 주세요.";
        if(proposal)reason.value=proposal.explanation;
        const reasonId="req-reason-"+i;reason.id=reasonId;reasonLabel.htmlFor=reasonId;reasonLabel.appendChild(reason);
        card.appendChild(reasonLabel);
        if(proposal)card.appendChild(el("p","review-note","자동 충족(입력 기준) · 보유 자격증 이름 일치. 실제 취득·유효성과 전체 지원 자격을 검증한 결과는 아닙니다. 상태와 근거를 수정할 수 있습니다."));
        const note=el("small","subtext");note.dataset.assessmentNote="1";card.appendChild(note);
        select.addEventListener("change",update);
        reason.addEventListener("input",update);
        list.appendChild(card);
      });
      sourceText=job.value;sourceProfile=snapshot();help.hidden=true;
      panel.hidden=false;update();
      panel.scrollIntoView({behavior:"smooth",block:"start"});
    });
    job.addEventListener("input",checkStale);
    job.addEventListener("change",checkStale);
    profileFields.forEach(id=>{
      const input=document.getElementById(id);
      input?.addEventListener("input",checkStale);
      input?.addEventListener("change",checkStale);
    });
    // A form submit can follow browser autofill or script-driven updates that
    // did not dispatch input events. Treat the confirmation as a second guard.
    form.addEventListener("submit",checkStale);
    // Switching tabs can reveal a saved view after autofill or changes that
    // did not dispatch an input event. Verify freshness on every navigation.
    window.addEventListener?.("hashchange",checkStale);
    window.MuttajiCheckRequirementFreshness=checkStale;
    return {update,checkStale};
  }
  if(typeof document!=="undefined"&&typeof window!=="undefined")create();
  return {requirements,assessment,tally,suggestCertificateAssessment,cleanCertRequirement,enteredCertificateNames};
});
