"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),{EventEmitter}=require("node:events");
const network=import("../lib/job-url/network.js");
function fakeRequest({headers={"content-type":"text/html"},status=200,chunks=[Buffer.from("<main>Job</main>")],remote="8.8.8.8"}={}){
 let captured;
 const request=(url,options,callback)=>{
  captured=options;const req=new EventEmitter();req.destroyed=false;
  req.destroy=error=>{req.destroyed=true;if(error)req.emit("error",error);};
  req.end=()=>queueMicrotask(()=>{
   const socket=new EventEmitter();socket.remoteAddress=remote;req.emit("socket",socket);socket.emit("secureConnect");if(req.destroyed)return;
   const res=new EventEmitter();res.statusCode=status;res.headers=headers;res.destroyed=false;res.destroy=()=>{res.destroyed=true;};
   callback(res);for(const chunk of chunks)if(!res.destroyed)res.emit("data",chunk);if(!res.destroyed)res.emit("end");
  });return req;
 };return {request,options:()=>captured};
}
const url=new URL("https://jobs.example.org/job");
const target={address:"8.8.8.8",family:4};
const opts=()=>({signal:new AbortController().signal,maxBytes:100,kind:"html"});
test("HTTPS request pins lookup, preserves TLS hostname and sends no auth/cookies or compression",async()=>{
 const {pinnedRequest}=await network;const fake=fakeRequest();const result=await pinnedRequest(url,target,opts(),fake.request);
 assert.equal(result.status,200);const options=fake.options();assert.equal(options.servername,url.hostname);assert.equal(options.agent,false);assert.notEqual(options.rejectUnauthorized,false);
 options.lookup("attacker-rebind.example.org",{},(error,address,family)=>{assert.equal(error,null);assert.equal(address,"8.8.8.8");assert.equal(family,4);});
 options.lookup(url.hostname,{all:true},(error,answers)=>assert.deepEqual(answers,[target]));
 assert.equal(options.headers["accept-encoding"],"identity");assert.equal(options.headers.cookie,undefined);assert.equal(options.headers.authorization,undefined);
});
test("transport rejects non-HTML, compression, oversized declarations, oversized streams and wrong peer",async()=>{
 const {pinnedRequest}=await network;
 for(const [response,code] of [[{headers:{"content-type":"application/pdf"}},"INVALID_CONTENT_TYPE"],[{headers:{"content-type":"text/html","content-encoding":"gzip"}},"UNSUPPORTED_ENCODING"],[{headers:{"content-type":"text/html","content-length":"101"}},"TOO_LARGE"],[{chunks:[Buffer.alloc(70),Buffer.alloc(50)]},"TOO_LARGE"],[{remote:"9.9.9.9"},"UNSAFE_DNS"]]){
  const fake=fakeRequest(response);await assert.rejects(pinnedRequest(url,target,opts(),fake.request),{code});
 }
});
test("transport preserves redirect for service validation and decodes Korean HTML without executing it",async()=>{
 const {pinnedRequest}=await network;
 const redirect=fakeRequest({status:302,headers:{location:"http://127.0.0.1/"}});
 assert.equal((await pinnedRequest(url,target,opts(),redirect.request)).headers.location,"http://127.0.0.1/");
 const korean=fakeRequest({headers:{"content-type":"text/html; charset=utf-8"},chunks:[Buffer.from("<main>보안 업무</main>")]});
 assert.equal((await pinnedRequest(url,target,opts(),korean.request)).body,"<main>보안 업무</main>");
});
test("AI adapter boundary stays disabled by default; approved fake output is grounded and never changes user status",async()=>{
 const {analyzePrepared}=await import("../lib/agent/provider-interface.js");
 const {prepare}=require("./load-browser-module.cjs")("../assets/agent-input.js");
 const request=prepare({posting:"필수조건\n- 보안 로그 분석 경험",profile:{experience:"학습 로그 분석 프로젝트 수행"},consent:true,revision:"r1"});
 const requirements=[{id:"required-0",sourceQuote:"보안 로그 분석 경험"}],catalog=[{id:1,name:"SQLD"}];
 let calls=0;
 const output={schemaVersion:1,revision:"r1",mode:"model-suggestion",needsHumanReview:true,items:[{id:"required-0",postingQuote:"보안 로그 분석 경험",interpretation:"로그 분석 경험에 관한 조건",taskType:"technical",keySkills:[{name:"로그 분석",quote:"로그 분석"}],profileEvidence:[{field:"experience",quote:"학습 로그 분석 프로젝트 수행"}],proposedStatus:"부분 충족",reason:"관련 학습 경험 입력이 있습니다.",missing:["실무 적용 범위는 제공되지 않았습니다."],actions:["프로젝트 결과를 소개 자료로 정리하세요."],certifications:[{id:1,reason:"학습 방향 참고용 추천",postingQuote:"로그 분석"}]}]};
 const adapter={async analyze(payload){calls++;assert.equal(payload.instructions.some(x=>x.includes("untrusted data")),true);return structuredClone(output);}};
 await assert.rejects(analyzePrepared({request,requirements,catalog,adapter}),{code:"AGENT_DISABLED"});assert.equal(calls,0);
 const base={request,requirements,catalog,adapter,enabled:true,ownerApproved:true};const before=JSON.stringify(request);
 assert.deepEqual(await analyzePrepared(base),output);assert.equal(JSON.stringify(request),before);
 for(const mutate of [x=>x.items[0].profileEvidence[0].quote="실무 10년",x=>x.items[0].postingQuote="없는 요건",x=>x.items[0].certifications[0].id=999,x=>x.score=99,x=>x.revision="old",x=>{x.items[0].profileEvidence=[];x.items[0].proposedStatus="충족";}]){
  const wrong=structuredClone(output);mutate(wrong);await assert.rejects(analyzePrepared({...base,adapter:{analyze:async()=>wrong}}),{code:"INVALID_AGENT_OUTPUT"});
 }
 assert.throws(()=>prepare({...request,posting:request.posting,profile:request.profile,revision:"r2",consent:false}));
 const imported={reviewed:false,text:request.posting,sourceUrl:"https://jobs.example.org/1"};
 assert.throws(()=>prepare({posting:request.posting,profile:request.profile,revision:"r2",consent:true,imported}),/IMPORT_REVIEW_REQUIRED/);
 await assert.rejects(analyzePrepared({...base,request:{...request,consent:{externalAi:false}}}),{code:"CONSENT_REQUIRED"});
});