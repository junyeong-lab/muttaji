"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const base=path.join(__dirname,"..");
const reqSrc=fs.readFileSync(path.join(base,"assets","requirement-comparison.js"),"utf8");
const roadmapSrc=fs.readFileSync(path.join(base,"assets","roadmap-builder.js"),"utf8");

class Node{
  constructor(tag="div"){
    this.tag=tag;this.children=[];this.events={};this.dataset={};
    this.value="";this.textContent="";this.hidden=false;this.style={};
  }
  addEventListener(name,fn){(this.events[name]??=[]).push(fn);}
  dispatch(name){for(const fn of(this.events[name]||[]))fn({preventDefault(){}});}
  appendChild(node){this.children.push(node);return node;}
  replaceChildren(...nodes){this.children=nodes;}
  setAttribute(key,value){this[key]=value;}
  scrollIntoView(){}
  querySelector(name){
    function find(node){
      if(name==="[data-assessment-note]"&&node.dataset.assessmentNote)return node;
      if(node.tag===name)return node;
      return node.children.map(find).find(Boolean);
    }
    return find(this)||null;
  }
  querySelectorAll(name){
    return name==="[data-requirement]"?this.children.filter(n=>n.dataset.requirement):[];
  }
}
function environment(){
  const ids=["profile-form","job-text","requirements-check","requirements-list",
    "requirements-summary","requirements-message","requirements-run",
    "goal-job","education","experience","certs","skills","roadmap-result",
    "roadmap-message","roadmap-generate","roadmap-count","roadmap-actions",
    "roadmap-task-board","roadmap-task-progress","roadmap-copy",
    "roadmap-copy-message"];
  const nodes=Object.fromEntries(ids.map(id=>[id,new Node()]));
  nodes["job-text"].value="필수조건\nㆍ 정보보안기사 자격증 필요";
  nodes["goal-job"].value="정보보안 컨설팅";
  nodes["roadmap-result"].hidden=true;
  nodes["requirements-check"].hidden=true;
  const document={
    getElementById:id=>nodes[id],
    createElement:tag=>new Node(tag)
  };
  const window={
    events:{},
    addEventListener(name,fn){(this.events[name]??=[]).push(fn);},
    dispatch(name){for(const fn of(this.events[name]||[]))fn();},
    JobTextAnalyzer:{analyze:()=>({
      required:[{text:"정보보안기사 자격증 필요",source:"",line:2,endLine:2}],
      preferred:[]
    })}
  };
  new Function("window","document","module",reqSrc)(window,document,{exports:{}});
  return {nodes,window,document};
}
function compare(env){
  env.nodes["requirements-run"].dispatch("click");
  assert.equal(env.nodes["requirements-check"].hidden,false);
  assert.ok(env.window.MuttajiComparisonSnapshot);
}
function assertCleared(env){
  assert.equal(env.nodes["requirements-check"].hidden,true);
  assert.equal(env.nodes["roadmap-result"].hidden,true);
  assert.equal(env.window.MuttajiComparisonSnapshot,null);
}
test("프로필 텍스트 직접 수정 시 과거 비교 및 로드맵 모두 숨김",()=>{
  const env=environment();compare(env);
  env.nodes["roadmap-result"].hidden=false;
  env.nodes["goal-job"].value+=" (테스트)";
  env.nodes["goal-job"].dispatch("input");
  assertCleared(env);
  assert.match(env.nodes["requirements-message"].textContent,/다시 눌러/);
});
test("브라우저 자동완성 등 input 이벤트 누락도 확인 버튼에서 무효화",()=>{
  const env=environment();compare(env);
  env.nodes["roadmap-result"].hidden=false;
  env.nodes["goal-job"].value+=" (테스트)";
  env.nodes["profile-form"].dispatch("submit");
  assertCleared(env);
});
test("프로필이 바뀐 오래된 비교 결과로 새 로드맵 생성 불가",async()=>{
  const env=environment();compare(env);
  new Function("window","document","module",roadmapSrc)(env.window,env.document,{exports:{}});
  env.nodes["goal-job"].value+=" (테스트)";
  await env.nodes["roadmap-generate"].events.click[0]();
  assert.equal(env.nodes["roadmap-result"].hidden,true);
  assert.match(env.nodes["roadmap-message"].textContent,/최신/);
});
test("변경 없는 기존 평가를 확인 버튼만 눌렀을 때 잘못 지우지 않음",()=>{
  const env=environment();compare(env);
  env.nodes["profile-form"].dispatch("submit");
  assert.equal(env.nodes["requirements-check"].hidden,false);
  assert.ok(env.window.MuttajiComparisonSnapshot);
});

test("프로필 변경 이벤트 없이 탭 이동만 해도 과거 비교·로드맵 숨김",()=>{
  const env=environment();compare(env);
  new Function("window","document","module",roadmapSrc)(env.window,env.document,{exports:{}});
  env.nodes["roadmap-result"].hidden=false;
  env.nodes["goal-job"].value+=" (테스트)";
  env.window.dispatch("hashchange");
  assertCleared(env);
  assert.match(env.nodes["roadmap-message"].textContent,/변경/);
});
test("입력이 그대로인 단순 탭 이동에서는 실제 생성한 비교·로드맵 보존",async()=>{
  const env=environment();compare(env);
  new Function("window","document","module",roadmapSrc)(env.window,env.document,{exports:{}});
  await env.nodes["roadmap-generate"].events.click[0]();
  assert.equal(env.nodes["roadmap-result"].hidden,false);
  env.window.dispatch("hashchange");
  assert.equal(env.nodes["requirements-check"].hidden,false);
  assert.equal(env.nodes["roadmap-result"].hidden,false);
  assert.ok(env.window.MuttajiComparisonSnapshot);
});

test("기존 로드맵 생성 당시의 프로필과 화면 값이 다르면 새 스냅샷에 속지 않음",async()=>{
  const env=environment();compare(env);
  new Function("window","document","module",roadmapSrc)(env.window,env.document,{exports:{}});
  await env.nodes["roadmap-generate"].events.click[0]();
  assert.equal(env.nodes["roadmap-result"].hidden,false);
  env.nodes["goal-job"].value+=" (테스트)";
  // Simulate a caller replacing the shared snapshot with new user input:
  // displayed cards remain old and MUST still be invalidated.
  env.window.MuttajiComparisonSnapshot.profile=env.nodes["goal-job"].value+"\n---\n\n---\n\n---\n\n---\n";
  env.window.MuttajiCheckRoadmapFreshness();
  assert.equal(env.nodes["roadmap-result"].hidden,true);
  assert.equal(env.nodes["roadmap-actions"].children.length,0);
  assert.equal(env.nodes["roadmap-task-board"].children.length,0);
  assert.match(env.nodes["roadmap-message"].textContent,/변경/);
});
test("라우터에서 직접 호출 가능한 두 종류의 최신 입력 가드 공개",()=>{
  const env=environment();compare(env);
  new Function("window","document","module",roadmapSrc)(env.window,env.document,{exports:{}});
  assert.equal(typeof env.window.MuttajiCheckRequirementFreshness,"function");
  assert.equal(typeof env.window.MuttajiCheckRoadmapFreshness,"function");
});