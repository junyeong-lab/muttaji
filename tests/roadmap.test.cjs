"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const {buildRoadmap,preparationSteps}=require("./load-browser-module.cjs")("../assets/roadmap.js");

const comparison=[
  {id:"r0",kind:"required",text:"정보처리기사 또는 정보보안기사",status:"충족",explanation:"정보처리기사 취득"},
  {id:"r1",kind:"required",text:"정보보호 컨설팅 경력 2년 이상",status:"미충족",explanation:"경력 기간 부족"},
  {id:"r2",kind:"required",text:"서버 관리 역량",status:"확인 필요",explanation:""},
  {id:"p0",kind:"preferred",text:"SQLD",status:"충족",explanation:"SQLD 취득"},
  {id:"p1",kind:"preferred",text:"개인정보보호 경험",status:"부분 충족",explanation:"프로젝트 일부 경험"},
  {id:"p2",kind:"preferred",text:"네트워크 경험",status:"확인 필요"}
];

test("필수 미확인·미충족 항목이 우대보다 앞서고 사용자 상태를 그대로 사용",()=>{
  const result=buildRoadmap(comparison);
  assert.equal(result.total,6);
  assert.equal(result.alreadyMarked,2);
  assert.equal(result.requiredOpen,2);
  assert.deepEqual(result.groups.map(group=>group.status),["확인 필요","미충족","부분 충족","충족"]);
  assert.deepEqual(result.completed.map(x=>x.id),["r0","p0"]);
  assert.deepEqual(result.groups.map(x=>x.items.length),[2,1,1,2]);
  assert.deepEqual(result.tasks.map(x=>x.id),["r2","p2","r1","p1"]);
  assert.deepEqual(result.tasks.map(x=>x.priority),[1,2,3,4]);
  assert.deepEqual(result.totals,{"충족":2,"부분 충족":1,"미충족":1,"확인 필요":2});
});

test("경력 부족을 자격증이나 프로젝트로 대체해도 된다고 안내하지 않음",()=>{
  const result=buildRoadmap([{kind:"required",text:"경력 3년 이상",status:"미충족"}]);
  assert.match(result.tasks[0].action,/대체할 수 있다고 단정하지 말고/);
});
test("미확인 상태의 학력·자격증도 자동으로 충족 처리하지 않음",()=>{
  const result=buildRoadmap([
    {kind:"required",text:"학력: 대졸",status:"확인 필요"},
    {kind:"preferred",text:"SQLD",status:"미충족"},
    {kind:"required",text:"다른 자격증",status:"unrecognized"}
  ]);
  assert.equal(result.totals["확인 필요"],2);
  assert.match(result.tasks.find(x=>x.text==="SQLD").action,/공식 시행기관/);
});
test("전부 충족인 경우 빈 할 일 목록과 현재 상태 숫자만 반환",()=>{
  const result=buildRoadmap([{kind:"required",text:"정보처리기사",status:"충족"}]);
  assert.equal(result.tasks.length,0);
  assert.equal(result.alreadyMarked,1);
  assert.equal(result.completed.length,1);
  assert.equal(result.groups[3].items.length,1);
});
test("빈 입력·잘못된 항목·텍스트는 안전하게 처리",()=>{
  assert.deepEqual(buildRoadmap([]).tasks,[]);
  assert.throws(()=>buildRoadmap({status:"충족"}),TypeError);
  assert.equal(buildRoadmap([null,{kind:"bogus",text:"행",status:"충족"}]).total,0);
});

test("브라우저 이벤트로 로드맵 갱신·비교 취소 시 초기화",()=>{
  class Element {
    constructor(){this.children=[];this.hidden=false;this.textContent="";this.className="";}
    appendChild(node){this.children.push(node);return node;}
    replaceChildren(...nodes){this.children=[...nodes];}
    setAttribute(key,value){this.attributes||(this.attributes={});this.attributes[key]=value;}
  }
  const ids=["roadmap-empty","roadmap-results","roadmap-summary","roadmap-list","roadmap-notice"];
  const elements=Object.fromEntries(ids.map(id=>[id,new Element()]));
  const handlers={};
  const win={addEventListener:(type,listener)=>{handlers[type]=listener;}};
  const doc={getElementById:id=>elements[id]||null,createElement:()=>new Element(),createElementNS:(_ns,tag)=>new Element(tag)};
  const script=fs.readFileSync(path.join(__dirname,"../assets/roadmap.js"),"utf8");
  vm.runInNewContext(script,{window:win,document:doc,globalThis:win,console});
  assert.equal(typeof handlers["muttaji:comparison-changed"],"function");
  handlers["muttaji:comparison-changed"]({detail:{items:comparison}});
  assert.equal(elements["roadmap-results"].hidden,false);
  assert.equal(elements["roadmap-empty"].hidden,true);
  assert.equal(elements["roadmap-list"].children.length,4);
  assert.match(elements["roadmap-summary"].textContent,/확인 필요 2개/);
  assert.deepEqual(elements["roadmap-list"].children.map(x=>x.children[0].children[1].textContent),[
    "확인 필요 · 2개","미충족 · 1개","부분 충족 · 1개","충족 · 2개"
  ]);
  assert.deepEqual(elements["roadmap-list"].children.map(x=>x.children[0].children[0].attributes.class),[
    "roadmap-status-icon roadmap-status-icon--pending",
    "roadmap-status-icon roadmap-status-icon--missing",
    "roadmap-status-icon roadmap-status-icon--partial",
    "roadmap-status-icon roadmap-status-icon--fulfilled"
  ]);
  assert.match(elements["roadmap-list"].children[0].children[1].children[0].children[1].textContent,/서버 관리 역량/);
  const fulfilledBadge=elements["roadmap-list"].children[3].children[1].children[0].children[0];
  assert.equal(fulfilledBadge.children[0].attributes.class,"roadmap-status-icon roadmap-status-icon--fulfilled");
  assert.match(fulfilledBadge.children[1].textContent,/^충족 ·/);
  assert.doesNotMatch(fulfilledBadge.children[1].textContent,/!/);
  handlers["muttaji:comparison-changed"]({detail:{items:null}});
  assert.equal(elements["roadmap-results"].hidden,true);
  assert.equal(elements["roadmap-empty"].hidden,false);
  assert.equal(elements["roadmap-list"].children.length,0);
});

test("상태별 준비 단계는 실행 가능한 확인·학습 지침이며 충족 조건에는 추가하지 않음",()=>{
  const cases=[
    {kind:"required",text:"정보보호 컨설팅 경력 3년 이상",status:"미충족"},
    {kind:"preferred",text:"Wazuh SIEM 운영 경험",status:"부분 충족"},
    {kind:"required",text:"학력: 대졸",status:"확인 필요"},
    {kind:"preferred",text:"SQLD",status:"미충족"},
    {kind:"required",text:"정보처리기사",status:"충족"}
  ];
  const plan=buildRoadmap(cases);
  assert.equal(plan.tasks.length,4);
  for(const task of plan.tasks){
    assert.equal(task.steps.length,3);
    assert.ok(task.steps.every(s=>typeof s==="string"&&s.length>12));
  }
  assert.match(plan.tasks.find(t=>t.text.includes("컨설팅")).steps.join(" "),/대체한다고 가정하지 마세요/);
  assert.match(plan.tasks.find(t=>t.text.includes("Wazuh")).steps.join(" "),/실습을 실무 경력과 구분하세요/);
  assert.match(plan.tasks.find(t=>t.text==="SQLD").steps.join(" "),/공식 검증 전/);
  assert.equal(plan.completed[0].steps,undefined);
});

test("브라우저에는 펼쳐보는 준비 단계 3개가 렌더링되고 초기화되면 사라짐",()=>{
  class Element{
    constructor(tag){this.tag=tag;this.children=[];this.hidden=false;this.textContent="";this.attributes={};}
    appendChild(n){this.children.push(n);return n;}
    replaceChildren(...nodes){this.children=[...nodes];}
    setAttribute(k,v){this.attributes[k]=v;}
  }
  const ids=["roadmap-empty","roadmap-results","roadmap-summary","roadmap-list","roadmap-notice"];
  const elements=Object.fromEntries(ids.map(id=>[id,new Element(id)]));
  const events={};
  const win={addEventListener:(name,fn)=>{events[name]=fn}};
  const doc={getElementById:id=>elements[id],createElement:tag=>new Element(tag),createElementNS:(_ns,tag)=>new Element(tag)};
  const src=fs.readFileSync(path.join(__dirname,"../assets/roadmap.js"),"utf8");
  vm.runInNewContext(src,{window:win,document:doc,globalThis:win});
  events["muttaji:comparison-changed"]({detail:{items:[{kind:"required",text:"AWS 클라우드 보안 운영 경험",status:"미충족"}]}});
  const card=elements["roadmap-list"].children[1].children[1].children[0];
  const details=card.children.find(c=>c.tag==="details");
  assert.ok(details);
  assert.match(details.children[0].textContent,/준비 단계 3개/);
  assert.equal(details.children[1].children.length,3);
  events["muttaji:comparison-changed"]({detail:{items:null}});
  assert.equal(elements["roadmap-list"].children.length,0);
});

test("실제 기술명에 따라 구체적인 실습과 증빙 항목을 제안",()=>{
  const examples=[
    ["AWS 클라우드 보안 운영 경험","IAM","CloudTrail"],
    ["Wazuh SIEM 운영 경험","에이전트","로그"],
    ["SIEM 로그 분석 경험","탐지 조건","인증 로그"],
    ["EDR 운영 경험","프로세스","경보"],
    ["정보보안 점검 실무","점검 항목","개선안"],
    ["개인정보보호 업무","수집","보관"],
    ["네트워크 VLAN 구성","VLAN","ACL"],
    ["Linux 서버 운영","가상머신","인증 로그"],
    ["SQL 데이터 분석","SELECT/JOIN","쿼리"],
    ["Python 자동화","스크립트","테스트"]
  ];
  examples.forEach(([text,first,second])=>{
    const [task]=buildRoadmap([{kind:"required",text,status:"확인 필요"}]).tasks;
    assert.equal(task.steps.length,3,text);
    assert.match(task.steps.join(" "),new RegExp(first),text);
    assert.match(task.steps.join(" "),new RegExp(second),text);
    assert.match(task.steps[2],/내 역량/,text);
  });
});

test("사용자 확인 상태가 달라도 사실을 과장하지 않고 동일 도메인 가이드를 사용",()=>{
  const items=["확인 필요","미충족","부분 충족","충족"].map(status=>({
    kind:"preferred",text:"AWS 클라우드 보안 운영 경험",status
  }));
  const plan=buildRoadmap(items);
  assert.deepEqual(plan.groups.map(g=>g.items.length),[1,1,1,1]);
  assert.equal(plan.completed.length,1);
  for(const task of plan.tasks){
    assert.match(task.steps.join(" "),/IAM/);
    assert.equal(task.steps.length,3);
    assert.doesNotMatch(task.steps.join(" "),/실무 경력을 충족/);
  }
});

test("연차·학력 요건은 실습과 자격증으로 충족했다고 안내하지 않음",()=>{
  const examples=[
    {kind:"required",text:"정보보안 컨설팅 실무 경력 3년 이상",status:"확인 필요"},
    {kind:"required",text:"학력 대졸 이상",status:"미충족"},
    {kind:"preferred",text:"정보처리기사 자격증",status:"미충족"}
  ];
  const plan=buildRoadmap(examples);
  const career=plan.tasks.find(t=>t.text.includes("3년 이상"));
  assert.match(career.steps.join(" "),/실무 경력.*대체한다고 가정하지 마세요/);
  const education=plan.tasks.find(t=>t.text.includes("대졸"));
  assert.match(education.steps.join(" "),/학위/);
  const cert=plan.tasks.find(t=>t.text.includes("자격증"));
  assert.match(cert.steps.join(" "),/공식 검증 전/);
});

test("Wazuh 경보 분석 안내는 구체적이고 확인 필요·미충족·부분 충족에서 유지",()=>{
  for(const status of ["확인 필요","미충족","부분 충족"]){
    const plan=buildRoadmap([{kind:"preferred",text:"Wazuh SIEM 운영 경험",status}]);
    const steps=plan.tasks[0].steps;
    assert.equal(steps.length,3);
    const text=steps.join(" ");
    assert.match(text,/Wazuh 에이전트/);
    assert.match(text,/로그 수집/);
    assert.match(text,/로그 수집→경보 확인→원인 기록/);
    assert.match(text,/실무 경력과 구분하세요/);
  }
});

test("Python 로그 분석 자동화는 SIEM보다 Python 스크립트 실습을 먼저 제시",()=>{
  const [task]=buildRoadmap([
    {kind:"required",text:"Python 로그 분석 자동화",status:"확인 필요"}
  ]).tasks;
  assert.match(task.steps.join(" "),/Python 스크립트를 작성/);
  assert.match(task.steps.join(" "),/비식별 샘플 로그/);
  assert.doesNotMatch(task.steps[0],/SIEM/);
  assert.match(task.steps[2],/내 역량/);
});

test("Windows 서버, PC 정비사, 복수 클라우드, 포트폴리오, 교육 이수 조건에 맞는 준비 단계",()=>{
  const cases=[
    ["Windows 서버 보안 운영",["Windows 서버","이벤트 뷰어","로그온"]],
    ["PC 정비사 2급 보유",["자격증","증명서","공식 검증 전"]],
    ["AWS와 Azure 클라우드 접근권한 관리",["AWS와 Azure","IAM/RBAC","비용이 드는 리소스는 생성하지 마세요"]],
    ["포트폴리오 또는 GitHub 제출",["포트폴리오","README","비밀키"]],
    ["보안 교육 이수",["교육 과정명","수료증","공식 교육"]]
  ];
  for(const [phrase,expected] of cases){
    const plan=buildRoadmap([{kind:"required",text:phrase,status:"확인 필요"}]);
    const task=plan.tasks[0];
    assert.equal(task.steps.length,3,phrase);
    expected.forEach(term=>assert.ok(task.steps.join(" ").includes(term),phrase+" / "+term));
    assert.match(task.steps[2],/내 역량/);
  }
});
test("추가 조건의 상태별 세 단계 유지 및 충족 처리 보존",()=>{
  const phrase="포트폴리오 또는 GitHub 제출";
  ["확인 필요","미충족","부분 충족"].forEach(status=>{
    const task=buildRoadmap([{kind:"preferred",text:phrase,status}]).tasks[0];
    assert.equal(task.steps.length,3);
    assert.match(task.steps.join(" "),/README/);
  });
  const completed=buildRoadmap([{kind:"preferred",text:phrase,status:"충족"}]);
  assert.equal(completed.tasks.length,0);
  assert.equal(completed.completed.length,1);
});


test("직무의 일반 프로그래밍 요건에서는 없는 Python 요구를 만들어내지 않는다",()=>{
  for(const text of ["프로그래밍가능자","프로그래밍 가능자","코딩 가능자"]){
    const [task]=buildRoadmap([{kind:"preferred",text,status:"확인 필요"}]).tasks;
    assert.equal(task.steps.length,3);
    assert.match(task.steps[0],/프로그래밍 언어·도구/);
    assert.doesNotMatch(task.steps.join(" "),/Python|비식별 샘플 로그/);
    assert.match(task.steps[1],/직접 작성·수정한 코드/);
  }
});
test("Python이 명시되어도 별도 로그 요건 없이는 로그 분석을 전제하지 않는다",()=>{
  const simple=buildRoadmap([{kind:"preferred",text:"Python 프로그래밍 가능",status:"확인 필요"}]).tasks[0];
  assert.match(simple.steps.join(" "),/Python/);
  assert.doesNotMatch(simple.steps.join(" "),/비식별 샘플 로그/);
  const logging=buildRoadmap([{kind:"preferred",text:"Python 로그 분석 자동화",status:"확인 필요"}]).tasks[0];
  assert.match(logging.steps.join(" "),/Python 스크립트를 작성/);
  assert.match(logging.steps.join(" "),/비식별 샘플 로그/);
});


test("웍스피어 13개 요건의 로드맵은 해당 업무별 실행 단계와 원문 행을 유지한다",()=>{
 const originals=[["정보보호 또는 보안 솔루션 운영 분야에서 3년 이상의 실무 경험을 보유하신 분",["경력 기간","실습·자격증"]],["WAF, IPS, 방화벽, EDR/EPP, 서버 접근제어 등 보안 장비·솔루션 운영 경험이 있으신 분",["WAF·IPS","차단 정책"]],["보안 이벤트와 로그를 분석하고, 이상 징후·침해사고의 원인을 파악해 대응할 수 있으신 분",["이상 징후","시간순 기록"]],["네트워크·서버·웹 서비스 환경 및 TCP/IP, HTTP/HTTPS, SSL/TLS 등 주요 프로토콜을 이해하고 계신 분",["TCP/IP","TLS 협상"]],["보안 정책 변경, 장애 대응, 운영 절차 수립 및 개선 경험이 있으신 분",["보안 정책 변경","정책 점검"]],["보안 이슈를 유관 부서와 원활히 협업하여 해결하고, 운영 내용을 명확히 문서화할 수 있으신 분",["유관 부서","서로 다른 경험"]],["ISMS-P 등 보안 컴플라이언스 체계 구축·심사 대응 경험이 있으신 분",["ISMS-P","기관평가"]],["다양한 인프라 환경에서 보안 솔루션을 구축하고 장애를 트러블슈팅한 경험이 풍부하신 분",["보안 솔루션 구축","장애 증상"]],["L7 애플리케이션 계층 위협 분석, 제로데이 취약점 분석, 침해사고 대응(IR) 실무 경험이 있으신 분",["L7","IR 실무"]],["망분리 환경에서 AI 관련 보안 리스크를 검토하고, 안전한 업무 적용 및 보안 프로세스 개선을 수행한 경험이 있으신 분",["망분리","가상 망분리"]],["n8n 또는 AI를 활용해 보안 운영·분석·보고 업무를 자동화한 경험이 있으신 분",["n8n","보고 초안"]],["AWS 환경 및 주요 보안 서비스에 대한 이해 또는 운영 경험이 있으신 분",["IAM","CloudTrail"]],["정보보안기사, CISA, CISSP 등 정보보안 관련 자격증을 보유하신 분",["자격증","공식 시행기관"]]];
 const items=originals.map(([text],i)=>({
  id:"req-"+i,
  kind:i<6?"required":"preferred",
  text,status:"확인 필요",line:i<6?39+i:52+i-6
 }));
 const plan=buildRoadmap(items);
 assert.equal(plan.total,13);
 assert.equal(plan.requiredOpen,6);
 assert.equal(plan.tasks.length,13);
 assert.deepEqual(plan.groups.map(x=>x.items.length),[13,0,0,0]);
 for(let i=0;i<originals.length;i++){
  const [original,terms]=originals[i],item=plan.tasks[i],combined=item.steps.join(" ");
  assert.equal(item.text,original);
  assert.equal(item.line,i<6?39+i:52+i-6);
  assert.equal(item.priority,i+1);
  assert.equal(item.status,"확인 필요");
  assert.equal(item.steps.length,3);
  for(const term of terms)assert.ok(combined.includes(term),original+" : "+term);
  assert.match(item.steps[2],/내 역량/);
 }
});
test("복합 요건 전용 안내는 선택 상태에 따라 바뀌지만 자동 충족으로 판정하지 않는다",()=>{
 const text="n8n 또는 AI를 활용해 보안 운영·분석·보고 업무를 자동화한 경험이 있으신 분";
 for(const status of ["확인 필요","미충족","부분 충족","충족"]){
  const plan=buildRoadmap([{id:"n8n",kind:"preferred",text,status,line:56,explanation:"직접 구현 여부 미확인"}]);
  const item=plan.groups.find(g=>g.status===status).items[0];
  assert.equal(item.status,status);
  assert.equal(item.line,56);
  assert.equal(item.reason,"직접 구현 여부 미확인");
  if(status==="충족")assert.equal(item.steps,undefined);
  else{
   assert.equal(item.steps.length,3);
   assert.match(item.steps.join(" "),/n8n/);
   assert.doesNotMatch(item.steps[0],/프로그래밍 언어·도구/);
  }
 }
});


test("실공고 준비 로드맵은 병역·운전면허 등 지원 조건에 코딩 실습을 권하지 않는다",()=>{
 for(const text of ["해외여행에 결격 사유가 없는 분","병역필 또는 면제자","운전가능자(1종 보통)","입사 가능자"]){
  const steps=preparationSteps({kind:"required",text,status:"확인 필요"});
  assert.equal(steps.length,3);
  assert.match(steps.join(" "),/증빙|채용 담당자|행정/);
  assert.doesNotMatch(steps.join(" "),/코드 작성|가상머신|VLAN\/ACL/);
 }
});
test("실공고 준비 로드맵은 도구 및 업무에 맞는 검증 과제를 권한다",()=>{
 const fixtures=[
  ["Zabbix Prometheus Grafana 모니터링 도구 사용 경험",/대시보드|메트릭/],
  ["Docker 컨테이너 배포 경험",/Dockerfile|컨테이너/],
  ["PostgreSQL 데이터베이스 운영 및 DB 설계",/데이터베이스|JOIN|권한/],
  ["React TypeScript 프론트 개발 경험",/기능|테스트/],
  ["유관 부서와 협업하여 기술 문서 작성",/협의|보고자료/],
  ["Airflow ETL 파이프라인 구축",/데이터|정제/]
 ];
 for(const [text,expected] of fixtures){
  const steps=preparationSteps({kind:"preferred",text,status:"확인 필요"});
  assert.equal(steps.length,3);
  assert.match(steps.join(" "),expected,text);
 }
});
