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
  function requirements(posting,parser,reviewed){
    if(typeof posting!=="string"||!parser||typeof parser.analyze!=="function")throw new TypeError("공고 분석기를 불러올 수 없습니다.");
    // Only trust manually corrected categories for the exact current posting.
    // Never persist reviews or infer a verified CV from parsed text.
    const result=reviewed && reviewed.text===posting.trim() &&
      reviewed.result && Array.isArray(reviewed.result.required) && Array.isArray(reviewed.result.preferred)
        ? reviewed.result : parser.analyze(posting);
    return ["required","preferred"].flatMap(kind=>result[kind].filter(item=>!item.sectionHeading&&!(parser.nonRequirementKind&&parser.nonRequirementKind(item.text))).map((item,index)=>({
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
  // A certificate match means user-reported name equality, not verified possession.
  // Canonical certification names and aliases: user-selected 34 entries.
  const catalog=[
    ["정보보안기사","정보보안 국가기술자격","SIS(구 정보보호전문가)"],
    ["정보처리기사","정처기"],
    ["네트워크관리사 2급","네관사 2급"],
    ["리눅스마스터 2급","Linux Master 2급"],
    ["SQLD","SQL 개발자","SQL Developer"],
    ["ADsP","데이터분석 준전문가"],
    ["CPPG","개인정보관리사"],
    ["빅데이터분석기사","빅분기"],
    ["정보통신기사"],
    ["AWS Certified Cloud Practitioner","AWS Cloud Practitioner","CLF-C02","AWS CCP"],
    ["AWS Certified Solutions Architect - Associate","AWS SAA","AWS Solutions Architect Associate"],
    ["Microsoft Azure Fundamentals (AZ-900)","AZ-900","Azure Fundamentals","Azure 기초"],
    ["정보보안산업기사"],
    ["SQLP","SQL 전문가","SQL Professional"],
    ["ADP","데이터분석 전문가"],
    ["리눅스마스터 1급","Linux Master 1급"],
    ["네트워크관리사 1급","네관사 1급"],
    ["ISMS-P 인증심사원","ISMS-P 심사원"],
    ["CompTIA Security+","Security+","CompTIA Security Plus"],
    ["Cisco CCNA","CCNA","Cisco Certified Network Associate"],
    ["CISSP","Certified Information Systems Security Professional"],
    ["정보관리기술사"],
    ["정보기기운용기능사","정보기기 운용"],
    ["정보처리산업기사"],
    ["컴퓨터시스템기사"],
    ["컴퓨터시스템응용기술사"],
    ["정보보호위험관리사","ISRM"],
    ["정보보호능력검정","TOLIS"],
    ["PC정비사 1급"],
    ["PC정비사 2급"],
    ["DAP","DA 전문가","Data Architecture Professional"],
    ["DAsP","DA 준전문가","Data Architecture Semi-Professional"],
    ["산업보안관리사"],
    ["AICE associate","AICE"]
  ];
  const normCert=value=>String(value||"").normalize("NFKC").toLowerCase().replace(/\s+/g,"");
  function mentions(text,term){
    const source=normCert(text),needle=normCert(term);
    if(!needle)return false;
    let i=source.indexOf(needle);
    while(i>=0){
      const before=source[i-1]||"",after=source[i+needle.length]||"";
      // Prevent substring hits for acronyms such as SQLD vs SQLDP.
      if((!/[a-z0-9]/.test(needle[0])||!/[a-z0-9]/.test(before)) &&
        (!/[a-z0-9]/.test(needle[needle.length-1])||!/[a-z0-9]/.test(after)))return true;
      i=source.indexOf(needle,i+1);
    }
    return false;
  }
  function ownedCertificates(input){
    return String(input||"").split(/[\n,;，]+/).map(x=>x.trim()
      .replace(/^[·ㆍ•*\-\d.)\s]+/,"")
      .replace(/^(?:취득한?\s*자격증|보유\s*자격증|자격증)\s*[:：]\s*/,"")
      .replace(/\s*[\[(]?(?:취득(?:완료)?|보유|합격)[\])]?\s*$/,"").trim())
      .filter(Boolean).map(entry=>{
        const names=catalog.find(group=>group.some(name=>normCert(name)===normCert(entry)));
        return names?names[0]:entry;
      });
  }
  function certificateMatches(requirement,entry){
    const owned=ownedCertificates(entry);
    return owned.some(name=>{
      const group=catalog.find(names=>names.some(alias=>normCert(alias)===normCert(name)));
      return (group||[name]).some(alias=>mentions(requirement,alias));
    });
  }
  function credentialSuggestion(item,profileCertificates){
    if(!item||typeof item.text!=="string"||!String(profileCertificates||"").trim())return null;
    const owned=ownedCertificates(profileCertificates);
    // For this narrowly worded preferred example list, only CISSP/CISA are
    // explicitly named. "Etc." is NOT approval of other security certificates.
    const namedSecurityExamples=/^(?:CISSP\s*[,，]\s*CISA|CISA\s*[,，]\s*CISSP)\s*등\s*(?:IT\s*)?보안\s*관련\s*자격증(?:\s*자격증)?\s*소지자\s*우대$/i;
    if(item.kind==="preferred"&&namedSecurityExamples.test(item.text.trim())){
      const named=owned.filter(name=>["cissp","cisa"].includes(normCert(name)));
      if(named.length)return {status:"충족",names:named,
        reason:"공고에 직접 명시된 '"+named.join(", ")+"' 자격증명이 보유 입력과 일치합니다. 이 우대항목만 본인 입력 기준으로 충족 표시하며, 실제 취득 증빙 및 회사 인정 여부는 별도 확인이 필요합니다."};
      // Other reported security certificates remain review-only, never
      // auto-fulfilled merely because the posting says "등".
      return null;
    }
    const mentioned=catalog.map(group=>{
      const match=group.slice().sort((a,b)=>b.length-a.length).find(term=>mentions(item.text,term));
      return match?{name:group[0],term:match}:null;
    }).filter(Boolean);
    // Additional explicit credentials are accepted if they look like certificate
    // names; generic skills or job experience must never auto-match.
    for(const name of owned){
      if(mentioned.some(x=>normCert(x.name)===normCert(name)))continue;
      if(!/(?:기사|산업기사|기능사|관리사|마스터|인증심사원|certified|certification)/i.test(name) &&
        !/^[a-z][a-z0-9+.-]{2,15}$/i.test(name))continue;
      if(mentions(item.text,name))mentioned.push({name,term:name});
    }
    if(!mentioned.length)return null;
    // A job board may list example certificates on the next line of an
    // optional credential condition. For example:
    // 'IT/정보보안 자격증 소지자: 정보보안(산업)기사, 정보처리기사, ... CPPG 등'.
    // A reported named credential meets only that optional certificate
    // criterion, not any other education, career or technical condition.
    const namedExampleList=/(?:예\s*[:：]|예시|예를\s*들어|[,，][^.!?\n]{0,200}등(?:\s|$|[)\].,]))/i.test(item.text);
    const certificateListContext=/(?:자격증|자격\s*(?:소지|보유)|인증심사원|심사원)/.test(item.text);
    // In a strictly labeled certificate list, "정보통신기술자 경력수첩"
    // names a credential; the word "경력" inside that name does NOT add
    // an independent work-experience requirement.
    const prefixedCertificateList=/^(?:우대\s*)?(?:관련\s*)?자격증\s*[:：]/i.test(item.text.trim());
    const careerCheckText=prefixedCertificateList
      ? item.text.replace(/정보통신기술자\s*경력\s*수첩/g,"")
      : item.text;
    const otherRequirements=/(?:경력|실무\s*경험|학력|전공|졸업|학위|\d+\s*년\s*이상|업무\s*경험|(?:네트워크|보안|IT)\s*이해|\bTOEIC\b|외국어)/i.test(careerCheckText);
    const allRequired=/(?:및|모두|전부|각각|동시|둘\s*다|\ball\b)/i.test(item.text);
    if(namedExampleList&&certificateListContext&&!otherRequirements&&!allRequired){
      const matches=mentioned.filter(x=>owned.some(name=>normCert(name)===normCert(x.name)));
      if(matches.length){
        const names=matches.map(x=>x.name);
        return {status:"충족",names,
          reason:"공고에 나열된 자격증 예시 중 '"+names.join(", ")+"'가 보유 자격증 입력과 일치합니다. 이 자격증 보유 우대조건만 본인 입력 기준으로 충족 표시하며, 실제 취득 증빙과 회사 인정 여부는 별도 확인이 필요합니다."};
      }
    }
    // Preferred lists titled "자격증: A, B, C" ordinarily name eligible
    // examples, not a requirement to hold all three. Keep comma-only
    // *required* lists unresolved unless alternatives are explicit.
    const listed=String(item.text).trim().match(/^(?:우대\s*)?(?:관련\s*)?자격증\s*[:：]\s*(.+)$/i);
    if(item.kind==="preferred"&&listed&&/[,，]/.test(listed[1])&&!otherRequirements&&!allRequired){
      const entries=listed[1].split(/[,，]/).map(x=>x.trim()).filter(Boolean);
      const certShape=/(?:기사|기능사|기술사|관리사|마스터|심사원|경력\s*수첩|SQLD|SQLP|ADsP|ADP|CPPG|CISA|CISSP|CCNA|DAP|AICE)/i;
      if(entries.length>=2&&entries.every(x=>certShape.test(x)&&!/\b(?:및|모두|각각|필수)\b/.test(x))){
        const matches=mentioned.filter(x=>owned.some(name=>normCert(name)===normCert(x.name)));
        if(matches.length){
          const names=matches.map(x=>x.name);
          return {status:"충족",names,
            reason:"공고의 우대 자격증 목록 중 '"+names.join(", ")+"'가 보유 자격증 입력과 정확히 일치합니다. 한 가지 이상 보유한 경우로 해석해 이 우대항목만 본인 입력 기준 충족 표시하며, 모든 자격증을 요구하는지와 실제 취득 증빙·회사 인정 여부는 별도 확인이 필요합니다."};
        }
      }
    }
    const alternatives=/(?:또는|혹은|택\s*1|택일|중\s*(?:한|1)|[/|])/i.test(item.text);
    const conjunction=/(?:및|모두|둘\s*다|동시|전부)/i.test(item.text);
    if(mentioned.length>1&&alternatives===conjunction)return null;
    let remainder=normCert(item.text);
    mentioned.sort((a,b)=>normCert(b.term).length-normCert(a.term).length)
      .forEach(x=>{remainder=remainder.split(normCert(x.term)).join("");});
    remainder=remainder.replace(
      /(?:공고명시|명시된|필수자격증|필수자격요건|자격요건|필수조건|필수자격|우대사항|자격증명|자격증|자격|소지자|소지|보유자|보유|취득자|취득|필수|우대|해당|조건|택일|택1|중에서|중|한개이상|한개|한가지|하나|둘다|모두|또는|혹은|및|요구)/g,""
    ).replace(/[\s.,:;·ㆍ()[\]{}\/|\-+]+/g,"");
    // Any remaining skill, education or experience condition blocks auto-success.
    if(remainder)return null;
    const matched=mentioned.filter(x=>owned.some(name=>normCert(name)===normCert(x.name)));
    if(!matched.length)return null;
    if(mentioned.length>1&&!alternatives&&matched.length!==mentioned.length)return null;
    const names=matched.map(x=>x.name);
    return {status:"충족",names,
      reason:"보유 자격증 입력란의 '"+names.join(", ")+"'와 공고의 자격증명이 일치합니다. 본인 입력 기준이며 증빙 및 공식 검증은 별도입니다."};
  }
  // Only an explicit, completed bachelor's degree can fulfill a standalone
  // "대졸 이상" requirement on a self-reported basis. Do not infer completion
  // from a school name, major, enrollment, expected graduation, or 2-year degree.
  function degreeTarget(text){
    return String(text||"").normalize("NFKC").replace(/\s+/g,"")
      .replace(/^[·ㆍ•*\-\d.)]+/,"").replace(/^(?:(?:최종)?학력)[:：]/,"")
      .replace(/[.!。]+$/,"");
  }
  function isUnrestrictedEducation(item){
    return !!item&&typeof item.text==="string"&&/^(?:학력무관|학력제한없음)$/.test(degreeTarget(item.text));
  }
  function degreeSuggestion(item,profileEducation){
    if(!item||typeof item.text!=="string")return null;
    const target=degreeTarget(item.text);
    // No academic threshold: this standalone eligibility item needs no CV
    // evidence, even if the education field was not filled in.
    if(/^(?:학력무관|학력제한없음)$/.test(target))
      return {status:"충족",reason:"공고에 학력 제한이 없다고 명시되어 있어 학위 보유 여부와 관계없이 학력 조건을 충족으로 표시합니다. 이는 학력 조건에 한정되며 다른 필수·우대요건은 별도 확인이 필요합니다."};
    if(typeof profileEducation!=="string"||!/^(?:대졸(?:이상|이상자)?|학사(?:학위)?(?:이상|이상자)?|4년제(?:대학(?:교)?)?졸업(?:이상|이상자)?)$/.test(target))return null;
    const education=profileEducation.normalize("NFKC").replace(/\s+/g,"");
    if(/재학|휴학|중퇴|자퇴|제적|수료|미졸업|비졸업|졸업예정|졸업유예|졸업전|졸업하지않|졸업못|학위미취득|학위취득예정|전문학사|전문대|2년제|3년제|고졸|고등학교/.test(education))return null;
    const bachelor=/(?:학사|4년제)/.test(education);
    const completed=/(?:졸업|학위취득|학위수여)/.test(education);
    if(!bachelor||!completed)return null;
    return {status:"충족",reason:"학력·전공 입력란에 학사 졸업 또는 학사학위 취득이 명시되어 '대졸 이상' 조건을 본인 입력 기준으로 충족 표시했습니다. 학력 증빙과 채용사 인정 여부는 별도 확인이 필요합니다."};
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
    function emitComparison(items){
      // Only this browser tab receives the in-memory assessment; no server request.
      window.dispatchEvent(new CustomEvent("muttaji:comparison-changed",{detail:{items}}));
    }
    function update(){
      const outcomes=collect();
      const total=tally(outcomes);
      const automatic=outcomes.filter((outcome,i)=>outcome.status==="충족" &&
        list.children[i]?.dataset.autoKind==="certificate" &&
        list.children[i]?.dataset.autoReason===outcome.explanation && !!outcome.explanation).length;
      const academic=outcomes.filter((outcome,i)=>outcome.status==="충족" &&
        list.children[i]?.dataset.autoKind?.startsWith("education") &&
        list.children[i]?.dataset.autoReason===outcome.explanation && !!outcome.explanation).length;
      summary.textContent="총 "+outcomes.length+"개 요건 · 충족 "+total["충족"]+" · 부분 충족 "+total["부분 충족"]+
        " · 미충족 "+total["미충족"]+" · 확인 필요 "+total["확인 필요"]+
        " · 자격증명 자동 일치 "+automatic+"개 · 학력 자동 일치 "+academic+"개. 사용자 입력 기준이며 학력·자격증 증빙 및 기업 인정·합격 가능성 판정이 아닙니다.";
      outcomes.forEach((outcome,i)=>{
        const card=list.children[i],flag=card.querySelector("[data-assessment-note]");
        const isAutomatic=outcome.status==="충족" &&
          card.dataset.autoReason===outcome.explanation && !!outcome.explanation;
        const autoNote=card.dataset.autoKind==="education-unrestricted"
          ?"학력 제한 없음 · 공고에 '학력무관'이 명시되어 학위와 관계없이 이 학력 조건을 충족합니다. 다른 지원 요건은 별도 확인이 필요합니다."
          :card.dataset.autoKind==="education"
          ?"학사 졸업 정보 자동 일치 · 본인 입력 기준이며 학위 증빙과 채용사 인정 여부는 별도 확인이 필요합니다."
          :"자격증명 자동 일치 · 보유 여부는 본인 입력 기준이며 실제 증빙은 별도 확인이 필요합니다.";
        if(flag)flag.textContent=outcome.needsReason
          ?"사유가 5자 이상 입력되기 전에는 '확인 필요'로 집계합니다."
          :(isAutomatic?autoNote
          :(outcome.status==="확인 필요"?"확인 필요: 입력하신 이력만으로 해당 요건 충족을 단정하지 않습니다."
          :"선택한 상태: "+outcome.status+" · 본인이 입력한 근거 기준"));
      });
      let explained=outcomes;
      const engine=window.MuttajiExperience;
      const notice=document.getElementById("experience-explanation-status");
      const containers=[...list.children].map(card=>card.querySelector("[data-experience-explanation]"));
      containers.forEach(container=>container?.replaceChildren());
      if(engine){
        try{
          const profile=Object.fromEntries(profileFields.map(id=>[id,String(document.getElementById(id)?.value||"")]));
          const analysis=engine.buildAnalysis({posting:job.value.trim(),requirements:current,profile,assessments:outcomes,certificateMatcher:certificateMatches});
          const byId=new Map(analysis.explanations.map(value=>[value.requirementId,value]));
          explained=outcomes.map(outcome=>({...outcome,experienceExplanation:byId.get(outcome.id)}));
          explained.forEach((item,i)=>{
            if(containers[i])engine.renderExplanation(document,containers[i],item.experienceExplanation);
          });
          if(notice)notice.textContent="입력 기반 연결 설명 · AI 의미 분석 아님. 직접 입력한 근거와 관련 프로필 문구를 연결하며, 선택한 상태는 바꾸지 않습니다.";
        }catch{
          explained=outcomes;
          containers.forEach(container=>container?.replaceChildren());
          if(notice)notice.textContent="연결 설명을 만들지 못했습니다. 입력한 상태와 근거는 그대로 비교·로드맵에 반영됩니다.";
        }
      }else if(notice)notice.textContent="연결 설명 기능을 불러오지 못했습니다. 기존 비교와 로드맵은 계속 사용할 수 있습니다.";
      const imported=window.MuttajiImportedPosting;
      if(imported?.reviewed===true&&imported.text===job.value.trim()){
        try{
          const source=new URL(imported.sourceUrl);
          if(source.protocol==="https:"&&!source.username&&!source.password)
            explained=explained.map(item=>({...item,postingSource:{url:source.href,method:imported.method,edited:imported.edited===true}}));
        }catch{}
      }
      emitComparison(explained);
    }
    function checkStale(){
      if(panel.hidden)return;
      if(job.value!==sourceText||snapshot()!==sourceProfile){
        panel.hidden=true;
        emitComparison(null);
        help.textContent="채용공고 또는 프로필이 변경되었습니다. 아래 '요건 비교하기'를 다시 눌러 최신 내용으로 검토하세요.";
        help.hidden=false;
      }
    }
    const button=document.getElementById("requirements-run");
    button.addEventListener("click",()=>{
      list.replaceChildren();panel.hidden=true;emitComparison(null);
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
        const certSuggestion=credentialSuggestion(item,document.getElementById("certs").value);
        const suggested=certSuggestion||degreeSuggestion(item,document.getElementById("education").value);
        select.value=suggested?suggested.status:"확인 필요";
        if(suggested){
          card.dataset.autoReason=suggested.reason;
          card.dataset.autoKind=certSuggestion?"certificate":isUnrestrictedEducation(item)?"education-unrestricted":"education";
        }
        selectLabel.appendChild(select);
        card.appendChild(selectLabel);
        const reasonLabel=el("label","label","판단 근거 또는 부족한 점");
        const reason=el("textarea","req-reason");reason.rows=3;
        reason.placeholder="예: 실제로 수행한 프로젝트, 취득 자격증, 확인할 경력 조건 또는 아직 경험이 없는 이유. 자격증과 실무경력은 구분해 주세요.";
        if(suggested)reason.value=suggested.reason;
        const reasonId="req-reason-"+i;reason.id=reasonId;reasonLabel.htmlFor=reasonId;reasonLabel.appendChild(reason);
        card.appendChild(reasonLabel);
        const note=el("small","subtext");note.dataset.assessmentNote="1";card.appendChild(note);
        const explanation=el("section","experience-explanation");
        explanation.dataset.experienceExplanation="1";card.appendChild(explanation);
        select.addEventListener("change",()=>{
          if(suggested && reason.value===suggested.reason)reason.value="";
          update();
        });
        reason.addEventListener("input",update);
        list.appendChild(card);
      });
      sourceText=job.value;sourceProfile=snapshot();help.hidden=true;
      panel.hidden=false;update();
      panel.scrollIntoView({behavior:"smooth",block:"start"});
    });
    job.addEventListener("input",checkStale);
    profileFields.forEach(id=>document.getElementById(id)?.addEventListener("input",checkStale));
    return {update,checkStale};
  }
  if(typeof document!=="undefined"&&typeof window!=="undefined")create();
  return {requirements,assessment,tally,credentialSuggestion,degreeSuggestion,isUnrestrictedEducation,ownedCertificates,certificateMatches};
});
