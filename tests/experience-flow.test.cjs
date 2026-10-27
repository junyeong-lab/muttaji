"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
class Element{
  constructor(tag="div"){this.tag=tag;this.children=[];this.value="";this.hidden=false;this.dataset={};this.handlers={};this.textContent="";this.attributes={};}
  appendChild(node){this.children.push(node);return node;}
  replaceChildren(...nodes){this.children=[...nodes];}
  setAttribute(key,value){this.attributes[key]=value;}
  addEventListener(type,fn){(this.handlers[type]??=[]).push(fn);}
  emit(type){for(const fn of this.handlers[type]||[])fn({target:this});}
  scrollIntoView(){}
  querySelectorAll(selector){
    const match=node=>selector[0]==="["?Object.hasOwn(node.dataset,selector.slice(6,-1).replace(/-([a-z])/g,(_,x)=>x.toUpperCase())):node.tag===selector;
    const found=[];const visit=node=>{for(const child of node.children){if(match(child))found.push(child);visit(child);}};visit(this);return found;
  }
  querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
}
function setup({engine=true,broken=false}={}){
  const ids=["profile-form","job-text","requirements-check","requirements-list","requirements-summary","requirements-message","requirements-run",
    "goal-job","education","experience","certs","skills","experience-explanation-status",
    "roadmap-empty","roadmap-results","roadmap-summary","roadmap-list","roadmap-notice"];
  const elements=Object.fromEntries(ids.map(id=>[id,new Element()]));
  elements["requirements-check"].hidden=true;
  elements["job-text"].value="필수조건\n- 출장 업무 수행 가능\n우대사항\n- Linux 운영 경험\n- SQLD 보유";
  elements.experience.value="Linux 환경 구축 예정입니다.";elements.certs.value="SQLD";
  const events=[],listeners={};
  const win={addEventListener(type,fn){(listeners[type]??=[]).push(fn);},dispatchEvent(event){events.push(event);for(const fn of listeners[event.type]||[])fn(event);}};
  const doc={getElementById:id=>elements[id]||null,createElement:tag=>new Element(tag),createElementNS:(_ns,tag)=>new Element(tag)};
  const context=vm.createContext({window:win,document:doc,globalThis:win,console,URL,CustomEvent:class{constructor(type,options){this.type=type;this.detail=options.detail;}},
    fetch(){throw Error("Unexpected network request");},localStorage:new Proxy({},{get(){throw Error("Unexpected storage access");}})});
  const scripts=["job-text-analyzer.js",...(engine?["experience-explanations.js"]:[]),"requirement-comparison.js","roadmap.js"];
  for(const file of scripts)vm.runInContext(fs.readFileSync(path.join(__dirname,"../assets",file),"utf8"),context,{filename:file});
  if(broken)win.MuttajiExperience.buildAnalysis=()=>{throw Error("Unsupported input");};
  return {elements,win,events};
}
function lastItems(events){return events.filter(x=>x.type==="muttaji:comparison-changed").at(-1).detail.items;}
function collectText(node){return [node.textContent,...node.children.flatMap(collectText)].join("\n");}

test("compare → actual-input explanation → roadmap preserves choices and reacts to reason edits",()=>{
  const {elements,events}=setup();
  elements["requirements-run"].emit("click");
  assert.equal(elements["requirements-check"].hidden,false);
  assert.equal(lastItems(events).length,3);
  assert.equal(lastItems(events)[2].status,"충족"); // existing certificate-only match
  const mobility=elements["requirements-list"].children[0];
  const select=mobility.querySelector("select"),reason=mobility.querySelector("textarea");
  select.value="충족";reason.value="전국 출장 업무 수행 가능";reason.emit("input");
  let current=lastItems(events);
  assert.equal(current[0].status,"충족");
  assert.equal(current[1].status,"확인 필요");
  assert.equal(current[0].experienceExplanation.inputEvidence[0].quote,reason.value);
  assert.equal(collectText(mobility).includes("업무 수행 가능 여부"),true);
  assert.equal(collectText(elements["roadmap-list"]).includes(reason.value),true);
  assert.equal(collectText(elements["roadmap-list"]).includes("예정·계획은 앞으로 준비할 내용"),true);
  const sourceText=elements["job-text"].value,profileText=elements.experience.value;
  reason.value="상주 업무 및 출장 업무 수행 가능";reason.emit("input");
  assert.equal(lastItems(events)[0].experienceExplanation.inputEvidence[0].quote,reason.value);
  assert.equal(collectText(elements["roadmap-list"]).includes("전국 출장 업무 수행 가능"),false);
  assert.equal(elements["job-text"].value,sourceText);assert.equal(elements.experience.value,profileText);
  assert.equal(select.value,"충족");
  assert.match(elements["experience-explanation-status"].textContent,/AI 의미 분석 아님/);
});
test("changing posting or profile invalidates the comparison and roadmap without reusing old guidance",()=>{
  for(const field of ["job-text","experience"]){
    const {elements,events}=setup();elements["requirements-run"].emit("click");
    elements[field].value+="\n내용 변경";elements[field].emit("input");
    assert.equal(elements["requirements-check"].hidden,true);
    assert.equal(elements["roadmap-results"].hidden,true);
    assert.equal(lastItems(events),null);
    elements["requirements-run"].emit("click");
    assert.equal(elements["requirements-check"].hidden,false);
    assert.equal(lastItems(events).every(x=>x.experienceExplanation?.mode==="local-rules"),true);
  }
});
test("missing or failed explanation engine cannot break existing comparison or roadmap",()=>{
  for(const options of [{engine:false},{broken:true}]){
    const {elements,events}=setup(options);elements["requirements-run"].emit("click");
    assert.equal(elements["requirements-check"].hidden,false);
    assert.equal(elements["roadmap-results"].hidden,false);
    assert.equal(lastItems(events)[2].status,"충족");
    assert.match(elements["experience-explanation-status"].textContent,/기존|그대로/);
  }
});
test("all fulfilled remains a user report instead of claiming no preparation is needed",()=>{
  const {elements}=setup();elements["requirements-run"].emit("click");
  for(const card of elements["requirements-list"].children){
    card.querySelector("select").value="충족";
    card.querySelector("textarea").value="이 조건에 대해 사용자가 입력한 근거";
    card.querySelector("textarea").emit("input");
  }
  assert.match(elements["roadmap-notice"].textContent,/사용자가 충족으로 표시/);
  assert.doesNotMatch(elements["roadmap-notice"].textContent,/보완.*없습니다/);
});
test("confirmed URL provenance follows comparison and roadmap, while unsafe or stale sources are ignored",()=>{
 const {elements,win,events}=setup();
 win.MuttajiImportedPosting={reviewed:true,text:elements["job-text"].value.trim(),sourceUrl:"https://jobs.example.org/demo/security",method:"jsonld",edited:true};
 elements["requirements-run"].emit("click");
 assert.equal(lastItems(events)[0].postingSource.url,"https://jobs.example.org/demo/security");
 const nodes=[];const walk=node=>{nodes.push(node);node.children.forEach(walk);};walk(elements["roadmap-list"]);
 assert.equal(nodes.some(node=>node.tag==="a"&&node.href==="https://jobs.example.org/demo/security"&&node.rel==="noopener noreferrer"),true);
 win.MuttajiImportedPosting.sourceUrl="javascript:alert(1)";elements["requirements-run"].emit("click");
 assert.equal(lastItems(events).some(x=>x.postingSource),false);
 win.MuttajiImportedPosting.sourceUrl="https://jobs.example.org/demo/security";win.MuttajiImportedPosting.text="old posting";
 elements["requirements-run"].emit("click");assert.equal(lastItems(events).some(x=>x.postingSource),false);
});