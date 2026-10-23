/* 뭐따지? · human-reviewed preparation plan, no AI, no private server calls.
 * No degree, certification or employment eligibility is auto-verified.
 */
(function(root,factory){
  "use strict";
  const api=factory();
  if(typeof module==="object"&&module.exports)module.exports=api;
  if(root)root.MuttajiRoadmap=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(){
  "use strict";
  const validStatuses=["확인 필요","충족","부분 충족","미충족"];
  const priority={"미충족":0,"부분 충족":1,"확인 필요":2,"충족":3};
  function norm(value){return String(value||"").normalize("NFKC").toLocaleLowerCase("ko-KR").replace(/\s+/g," ").trim();}
  function tokens(cert){
    const names=[cert.name,...String(cert.aliases||"").split(";")];
    return [...new Set(names.map(norm).filter(x=>x.length>=3&&x!=="추후 확인"))];
  }
  function explicitCertMatches(requirement,certifications,profileCerts){
    const text=norm(requirement),held=norm(profileCerts);
    return (Array.isArray(certifications)?certifications:[]).filter(cert=>{
      if(!cert||typeof cert.name!=="string"||cert.verification_status!=="needs_official_review")return false;
      // "ISMS-P 인증심사원" may be a role/qualification rather than a
      // conventional licensable examination, so do not auto-suggest it.
      if(cert.name==="ISMS-P 인증심사원")return false;
      return tokens(cert).some(t=>text.includes(t));
    }).slice(0,5).map(cert=>({
      id:cert.id,name:cert.name,field:cert.field||"분야 확인 필요",
      official_url:/^https:\/\/[a-z0-9.-]+(?:\/|$)/i.test(cert.official_url||"")?cert.official_url:null,
      heldClaim:tokens(cert).some(t=>held.includes(t)),
      verification:"공식 세부정보 미검증 · 원문 자격요건과 별도 대조 필요"
    }));
  }
  // Small, explainable, human-review-only links. Both the exact requirement
  // phrase and an exact skills field token must be present, no AI inference.
  const skillRules=[
    {id:"privacy",pattern:/개인정보(?:보호|처리|관리|영향평가|보안)/i,skills:["개인정보보호"],fields:["개인정보보호"],limit:1},
    {id:"privacyLaw",pattern:/개인정보\s*보호법/i,skills:["개인정보보호법"],fields:["개인정보보호"],limit:1},
    {id:"networkSecurity",pattern:/네트워크\s*보안/i,skills:["네트워크보안"],fields:["정보보안","네트워크"],limit:2},
    {id:"systemSecurity",pattern:/시스템\s*보안/i,skills:["시스템보안"],fields:["정보보안","시스템"],limit:2},
    {id:"vulnerability",pattern:/취약점\s*(?:분석|진단|점검)/i,skills:["취약점분석"],fields:["정보보안"],limit:1},
    {id:"sql",pattern:/(?:^|[^a-z0-9])sql(?![a-z0-9])/i,skills:["SQL"],fields:["데이터"],limit:1},
    {id:"database",pattern:/데이터베이스|(?:^|[^a-z])dbms(?![a-z])/i,skills:["데이터베이스"],fields:["데이터","IT"],limit:2},
    {id:"linux",pattern:/리눅스|linux/i,skills:["Linux"],fields:["시스템"],limit:1},
    {id:"networkBuild",pattern:/네트워크\s*구축/i,skills:["네트워크구축"],fields:["네트워크"],limit:1},
    {id:"networkDesign",pattern:/네트워크\s*설계/i,skills:["네트워크설계"],fields:["네트워크"],limit:1},
    {id:"dataAnalysis",pattern:/데이터\s*분석/i,skills:["데이터분석"],fields:["데이터분석"],limit:1},
    {id:"cloud",pattern:/클라우드\s*(?:기초|개념|이해)/i,skills:["클라우드개념"],fields:["클라우드"],limit:2}
  ];
  function relatedSkillCandidates(requirement,certifications,profileCerts,alreadyNamed){
    if(!Array.isArray(certifications))return [];
    const text=String(requirement||"");
    // A qualification cannot substitute for required years or hands-on work.
    if(/(?:실무\s*경력|동종\s*경력|경력\s*[0-9]|[0-9]+\s*년\s*이상|구축\s*및\s*유지관리\s*경험|[가-힣]+\s*경험\s*보유)/i.test(text))return [];
    const results=[],seen=new Set(alreadyNamed||[]);
    for(const rule of skillRules){
      const match=text.match(rule.pattern);
      if(!match)continue;
      let count=0;
      for(const cert of certifications){
        if(count>=rule.limit||results.length>=3)break;
        if(!cert||cert.verification_status!=="needs_official_review"||
           cert.name==="ISMS-P 인증심사원"||seen.has(cert.name)||
           !rule.fields.includes(cert.field))continue;
        const fields=String(cert.skills||"").split(";").map(norm);
        const tag=rule.skills.find(skill=>fields.includes(norm(skill)));
        if(!tag)continue;
        seen.add(cert.name);count++;
        results.push({
          id:cert.id,name:cert.name,field:cert.field||"분야 확인 필요",
          official_url:/^https:\/\/[a-z0-9.-]+(?:\/|$)/i.test(cert.official_url||"")?cert.official_url:null,
          heldClaim:tokens(cert).some(t=>norm(profileCerts).includes(t)),
          relation:"related_skill",matchedPhrase:match[0].trim(),skillEvidence:tag,
          verification:"사용자 작성 DB의 관련 역량 참고 후보 · 공식 정보 미검증 · 자격요건 충족 의미 아님"
        });
      }
      if(results.length>=3)break;
    }
    return results;
  }
  function action(item){
    const t=norm(item.text),s=item.status;
    if(s==="충족")return "직접 선택하신 충족 판단의 근거 문서·수행 역할·기간을 정리하고, 공고의 표현과 정확히 일치하는지 재확인하세요.";
    if(s==="확인 필요")return "공고의 요구 범위와 본인의 실제 수행 업무·자격·경력 기간을 대조하세요. 확인할 수 없는 부분은 채용 담당자에게 문의할 질문으로 남기세요.";
    if(/(?:경력|연차|[0-9]+\s*년|구축.*경험|운영.*경험|실무\s*경험)/i.test(t))
      return "공고가 요구하는 실제 실무 경험의 종류·기간을 따로 확인하세요. 관련 실습·프로젝트는 경험 보완 자료로 정리하되, 이를 기업이 요구하는 실무 경력으로 대체했다고 주장하지 마세요.";
    if(/(?:자격증|기사|산업기사|certified|cissp|cppg|sqld)/i.test(t))
      return "해당 자격의 공식 시행처·응시요건·유효성을 확인하고, 실제 취득 여부와 공고 요구사항을 구분해 기록하세요.";
    if(/(?:점검|취약점|보안|네트워크|서버|DBMS|개인정보|ISMS|ISO|개발|로그|클라우드|모바일|웹|분석)/i.test(t))
      return "요구 역량에 해당하는 실습·프로젝트를 정하고, 직접 수행한 범위와 설정·점검 결과를 기록하세요. 지원서에는 확인 가능한 사실만 반영하세요.";
    return "요구사항을 구체적인 학습·실습 또는 자료 준비 과제로 나누고, 수행 여부를 확인할 수 있는 근거를 남기세요.";
  }
  function build(items,certifications,profileCerts){
    if(!Array.isArray(items))throw new TypeError("비교 결과를 먼저 생성해 주세요.");
    const filtered=items.filter(item=>item&&["required","preferred"].includes(item.kind)&&validStatuses.includes(item.status));
    const ordered=filtered.map((item,index)=>({item,index})).sort((a,b)=>{
      const aGroup=a.item.kind==="required"?0:1,bGroup=b.item.kind==="required"?0:1;
      return aGroup-bGroup || priority[a.item.status]-priority[b.item.status]||a.index-b.index;
    });
    return ordered.map(({item},index)=>{
      const directlyNamed=explicitCertMatches(item.text,certifications,profileCerts)
        .map(c=>({...c,relation:"explicit",matchedPhrase:c.name,skillEvidence:null}));
      const related=item.status==="충족"?[]:
        relatedSkillCandidates(item.text,certifications,profileCerts,directlyNamed.map(c=>c.name));
      return {sequence:index+1,kind:item.kind,status:item.status,
        requirement:String(item.text||""),line:item.line??null,
        reason:String(item.explanation||""),action:action(item),
        certificates:[...directlyNamed,...related],requiresValidation:true};
    });
  }
  function create(){
    const generate=document.getElementById("roadmap-generate");
    const warning=document.getElementById("roadmap-message");
    const output=document.getElementById("roadmap-result");
    const count=document.getElementById("roadmap-count");
    const list=document.getElementById("roadmap-actions");
    const job=document.getElementById("job-text");
    if(!generate||!warning||!output||!count||!list||!job)return null;
    function el(tag,cls,text){
      const node=document.createElement(tag);
      if(cls)node.className=cls;
      if(text!=null)node.textContent=String(text);
      return node;
    }
    function reset(message){
      output.hidden=true;list.replaceChildren();
      warning.hidden=false;warning.textContent=message;
    }
    async function generatePlan(){
      const snapshot=window.MuttajiComparisonSnapshot;
      if(!snapshot||snapshot.posting!==job.value ||
         !Array.isArray(snapshot.items)){
        reset("최신 채용공고와 '내 역량' 비교 결과가 없습니다. 내 역량에서 요건별 상태·근거를 확인하고 다시 시도해 주세요.");
        return;
      }
      generate.disabled=true;
      warning.hidden=false;warning.textContent="현재 비교 결과를 준비 로드맵으로 정리하고 있습니다.";
      try{
        let certifications=[];
        try{
          const response=await fetch("./data/certifications.json");
          if(!response.ok)throw new Error("data unavailable");
          const data=await response.json();
          if(!Array.isArray(data.certifications)||data.certifications.length!==23)throw new Error("catalog invalid");
          certifications=data.certifications;
        }catch{
          // The roadmap must still work offline without a certification list.
          warning.textContent="자격증 DB를 불러오지 못했습니다. 자격증 연결 없이 준비 순서만 안내합니다.";
        }
        const steps=build(snapshot.items,certifications,snapshot.profileCerts||"");
        if(!steps.length){reset("검토할 필수·우대 요건이 없습니다. 채용공고 분류를 확인해 주세요.");return;}
        list.replaceChildren();
        steps.forEach(step=>{
          const card=el("article","req-item");
          card.appendChild(el("h3","", "STEP "+step.sequence+" · "+
            (step.kind==="required"?"필수조건":"우대사항")+" · "+step.status));
          card.appendChild(el("p","req-source",step.requirement));
          const details=el("p","req-explain",step.action);card.appendChild(details);
          if(step.reason){
            card.appendChild(el("p","subtext","직접 작성한 비교 근거: "+step.reason));
          }
          if(step.certificates.length){
            const section=el("div","roadmap-certs");
            section.appendChild(el("strong","", "자격증 DB 연결 · 공고 직접 언급 / 관련 역량 참고 (공식 검증 전)"));
            for(const cert of step.certificates){
              const text=cert.name+(cert.heldClaim?" · 보유 입력에 언급됨":" · 실제 보유·응시 가능 여부 확인");
              const p=el("p","roadmap-cert-item",text);
              p.appendChild(el("small","subtext",cert.relation==="related_skill"
                ?"관련 역량 참고: 공고 표현 '"+cert.matchedPhrase+"' ↔ DB 기술 '"+cert.skillEvidence+"' · 채용요건 충족과 무관"
                :"공고에 자격증명이 직접 등장 · 취득·공식 요건 확인 필요"));
              if(cert.official_url){
                const a=el("a","","입력된 운영기관 홈페이지 ↗");
                a.href=cert.official_url;a.target="_blank";a.rel="noopener noreferrer";
                p.appendChild(a);
              }
              section.appendChild(p);
            }
            section.appendChild(el("small","subtext","DB의 관련 역량 태그와 공고 원문만으로 연결한 참고 후보입니다. 공식 정보 미검증이며 자격 취득·응시 가능 여부 또는 실무경력을 인정하지 않습니다."));
            card.appendChild(section);
          }
          list.appendChild(card);
        });
        count.textContent="검토한 요건 "+steps.length+"개 · 필수조건 우선 정렬 · 사용자가 선택한 상태를 기반으로 정리한 실행 후보입니다. 자동 채용 적합도 평가가 아닙니다.";
        output.hidden=false;
        if(certifications.length)warning.hidden=true;
        output.scrollIntoView({behavior:"smooth",block:"start"});
      }catch(error){
        reset("준비 순서를 표시하지 못했습니다. 비교 결과를 다시 확인해 주세요.");
      }finally{generate.disabled=false;}
    }
    generate.addEventListener("click",generatePlan);
    job.addEventListener("input",()=>{if(!output.hidden)reset("채용공고가 바뀌었습니다. 비교를 다시 실행한 뒤 로드맵을 생성해 주세요.");});
    return {generatePlan};
  }
  if(typeof document!=="undefined"&&typeof window!=="undefined")create();
  return {build,explicitCertMatches,relatedSkillCandidates,action};
});
