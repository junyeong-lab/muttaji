"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const {mount}=require("./load-browser-module.cjs")("../assets/job-url-ui.js");
class Element{
 constructor(){this.value="";this.checked=false;this.hidden=false;this.disabled=false;this.children=[];this.handlers={};this.textContent="";}
 appendChild(x){this.children.push(x);return x;}replaceChildren(){this.children=[];}
 addEventListener(type,fn){(this.handlers[type]??=[]).push(fn);}
 dispatchEvent(event){for(const fn of this.handlers[event.type]||[])fn(event);}
 async emit(type){for(const fn of this.handlers[type]||[])await fn({type});}
}
async function setup(fetchOverride,publicMode=false,publicEnabled=true){
 const {extractPosting}=await import("../lib/job-url/extract.js");
 const data=extractPosting(fs.readFileSync(path.join(__dirname,"fixtures/job-url/structured.html"),"utf8"),"https://jobs.example.org/demo/security");
 const ids=["job-url","job-url-access","job-url-fetch","job-url-demo","job-url-status","job-url-review","job-url-draft","job-url-confirm","job-url-apply","job-url-undo","job-url-evidence","job-url-source","job-text"];
 const nodes=Object.fromEntries(ids.map(id=>[id,new Element()]));const calls=[];
 nodes["job-text"].value="기존에 작성한 직접 입력 공고";
 const win={Event:class{constructor(type){this.type=type;}},fetch:async(url,options)=>{calls.push({url,options});if(publicMode&&!options?.method)return new Response(JSON.stringify({enabled:publicEnabled,requiresAccessCode:false,mode:"public"}));return fetchOverride?fetchOverride(url,options):new Response(JSON.stringify({mode:"mock",aiEnabled:false,data}),{headers:{"content-type":"application/json"}});}};
 if(publicMode)win.MuttajiSession={get:async()=>"fake-csrf-token"};
 const controller=mount({getElementById:id=>nodes[id],createElement:()=>new Element()},win);
 if(publicMode)await new Promise(setImmediate);
 return {nodes,win,calls,controller,data};
}
test("URL typing does not fetch; explicit request sends URL only and renders editable grounded mock text",async()=>{
 const {nodes,calls}=await setup();nodes["job-url"].value="http://bad.example.org/";await nodes["job-url"].emit("input");assert.equal(calls.length,0);
 await nodes["job-url-fetch"].emit("click");assert.equal(calls.length,0);
 await nodes["job-url-demo"].emit("click");assert.equal(calls.length,0);
 await nodes["job-url-fetch"].emit("click");assert.equal(calls.length,1);
 assert.deepEqual(JSON.parse(calls[0].options.body),{url:"https://jobs.example.org/demo/security"});
 assert.equal(nodes["job-url-review"].hidden,false);assert.equal(nodes["job-url-access"].value,"");
 assert.match(nodes["job-url-source"].textContent,/가상 예제/);assert.match(nodes["job-url-draft"].value,/Linux 운영 경험/);
 assert.equal(nodes["job-text"].value,"기존에 작성한 직접 입력 공고");
});
test("unconfirmed edits cannot apply; confirmed text applies via input event and undo restores the original",async()=>{
 const {nodes,win}=await setup();await nodes["job-url-demo"].emit("click");await nodes["job-url-fetch"].emit("click");
 await nodes["job-url-apply"].emit("click");assert.equal(nodes["job-text"].value,"기존에 작성한 직접 입력 공고");
 nodes["job-url-confirm"].checked=true;nodes["job-url-draft"].value+="\n추가로 직접 수정한 문구";await nodes["job-url-draft"].emit("input");assert.equal(nodes["job-url-confirm"].checked,false);
 nodes["job-url-confirm"].checked=true;await nodes["job-url-confirm"].emit("change");assert.equal(nodes["job-url-apply"].disabled,false);
 let events=0;nodes["job-text"].addEventListener("input",()=>events++);
 await nodes["job-url-apply"].emit("click");assert.match(nodes["job-text"].value,/직접 수정한 문구/);assert.equal(events,1);
 assert.equal(win.MuttajiImportedPosting.reviewed,true);assert.equal(win.MuttajiImportedPosting.edited,true);
 await nodes["job-url-undo"].emit("click");assert.equal(nodes["job-text"].value,"기존에 작성한 직접 입력 공고");assert.equal(events,2);
 assert.equal(win.MuttajiImportedPosting,null);
});
test("a changed URL discards late responses and import failures preserve direct input",async()=>{
 let resolve;const pending=new Promise(done=>resolve=done);const {nodes,controller,data}=await setup(()=>pending);
 await nodes["job-url-demo"].emit("click");const request=nodes["job-url-fetch"].emit("click");controller.invalidate();
 resolve(new Response(JSON.stringify({mode:"mock",data}),{headers:{"content-type":"application/json"}}));await request;assert.equal(nodes["job-url-review"].hidden,true);
 const error=await setup(async()=>new Response(JSON.stringify({message:"접근 거부"}),{status:422,headers:{"content-type":"application/json"}}));
 await error.nodes["job-url-demo"].emit("click");await error.nodes["job-url-fetch"].emit("click");assert.match(error.nodes["job-url-status"].textContent,/직접 복사/);assert.equal(error.nodes["job-text"].value,"기존에 작성한 직접 입력 공고");
});
test("editing the main textarea invalidates URL provenance and cannot be overwritten by undo",async()=>{
 const {nodes,win}=await setup();await nodes["job-url-demo"].emit("click");await nodes["job-url-fetch"].emit("click");nodes["job-url-confirm"].checked=true;await nodes["job-url-apply"].emit("click");
 nodes["job-text"].value="사용자가 이후 다시 작성한 공고";await nodes["job-text"].emit("input");assert.equal(win.MuttajiImportedPosting,null);
 await nodes["job-url-undo"].emit("click");assert.equal(nodes["job-text"].value,"사용자가 이후 다시 작성한 공고");
});
test('public URL import uses session instead of asking for a test code',async()=>{
 const {nodes,calls}=await setup(null,true);assert.equal(nodes['job-url-access'].hidden,true);assert.equal(nodes['job-url-demo'].hidden,true);
 nodes['job-url'].value='https://jobs.example.org/demo/security';await nodes['job-url-fetch'].emit('click');
 assert.equal(calls[1].options.headers['x-muttaji-csrf'],'fake-csrf-token');assert.equal(calls[1].options.headers['x-job-import-token'],undefined);assert.equal(nodes['job-url-review'].hidden,false);
});

test('disabled public import stays disabled after editing URL and cannot send a POST',async()=>{
 const {nodes,calls}=await setup(null,true,false);assert.equal(nodes['job-url-fetch'].disabled,true);
 nodes['job-url'].value='https://jobs.example.org/job';await nodes['job-url'].emit('input');assert.equal(nodes['job-url-fetch'].disabled,true);
 await nodes['job-url-fetch'].emit('click');assert.equal(calls.length,1);assert.match(nodes['job-url-status'].textContent,/직접 붙여넣/);
});
