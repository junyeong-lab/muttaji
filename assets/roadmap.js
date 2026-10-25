/* 뭐따지? · 공고 요건과 본인 자체 점검 결과를 연결한 로컬 준비 순서.
 * AI 호출, 서버 전송, 영구 저장, 임의 기간/합격 확률 산출 없음.
 */
(function(root,factory){
  "use strict";
  const api=factory();
  if(typeof module==="object"&&module.exports)module.exports=api;
  if(root)root.MuttajiRoadmap=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(){
  "use strict";
  // Keep all four states visible in user-requested order.
  const states=["확인 필요","미충족","부분 충족","충족"];
  const order={"확인 필요":0,"미충족":1,"부분 충족":2,"충족":3};
  function nextAction(item){
    if(item.status==="확인 필요")
      return "공고 원문과 본인의 실제 이력·증빙을 대조하고, 내 역량 화면에서 상태를 직접 확정하세요.";
    if(item.status==="부분 충족")
      return "이미 갖춘 부분과 부족한 조건을 구분하세요. 부족한 부분에 대한 학습·경험 또는 추가 확인 계획을 정리하세요.";
    const text=item.text;
    if(/경력|실무\s*경험|\d+\s*년\s*이상/.test(text))
      return "요구 경력의 종류·기간을 확인하세요. 부족한 실무 경력을 자격증이나 프로젝트로 대체할 수 있다고 단정하지 말고 채용 기준을 확인하세요.";
    if(/학력|전공|졸업|학사|석사/.test(text))
      return "공고의 학력·전공 기준과 실제 학력을 대조하고, 지원 가능한 조건인지 채용 담당자 또는 공식 안내에서 확인하세요.";
    if(/자격증|자격|기사|기능사|관리사|마스터|certified|certification|SQLD|ADsP|CPPG|CISSP|CCNA/i.test(text))
      return "공고에 명시된 자격증명을 확인하세요. 필요하면 공식 시행기관에서 취득 요건·일정을 확인해 준비 계획을 세우세요.";
    return "공고에서 요구한 역량의 구체적인 범위를 확인하고, 학습·실습·실무 경험 중 무엇을 보완해야 하는지 정리하세요.";
  }
  // Rule-based, evidence-first examples. Never infer skills, dates or job eligibility.
  function preparationSteps(item){
    if(!item||item.status==="충족")return [];
    const text=String(item.text||"").normalize("NFKC");
    let guide;
    // Work-experience duration and educational credentials must not be replaced by lab work.
    if(/경력|실무\s*(?:경험|경력)|\d+\s*년\s*이상/.test(text)){
      guide={
        scope:"공고가 요구하는 실무 분야, 담당업무와 경력 기간을 구분해 확인하세요.",
        evidence:"실제 업무별 수행 기간과 본인 역할을 정리하고 경력증명·업무 기록처럼 확인 가능한 근거가 있는지 점검하세요.",
        prepare:"관련 실습이나 프로젝트는 별도로 정리하되, 실습·자격증이 실무 경력을 대체한다고 가정하지 마세요. 인정 기준은 채용 담당자에게 확인하세요."
      };
    }else if(/학력|전공|졸업|학사|석사/.test(text)){
      guide={
        scope:"공고의 학위·전공·졸업 조건이 필수인지 우대인지 정확히 확인하세요.",
        evidence:"졸업 상태·학위·전공과 제출 가능한 증빙을 실제 이력과 대조하세요.",
        prepare:"해석이 애매하거나 기준에 차이가 있으면 채용 공고의 공식 안내나 담당자에게 인정 범위를 확인하세요."
      };
    }else if(/자격증|자격\s*(?:보유|취득)|기사|기능사|관리사|마스터|certified|certification|SQLD|ADsP|CPPG|CISSP|CCNA/i.test(text)){
      guide={
        scope:"공고에 적힌 자격증의 정확한 명칭과 필수·우대 여부를 먼저 확인하세요.",
        evidence:"이미 취득했다면 증명서의 종목·취득일을 대조하고, 미보유라면 현재 상태를 구분하세요.",
        prepare:"미보유 자격은 공식 시행기관에서 시험과 응시 요건을 확인하고 준비 항목을 정리하세요. 앱의 자격증 DB는 공식 검증 전입니다."
      };
    }else if(/\bAWS\b|아마존\s*웹\s*서비스/i.test(text)){
      guide={
        scope:"AWS 보안 운영 중 IAM 권한·CloudTrail 기록·보안 그룹 설정 등 공고가 요구한 범위를 확인하세요.",
        evidence:"본인이 직접 다룬 IAM 정책, 감사 로그, 네트워크 접근 설정과 점검 결과를 실습/실무로 구분해 정리하세요.",
        prepare:"공개 예제 정책·샘플 로그 또는 승인된 실습 환경에서 과도한 IAM 권한과 보안 그룹 노출 여부를 점검하고 점검표를 작성하세요. 비용 및 권한 변경에 주의하세요."
      };
    }else if(/Wazuh/i.test(text)){
      guide={
        scope:"Wazuh에서 에이전트 연결·로그 수집·경보 분석 중 어떤 업무가 필요한지 확인하세요.",
        evidence:"직접 연결한 로그 소스와 확인한 경보·조치 사례를 정리하고 실습과 실제 업무를 구분하세요.",
        prepare:"승인된 테스트 환경의 Windows 로그인 실패 또는 Linux 인증 로그로 수집→경보 확인→원인 기록 과정을 재현하고 화면을 남기세요. 실습을 실무 경력이라고 표시하지 마세요."
      };
    }else if(/\bSIEM\b|보안\s*관제|로그\s*(?:분석|모니터링)/i.test(text)){
      guide={
        scope:"공고가 요구하는 로그 수집·탐지 규칙·경보 분석·사고 보고의 업무 범위를 확인하세요.",
        evidence:"사용한 로그 소스, 직접 분석한 이벤트, 작성한 탐지/분석 기록을 실습과 업무별로 구분하세요.",
        prepare:"예제 인증 로그에서 이상 징후를 찾아 탐지 조건과 오탐 가능성, 대응 의견을 한 장의 분석 기록으로 작성하세요."
      };
    }else if(/\bEDR\b|엔드포인트\s*(?:탐지|보안|보호)/i.test(text)){
      guide={
        scope:"EDR 경보 모니터링·원인 분석·정책 운영 중 요구하는 업무를 구분하세요.",
        evidence:"다뤄본 솔루션의 알림 분석, 정책 변경, 사용자 지원 경험의 범위와 증빙을 정리하세요.",
        prepare:"공개된 예제 경보 또는 승인된 테스트 환경에서 프로세스·파일·시간 정보를 검토하고 경보 분류와 조치 의견을 기록하세요."
      };
    }else if(/취약점|보안\s*(?:점검|진단|감사)|정보보호\s*컨설팅|ISMS|ISO\s*27001|보안\s*정책/i.test(text)){
      guide={
        scope:"공고가 요구하는 보안 점검 대상, 평가 기준 및 산출물 범위를 확인하세요.",
        evidence:"직접 수행한 자산·설정·취약점 점검과 개선 조치 기록을 실습/실무로 구분해 정리하세요.",
        prepare:"허가된 실습 자산을 대상으로 점검 항목→발견 사항→원인→개선안→재확인 결과를 표로 만들어 보세요."
      };
    }else if(/개인정보|개인\s*정보|PIPA|PIA|프라이버시/i.test(text)){
      guide={
        scope:"개인정보 수집·이용·보관·파기, 접근권한 관리 중 공고가 요구하는 범위를 확인하세요.",
        evidence:"관련 교육·업무·프로젝트에서 본인이 실제 작성하거나 검토한 절차·문서를 구분하세요.",
        prepare:"가상 서비스의 개인정보 처리 흐름을 그리고 수집 항목·보관 기간·접근권한·파기 기준을 점검표로 작성하세요. 실제 개인정보는 사용하지 마세요."
      };
    }else if(/클라우드|Azure|GCP|IAM|Kubernetes|쿠버네티스/i.test(text)){
      guide={
        scope:"클라우드 계정 권한·네트워크 설정·감사 로그 중 요구하는 운영 범위를 확인하세요.",
        evidence:"실제로 설정한 계정·접근 정책·로그 검토 경험을 실습과 실무로 구분해 정리하세요.",
        prepare:"공개 예제 설정에서 과도한 권한과 외부 공개 여부를 점검하고, 근거 화면과 개선안을 정리하세요. 유료 리소스는 생성하지 마세요."
      };
    }else if(/네트워크|방화벽|VLAN|\bACL\b|\bVPN\b|라우팅/i.test(text)){
      guide={
        scope:"공고의 네트워크 구성·장애 대응·접근통제 중 필요한 기술을 구분하세요.",
        evidence:"본인이 구성한 네트워크 토폴로지, 라우팅·ACL 설정 또는 장애 대응 기록을 정리하세요.",
        prepare:"격리된 가상망에서 VLAN/ACL 등 접근 정책을 구성하고 허용·차단 통신 결과를 표로 기록하세요."
      };
    }else if(/Linux|리눅스|Ubuntu|우분투|Rocky|서버\s*운영/i.test(text)){
      guide={
        scope:"서버 계정·권한·서비스·로그 관리 중 공고가 요구하는 항목을 확인하세요.",
        evidence:"직접 관리한 시스템과 설정·문제 해결 기록을 학습/실무로 구분해 정리하세요.",
        prepare:"로컬 가상머신에서 사용자 권한·서비스 상태·인증 로그를 점검하고 설정 전후 차이를 기록하세요."
      };
    }else if(/\bSQL\b|데이터\s*(?:분석|베이스)|DBMS/i.test(text)){
      guide={
        scope:"SQL 조회·데이터 가공·DB 권한 관리 중 요구하는 범위를 확인하세요.",
        evidence:"작성한 쿼리·분석 결과·프로젝트 역할을 실제 수행 내용 위주로 정리하세요.",
        prepare:"예제 데이터베이스에서 SELECT/JOIN 쿼리를 작성하고 결과 검증 과정과 접근권한 제한 사항을 기록하세요."
      };
    }else if(/Python|파이썬|스크립트|자동화|프로그래밍|개발/i.test(text)){
      guide={
        scope:"공고에 필요한 언어·자동화 범위·산출물 기준을 확인하세요.",
        evidence:"직접 작성한 스크립트, 입력·출력 예시, 오류 처리 방법을 정리하세요.",
        prepare:"샘플 로그 또는 비식별 테스트 데이터로 작은 자동화 스크립트를 만들고 정상·오류 사례를 테스트하세요."
      };
    }else{
      guide={
        scope:"공고에서 해당 조건이 요구하는 구체적인 업무나 결과물을 확인하세요.",
        evidence:"본인의 관련 경험과 확인 가능한 자료를 실무·프로젝트·학습으로 나누어 정리하세요.",
        prepare:"부족한 부분을 작은 실습 또는 문서화 과제로 정하고 결과물을 남기세요. 모호한 기준은 채용 담당자에게 확인하세요."
      };
    }
    if(item.status==="확인 필요")return [
      guide.scope,guide.evidence,
      guide.prepare+" 실제 보유 여부를 확인한 후 '내 역량'에서 상태와 사유를 수정하세요."
    ];
    if(item.status==="부분 충족")return [
      "이미 갖춘 부분과 부족한 부분을 먼저 구분하세요. "+guide.scope,
      guide.evidence,guide.prepare
    ];
    return [guide.scope,guide.prepare,
      "완료한 결과와 증빙을 정리하고 공고 요건 충족 여부를 다시 확인하세요. "+guide.evidence];
  }
  function buildRoadmap(items){
    if(!Array.isArray(items))throw new TypeError("비교 결과 배열이 필요합니다.");
    const totals={"충족":0,"부분 충족":0,"미충족":0,"확인 필요":0};
    const normalized=items.filter(item=>item&&["required","preferred"].includes(item.kind)&&
      typeof item.text==="string"&&item.text.trim()).map((item,index)=>{
      const status=states.includes(item.status)?item.status:"확인 필요";
      totals[status]++;
      return {id:String(item.id||item.kind+"-"+index),kind:item.kind,text:item.text.trim(),
        status,reason:typeof item.explanation==="string"?item.explanation.trim():"",
        index,line:Number.isInteger(item.line)&&item.line>0?item.line:null};
    });
    const sorted=normalized.sort((a,b)=>{
      const groupA=a.kind==="required"?0:1,groupB=b.kind==="required"?0:1;
      return order[a.status]-order[b.status]||groupA-groupB||a.index-b.index;
    }).map(item=>({...item,category:item.kind==="required"?"필수조건":"우대사항"}));
    // Distinguish actual work to do from conditions the user marked fulfilled.
    let priority=0;
    const tasks=sorted.filter(item=>item.status!=="충족")
      .map(item=>({...item,priority:++priority,action:nextAction(item),steps:preparationSteps(item)}));
    const completed=sorted.filter(item=>item.status==="충족");
    const groups=states.map(status=>({
      status,
      items:status==="충족"?completed:tasks.filter(item=>item.status===status)
    }));
    return {
      total:normalized.length,totals,tasks,completed,groups,
      requiredOpen:tasks.filter(item=>item.kind==="required").length,
      alreadyMarked:totals["충족"]
    };
  }
  function mount(){
    const empty=document.getElementById("roadmap-empty");
    const results=document.getElementById("roadmap-results");
    const summary=document.getElementById("roadmap-summary");
    const list=document.getElementById("roadmap-list");
    const notice=document.getElementById("roadmap-notice");
    if(!empty||!results||!summary||!list||!notice)return;
    const node=(tag,cls,text)=>{
      const n=document.createElement(tag);
      if(cls)n.className=cls;
      if(text!=null)n.textContent=String(text);
      return n;
    };
    // The same outlined status icons appear before all four status labels.
    // They are decorative; the full Korean status name remains readable text.
    const statusIcons={
      "확인 필요":{className:"pending",shapes:[
        ["circle",{cx:12,cy:12,r:10}],
        ["path",{d:"M9.2 9a3 3 0 0 1 5.6 1.4c0 1.8-2.8 2.2-2.8 3.8"}],
        ["path",{d:"M12 17h.01"}]
      ]},
      "미충족":{className:"missing",shapes:[
        ["circle",{cx:12,cy:12,r:10}],
        ["path",{d:"m9 9 6 6m0-6-6 6"}]
      ]},
      "부분 충족":{className:"partial",shapes:[
        ["circle",{cx:12,cy:12,r:10}],
        ["circle",{cx:12,cy:12,r:3,fill:"currentColor",stroke:"none"}]
      ]},
      "충족":{className:"fulfilled",shapes:[
        ["circle",{cx:12,cy:12,r:10}],
        ["path",{d:"m8 12 3 3 5-6"}]
      ]}
    };
    function statusIcon(status){
      const spec=statusIcons[status];
      const ns="http://www.w3.org/2000/svg";
      const svg=document.createElementNS(ns,"svg");
      svg.setAttribute("viewBox","0 0 24 24");
      svg.setAttribute("aria-hidden","true");
      svg.setAttribute("focusable","false");
      svg.setAttribute("class","roadmap-status-icon roadmap-status-icon--"+spec.className);
      spec.shapes.forEach(([tag,attrs])=>{
        const shape=document.createElementNS(ns,tag);
        Object.entries(attrs).forEach(([key,value])=>shape.setAttribute(key,String(value)));
        svg.appendChild(shape);
      });
      return svg;
    }
    function render(items){
      if(!Array.isArray(items)||!items.length){
        results.hidden=true;empty.hidden=false;list.replaceChildren();
        return;
      }
      const plan=buildRoadmap(items);
      if(!plan.total){results.hidden=true;empty.hidden=false;list.replaceChildren();return;}
      empty.hidden=true;results.hidden=false;list.replaceChildren();
      summary.textContent="비교한 조건 "+plan.total+"개 · 충족(본인 입력) "+plan.alreadyMarked+
        "개 · 확인 필요 "+plan.totals["확인 필요"]+"개 · 미충족 "+plan.totals["미충족"]+
        "개 · 부분 충족 "+plan.totals["부분 충족"]+"개. 이 순서는 필수조건을 먼저 살피기 위한 참고용입니다.";
      plan.groups.forEach(group=>{
        const section=node("section","roadmap-group");
        const groupTitle=node("h3","roadmap-group-title");
        groupTitle.appendChild(statusIcon(group.status));
        groupTitle.appendChild(node("span","",group.status+" · "+group.items.length+"개"));
        section.appendChild(groupTitle);
        const cards=node("div","roadmap-group-items");
        if(!group.items.length){
          cards.appendChild(node("p","roadmap-none","해당 조건 없음"));
        }else{
          group.items.forEach(item=>{
            const fulfilled=item.status==="충족";
            const card=node("article",fulfilled?"roadmap-task roadmap-task--fulfilled":"roadmap-task");
            const rank=node("p",fulfilled?"roadmap-rank roadmap-rank--fulfilled":"roadmap-rank");
            rank.appendChild(statusIcon(item.status));
            rank.appendChild(node("span","",fulfilled
              ?"충족 · "+item.category+" · 본인 입력 기준"
              :item.status+" · "+item.category+" · 우선 확인 "+item.priority));
            card.appendChild(rank);
            card.appendChild(node("h4","roadmap-item-title",item.text));
            if(item.line)card.appendChild(node("small","subtext","채용공고 원문 "+item.line+"행"));
            card.appendChild(node("p","roadmap-action",fulfilled
              ?"본인 입력으로 충족 표시한 조건입니다. 실제 증빙과 기업의 자격 인정 여부는 별도로 확인해 주세요."
              :item.action));
            if(item.steps&&item.steps.length){
              const details=node("details","roadmap-steps");
              details.appendChild(node("summary","roadmap-steps-toggle","준비 단계 "+item.steps.length+"개 보기"));
              const steps=node("ol","roadmap-steps-list");
              item.steps.forEach(step=>steps.appendChild(node("li","",step)));
              details.appendChild(steps);
              card.appendChild(details);
            }
            if(item.reason)card.appendChild(node("p","roadmap-evidence","내가 입력한 근거: "+item.reason));
            cards.appendChild(card);
          });
        }
        section.appendChild(cards);
        list.appendChild(section);
      });
      notice.textContent=(plan.requiredOpen
        ?"현재 아직 확인하거나 보완할 필수조건 "+plan.requiredOpen+"개가 있습니다."
        :"현재 비교 결과에서 추가 확인·보완으로 표시된 필수조건은 없습니다.")+
        " 확인 필요 → 미충족 → 부분 충족 → 충족 순서로 표시합니다. 모든 상태는 본인 입력 기준이며, 공식 자격 검증·대체 경력 인정·합격 확률을 판단하지 않습니다.";
    }
    window.addEventListener("muttaji:comparison-changed",event=>{
      render(event&&event.detail&&event.detail.items);
    });
  }
  if(typeof document!=="undefined"&&typeof window!=="undefined")mount();
  return {buildRoadmap,nextAction,preparationSteps};
});
