"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const fixture=JSON.parse(fs.readFileSync(path.join(__dirname,"../data/agent-mock-example.json"),"utf8"));
const ui=import("../assets/agent-analysis-ui.js");
function fakeView() {
  const state={rendered:[],clears:0,busy:false,status:""};
  return {state,view:{render:x=>state.rendered.push(x),clear(){state.clears++;},busy:x=>state.busy=x,status:x=>state.status=x}};
}
test("public fixture matches the server-validated mock output exactly",async()=>{
  const {validateFixture}=await ui;
  const {analyzeAgent}=await import("../lib/agent/service.js");
  assert.deepEqual(fixture.output,await analyzeAgent({mode:"mock",consent:true,input:fixture.input}));
  assert.equal(validateFixture(structuredClone(fixture)).output.mode,"mock");
  const wrong=structuredClone(fixture);wrong.output.requirements[0].profileEvidence[0].quote="없는 경력";
  assert.throws(()=>validateFixture(wrong));
});
test("input changes abort requests and suppress late results even when fetch ignores abort",async()=>{
  const {createPreviewController}=await ui;
  const {state,view}=fakeView();let resolve,signal;
  const controller=createPreviewController({view,load:s=>{signal=s;return new Promise(done=>resolve=done);}});
  const run=controller.run();assert.equal(state.busy,true);
  controller.invalidate();assert.equal(signal.aborted,true);assert.equal(state.busy,false);
  resolve(structuredClone(fixture));await run;
  assert.equal(state.rendered.length,0);assert.match(state.status,/변경/);
});
test("out-of-order requests cannot overwrite the latest preview",async()=>{
  const {createPreviewController}=await ui;
  const {state,view}=fakeView();const pending=[];
  const controller=createPreviewController({view,load:()=>new Promise(resolve=>pending.push(resolve))});
  const first=controller.run(),second=controller.run();
  pending[1](structuredClone(fixture));await second;
  pending[0](structuredClone(fixture));await first;
  assert.equal(state.rendered.length,1);assert.equal(state.busy,false);
});
test("invalid fixture, network error and timeout restore the run button without displaying results",async()=>{
  const {createPreviewController}=await ui;
  for(const load of [async()=>null,async()=>{throw Error("private network error");},()=>new Promise(()=>{})]) {
    const {state,view}=fakeView();
    await createPreviewController({view,load,timeoutMs:5}).run();
    assert.equal(state.rendered.length,0);assert.equal(state.busy,false);
    assert.match(state.status,/다시 시도/);assert.doesNotMatch(state.status,/private/);
  }
});
class Element {
  constructor(tag="div"){this.tag=tag;this.children=[];this.hidden=false;this.disabled=false;this.textContent="";this.handlers={};this.attributes={};}
  appendChild(node){this.children.push(node);return node;}
  replaceChildren(...nodes){this.children=nodes;}
  setAttribute(key,value){this.attributes[key]=value;}
  addEventListener(type,handler){(this.handlers[type]??=[]).push(handler);}
  async emit(type){for(const handler of this.handlers[type]||[])await handler();}
}
test("UI renders citations as text, loads only a static GET and invalidates every supported edit",async()=>{
  const {mountAgentPreview}=await ui;
  const ids=["agent-preview-run","agent-preview-clear","agent-preview-results","agent-preview-cards","agent-preview-examples","agent-preview-status",
    "job-text","job-file","goal-job","education","experience","certs","skills","profile-clear"];
  const elements=Object.fromEntries(ids.map(id=>[id,new Element()]));
  // A getter that throws proves the preview never reads personal input values.
  for(const id of ["job-text","goal-job","education","experience","certs","skills"])
    Object.defineProperty(elements[id],"value",{get(){throw Error("Personal input read");}});
  const calls=[],win=new Element();
  const hostile=structuredClone(fixture);
  hostile.output.requirements[0].interpretation='<img src=x onerror="alert(1)">';
  win.fetch=async(url,options)=>{calls.push({url,options});return new Response(JSON.stringify(hostile),{headers:{"content-type":"application/json"}});};
  const doc={getElementById:id=>elements[id],createElement:tag=>new Element(tag)};
  const controller=mountAgentPreview(doc,win);
  await controller.run();
  assert.equal(calls[0].url,"./data/agent-mock-example.json");assert.equal(calls[0].options.method,"GET");
  assert.equal(Object.hasOwn(calls[0].options,"body"),false);
  assert.equal(elements["agent-preview-results"].hidden,false);
  assert.equal(elements["agent-preview-cards"].children.length,3);
  const nodes=[];const walk=node=>{nodes.push(node);node.children.forEach(walk);};walk(elements["agent-preview-cards"]);
  assert.equal(nodes.some(x=>x.tag==="img"),false);
  assert.equal(nodes.some(x=>x.textContent.includes("<img src=x")),true);
  assert.equal(nodes.some(x=>x.tag==="blockquote"&&x.textContent==="보안 로그 분석 경험"),true);
  for(const [element,event] of [[elements["job-text"],"input"],[elements["job-file"],"change"],
    ...["goal-job","education","experience","certs","skills"].map(id=>[elements[id],"input"]),
    [elements["profile-clear"],"click"],[win,"muttaji:posting-reviewed"],[elements["agent-preview-clear"],"click"]]) {
    await controller.run();await element.emit(event);
    assert.equal(elements["agent-preview-results"].hidden,true);
    assert.equal(elements["agent-preview-cards"].children.length,0);
  }
});
