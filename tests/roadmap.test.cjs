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
