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
  // ASCII certificate acronyms must stand alone: "SIS" is not the "sis"
  // inside an unrelated English word such as "analysis".
  function containsCertToken(haystack,needle){
    if(!needle)return false;
    let from=0,at;
    while((at=haystack.indexOf(needle,from))!==-1){
      const before=at===0?"":haystack[at-1];
      const after=at+needle.length>=haystack.length?"":haystack[at+needle.length];
      if((!/[a-z0-9]/.test(needle[0])||!/[a-z0-9]/.test(before)) &&
         (!/[a-z0-9]/.test(needle[needle.length-1])||!/[a-z0-9]/.test(after)))
        return true;
      from=at+1;
    }
    return false;
  }
  function explicitCertMatches(requirement,certifications,profileCerts){
    const text=norm(requirement),held=norm(profileCerts);
    return (Array.isArray(certifications)?certifications:[]).filter(cert=>{
      if(!cert||typeof cert.name!=="string"||cert.verification_status!=="needs_official_review")return false;
      // "ISMS-P 인증심사원" may be a role/qualification rather than a
      // conventional licensable examination, so do not auto-suggest it.
      if(cert.name==="ISMS-P 인증심사원")return false;
      return tokens(cert).some(t=>containsCertToken(text,t));
    }).slice(0,5).map(cert=>({
      id:cert.id,name:cert.name,field:cert.field||"분야 확인 필요",
      official_url:/^https:\/\/[a-z0-9.-]+(?:\/|$)/i.test(cert.official_url||"")?cert.official_url:null,
      heldClaim:tokens(cert).some(t=>containsCertToken(held,t)),
      verification:"공식 세부정보 미검증 · 원문 자격요건과 별도 대조 필요"
    }));
  }
  // Only group alternatives explicitly joined by "or"/"또는"/"혹은".
  // This is an informational label; never infer eligibility from this alone.
  function alternativeCertGroups(requirement,named){
    if(!Array.isArray(named)||named.length<2)return [];
    const text=norm(requirement);
    const occurrences=named.map(cert=>{
      const needle=norm(cert.name),start=text.indexOf(needle);
      return {name:cert.name,start,end:start+needle.length};
    }).filter(x=>x.start>=0).sort((a,b)=>a.start-b.start);
    const groups=[];
    let current=[];
    for(let i=1;i<occurrences.length;i++){
      const left=occurrences[i-1],right=occurrences[i];
      const joiner=text.slice(left.end,right.start);
      if(/^\s*(?:or|또는|혹은)\s*$/i.test(joiner)){
        if(!current.length)current=[left.name];
        if(!current.includes(right.name))current.push(right.name);
      }else if(current.length>=2){
        groups.push(current);current=[];
      }
    }
    if(current.length>=2)groups.push(current);
    return groups;
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
    if(/(?:실무\s*경력|동종\s*경력|경력\s*[0-9]|[0-9]+\s*년\s*이상|구축\s*및\s*유지관리\s*경험|[가-힣]+\s*경험\s*보유|인증\s*심사원|전문인력|보안약점\s*진단원)/i.test(text))return [];
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
          heldClaim:tokens(cert).some(t=>containsCertToken(norm(profileCerts),t)),
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
      const alternativeGroups=alternativeCertGroups(item.text,directlyNamed);
      const related=item.status==="충족"?[]:
        relatedSkillCandidates(item.text,certifications,profileCerts,directlyNamed.map(c=>c.name));
      return {sequence:index+1,kind:item.kind,status:item.status,
        requirement:String(item.text||""),line:item.line??null,
        reason:String(item.explanation||""),action:action(item),
        certificates:[...directlyNamed,...related],alternativeCertGroups:alternativeGroups,requiresValidation:true};
    });
  }
  const taskCategories=["학습","프로젝트","자격증","지원 준비"];
  const experiencePattern=/(?:실무\s*경력|동종\s*경력|경력\s*[0-9]|[0-9]+\s*년\s*이상|구축\s*및\s*유지관리\s*경험|[가-힣]+\s*경험\s*보유)/i;
  const practicePattern=/(?:점검|취약점|분석|네트워크|서버|보안|로그|클라우드|DBMS|데이터베이스|SQL|웹|모바일|Linux|리눅스|프로그래밍|개발|운영|구축|실습)/i;
  const certificatePattern=/(?:자격증|기사|산업기사|자격\s*보유|certification|certified|cissp|cppg|sqld)/i;
  function planTasks(steps){
    if(!Array.isArray(steps))throw new TypeError("로드맵이 없습니다.");
    const tasks=[];
    for(const step of steps){
      if(!step||!Number.isInteger(step.sequence)||step.sequence<1||
         !validStatuses.includes(step.status)||!["required","preferred"].includes(step.kind))continue;
      const isExperience=experiencePattern.test(step.requirement);
      const namedCerts=Array.isArray(step.certificates)?
        step.certificates.filter(c=>c&&c.relation==="explicit"):[];
      const hasCertificate=certificatePattern.test(step.requirement)||namedCerts.length>0;
      const isPractice=practicePattern.test(step.requirement);
      // "정보보안기사 취득" is a certification condition, NOT a project task.
      const onlyCertificate=hasCertificate &&
        !/(?:점검|분석|개발|구축|운영|실무|프로젝트|설계|기술|실습|유지보수|설정)/i.test(step.requirement);
      function add(category,key,title,detail){
        tasks.push({
          id:"step-"+step.sequence+"-"+key,category,title,detail,
          priority:step.sequence,kind:step.kind,status:step.status,
          requirement:step.requirement,line:step.line
        });
      }
      if(step.status==="충족"){
        add("지원 준비","evidence","입력한 충족 근거 정리",
          "수행 역할·기간·성과를 확인 가능한 자료로 정리하고, 공고 요건과 다시 대조하세요.");
      }else if(step.status==="확인 필요"){
        add("지원 준비","verify","충족 여부와 요구 범위 확인",
          "경력·자격·업무 범위를 원문과 비교하세요. 불분명하면 채용담당자에게 확인할 질문을 기록하세요.");
      }else if(isExperience){
        add("지원 준비","experience","실제 실무경력 조건 확인",
          "실제로 수행한 직무·근무기간·고용 형태가 공고 요건에 해당하는지 확인하세요. 실습이나 자격증을 동등한 경력이라고 주장하지 마세요.");
      }else if(!isPractice&&!hasCertificate){
        add("지원 준비","gap","부족한 조건과 증빙 준비",
          "요건에서 부족한 사항을 확인하고, 실제로 수행했거나 취득한 사실만 지원 자료에 작성하세요.");
      }
      if(step.status==="미충족"||step.status==="부분 충족"){
        if(isPractice&&!isExperience&&!onlyCertificate){
          add("학습","learn","요구 기술·용어 학습",
            "공고에 나온 기술·점검 방법을 공부하고, 이해한 내용을 본인 언어로 요약하세요.");
          add("프로젝트","practice","직접 수행하는 실습 과제",
            "요구역량과 관련된 작은 실습을 직접 수행하고 설정·점검 기록과 본인 기여를 남기세요. 실습은 실무경력의 대체가 아닙니다.");
        }
      }
      // Explicit certificate names are employer requirements; related ones
      // are only background reading candidates from an unverified workbook.
      const cands=Array.isArray(step.certificates)?step.certificates:[];
      const groupedNames=new Set();
      for(const group of (step.alternativeCertGroups||[])){
        if(!Array.isArray(group)||group.length<2)continue;
        for(const name of group)groupedNames.add(name);
        add("자격증","choose-"+group.join("-"),"공고 명시 자격 확인(택1): "+group.join(" 또는 "),
          "공고에서 'or/또는'로 연결된 대체 자격입니다. 모두 취득할 필요는 없지만 전공·학력 등 공고의 다른 조건은 별도 확인해야 합니다. 발급기관 공식 요건과 실제 취득 여부를 확인하세요.");
      }
      for(const cert of cands.filter(c=>c&&c.relation==="explicit"&&!groupedNames.has(c.name)).slice(0,2)){
        add("자격증","explicit-"+String(cert.id),"공고 명시 자격 확인: "+cert.name,
          "발급기관의 최신 공식 요건을 확인하고 실제 취득 여부·유효성을 따로 기록하세요.");
      }
      if(step.status!=="충족"&&!isExperience){
        const related=cands.find(c=>c&&c.relation==="related_skill");
        if(related)add("자격증","related-"+String(related.id),"관련 자격 참고 검토: "+related.name,
          "공고 문구 '"+related.matchedPhrase+"'와 DB 역량 '"+related.skillEvidence+"'의 관련성을 본인이 검토하세요. 공식 정보 검증 전이며 채용요건 충족을 뜻하지 않습니다.");
      }
    }
    return tasks;
  }
  function taskCounts(tasks,completed){
    const checked=completed instanceof Set?completed:new Set(completed||[]);
    const counts={total:tasks.length,done:0,byCategory:{}};
    for(const name of taskCategories)counts.byCategory[name]={total:0,done:0};
    for(const task of tasks){
      if(!counts.byCategory[task.category])continue;
      counts.byCategory[task.category].total++;
      if(checked.has(task.id)){counts.done++;counts.byCategory[task.category].done++;}
    }
    return counts;
  }
  function formatChecklist(tasks,completed){
    const checked=completed instanceof Set?completed:new Set(completed||[]);
    const lines=["뭐따지? · 직접 확인하는 취업 준비 체크리스트",
      "※ AI 분석이나 채용요건 충족 판정이 아닙니다. 자격증 정보는 공식 검증 전입니다.",""];
    for(const category of taskCategories){
      lines.push("["+category+"]");
      const group=tasks.filter(t=>t.category===category);
      if(!group.length)lines.push("- 해당 작업 없음");
      for(const task of group){
        const mark=checked.has(task.id)?"x":" ";
        lines.push("- ["+mark+"] 우선 "+task.priority+" · "+task.title);
        lines.push("  요건: "+task.requirement);
        lines.push("  실행: "+task.detail);
      }
      lines.push("");
    }
    return lines.join("\n");
  }
  function create(){
    const generate=document.getElementById("roadmap-generate");
    const warning=document.getElementById("roadmap-message");
    const output=document.getElementById("roadmap-result");
    const count=document.getElementById("roadmap-count");
    const list=document.getElementById("roadmap-actions");
    const job=document.getElementById("job-text");
    const board=document.getElementById("roadmap-task-board");
    const progress=document.getElementById("roadmap-task-progress");
    const copyButton=document.getElementById("roadmap-copy");
    const copyMessage=document.getElementById("roadmap-copy-message");
    if(!generate||!warning||!output||!count||!list||!job||
       !board||!progress||!copyButton||!copyMessage)return null;
    let activeTasks=[],checkedTasks=new Set();
    function el(tag,cls,text){
      const node=document.createElement(tag);
      if(cls)node.className=cls;
      if(text!=null)node.textContent=String(text);
      return node;
    }
    function reset(message){
      output.hidden=true;list.replaceChildren();board.replaceChildren();
      activeTasks=[];checkedTasks=new Set();copyMessage.textContent="";progress.textContent="";
      warning.hidden=false;warning.textContent=message;
    }
    function updateProgress(){
      const stats=taskCounts(activeTasks,checkedTasks);
      progress.textContent="실행 항목 "+stats.total+"개 중 직접 체크한 항목 "+
        stats.done+"개 · 완료 표시가 채용조건 충족을 의미하지는 않습니다.";
      for(const cat of taskCategories){
        const counter=document.getElementById("task-count-"+({"학습":"learning","프로젝트":"project","자격증":"certificate","지원 준비":"application"}[cat]));
        if(counter)counter.textContent=stats.byCategory[cat].done+" / "+stats.byCategory[cat].total;
      }
    }
    function showTasks(steps){
      activeTasks=planTasks(steps);
      checkedTasks=new Set();copyMessage.textContent="";
      board.replaceChildren();
      const groupIds={"학습":"learning","프로젝트":"project","자격증":"certificate","지원 준비":"application"};
      for(const cat of taskCategories){
        const group=el("section","roadmap-task-group");
        const heading=el("h3","roadmap-task-heading",cat+" · ");
        const counter=el("span","roadmap-task-count","0 / 0");
        counter.id="task-count-"+groupIds[cat];
        heading.appendChild(counter);
        group.appendChild(heading);
        const tasks=activeTasks.filter(t=>t.category===cat);
        if(!tasks.length)group.appendChild(el("p","subtext","현재 비교 결과에서 생성된 실행 항목이 없습니다."));
        for(const task of tasks){
          const label=el("label","roadmap-task");
          const checkbox=el("input");checkbox.type="checkbox";
          checkbox.checked=false;checkbox.setAttribute("aria-label",task.title+" 완료 표시");
          const body=el("span","roadmap-task-body");
          body.appendChild(el("strong","", "우선 "+task.priority+" · "+task.title));
          body.appendChild(el("small","roadmap-task-requirement","공고 요건: "+task.requirement));
          body.appendChild(el("small","roadmap-task-detail",task.detail));
          label.appendChild(checkbox);label.appendChild(body);
          checkbox.addEventListener("change",()=>{
            if(checkbox.checked)checkedTasks.add(task.id);
            else checkedTasks.delete(task.id);
            copyMessage.textContent="";
            updateProgress();
          });
          group.appendChild(label);
        }
        board.appendChild(group);
      }
      updateProgress();
    }
    copyButton.addEventListener("click",async ()=>{
      if(!activeTasks.length){copyMessage.textContent="먼저 로드맵을 생성해 주세요.";return;}
      try{
        if(!navigator.clipboard||!navigator.clipboard.writeText)throw new Error("CLIPBOARD_UNAVAILABLE");
        await navigator.clipboard.writeText(formatChecklist(activeTasks,checkedTasks));
        copyMessage.textContent="현재 체크 상태를 포함한 준비 목록을 복사했습니다. 원하는 문서에 직접 붙여넣어 보관하세요.";
      }catch{
        copyMessage.textContent="브라우저에서 복사할 수 없습니다. 체크리스트 내용을 직접 선택해 복사해 주세요.";
      }
    });
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
        if(window.MuttajiComparisonSnapshot!==snapshot || job.value!==snapshot.posting){
          reset("비교 결과가 변경됐습니다. 최신 요건 비교를 확인하고 로드맵을 다시 생성해 주세요.");
          return;
        }
        const steps=build(snapshot.items,certifications,snapshot.profileCerts||"");
        if(!steps.length){reset("검토할 필수·우대 요건이 없습니다. 채용공고 분류를 확인해 주세요.");return;}
        list.replaceChildren();
        showTasks(steps);
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
            for(const group of (step.alternativeCertGroups||[])){
              section.appendChild(el("p","review-note","원문에 명시된 대체 자격(택1): "+group.join(" 또는 ")+". 전공·학력 등 다른 요구사항도 별도로 확인하세요."));
            }
            for(const cert of step.certificates){
              const text=cert.name+(cert.heldClaim?" · 자격증 입력란에 이름 있음(취득 확인 필요)":" · 실제 보유·응시 가능 여부 확인");
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
  return {build,explicitCertMatches,alternativeCertGroups,relatedSkillCandidates,action,planTasks,taskCounts,formatChecklist,taskCategories};
});
