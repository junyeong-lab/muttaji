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
  // A certificate match means user-reported name equality, not verified possession.
  const catalog=[
    ["정보처리기사","정처기"],["정보보안기사"],["정보보안산업기사"],
    ["네트워크관리사 1급","네관사 1급"],["네트워크관리사 2급","네관사 2급"],
    ["리눅스마스터 1급"],["리눅스마스터 2급"],["SQLD","SQL 개발자"],
    ["SQLP","SQL 전문가"],["ADsP","데이터분석 준전문가"],["ADP","데이터분석 전문가"],
    ["CPPG","개인정보관리사"],["정보통신기사"],["빅데이터분석기사"],
    ["컴퓨터활용능력 1급","컴활1급","컴활 1급"],["컴퓨터활용능력 2급","컴활2급","컴활 2급"],
    ["AWS Certified Cloud Practitioner","AWS CCP"],
    ["AWS Certified Solutions Architect - Associate","AWS SAA"],
    ["Microsoft Azure Fundamentals (AZ-900)","AZ-900"],["ISMS-P 인증심사원"],
    ["CompTIA Security+","Security+"],["Cisco CCNA","CCNA"],["CISSP"]
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
  function credentialSuggestion(item,profileCertificates){
    if(!item||typeof item.text!=="string"||!String(profileCertificates||"").trim())return null;
    const owned=ownedCertificates(profileCertificates);
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
    function update(){
      const outcomes=collect();
      const total=tally(outcomes);
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
      if(panel.hidden)return;
      if(job.value!==sourceText||snapshot()!==sourceProfile){
        panel.hidden=true;
        help.textContent="채용공고 또는 프로필이 변경되었습니다. 아래 '요건 비교하기'를 다시 눌러 최신 내용으로 검토하세요.";
        help.hidden=false;
      }
    }
    const button=document.getElementById("requirements-run");
    button.addEventListener("click",()=>{
      list.replaceChildren();panel.hidden=true;
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
        select.value="확인 필요";
        selectLabel.appendChild(select);
        card.appendChild(selectLabel);
        const reasonLabel=el("label","label","판단 근거 또는 부족한 점");
        const reason=el("textarea","req-reason");reason.rows=3;
        reason.placeholder="예: 실제로 수행한 프로젝트, 취득 자격증, 확인할 경력 조건 또는 아직 경험이 없는 이유. 자격증과 실무경력은 구분해 주세요.";
        const reasonId="req-reason-"+i;reason.id=reasonId;reasonLabel.htmlFor=reasonId;reasonLabel.appendChild(reason);
        card.appendChild(reasonLabel);
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
    profileFields.forEach(id=>document.getElementById(id)?.addEventListener("input",checkStale));
    return {update,checkStale};
  }
  if(typeof document!=="undefined"&&typeof window!=="undefined")create();
  return {requirements,assessment,tally,credentialSuggestion,ownedCertificates};
});
