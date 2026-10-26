"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const {buildRoadmap}=require("../assets/roadmap.js");

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
  assert.match(plan.tasks.find(t=>t.text.includes("Wazuh")).steps.join(" "),/실무 경력이라고 표시하지 마세요/);
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
