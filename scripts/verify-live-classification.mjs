// Explicit, bounded actual-model audit. Never loaded by the website or npm test.
import {readFile,mkdir,writeFile} from "node:fs/promises";
import {randomBytes,createHash} from "node:crypto";
import {createRequire} from "node:module";
import {createPublicRuntime} from "../lib/public/runtime.js";
const args=process.argv.slice(2),live=args.includes("--live"),consent=args.includes("--consent-public-postings");
const required=["OPENAI_API_KEY","MUTTAJI_SUPABASE_URL","MUTTAJI_SUPABASE_SECRET_KEY"];
const missing=required.filter(k=>!process.env[k]);
if(!live||!consent||process.env.MUTTAJI_AI_ENABLED!=="true"||process.env.MUTTAJI_AI_OWNER_APPROVED!=="true"||process.env.MUTTAJI_AI_MODEL!=="gpt-5.6-terra"||missing.length){
 console.log(JSON.stringify({status:"NOT_EXECUTED",reason:"Explicit consent, existing AI approval/model and shared quota credentials required",missing},null,2));process.exitCode=2;
}else{
 const origin="https://isolated-test.invalid";
 // In-process HTTP harness: real session/CSRF, shared quota, capped provider fetch.
 // No environment values, DB limits, namespaces or schema are modified.
 const rawOutputs=[];
 const runtime=createPublicRuntime({...process.env,VERCEL:"1",MUTTAJI_PUBLIC_ORIGIN:origin,MUTTAJI_PUBLIC_ENABLED:"true",MUTTAJI_PUBLIC_OWNER_APPROVED:"true",MUTTAJI_SESSION_SECRET:process.env.MUTTAJI_SESSION_SECRET||randomBytes(32).toString("hex")},{onClassificationOutput:value=>rawOutputs.push(value)});
 const settings=await (await runtime.model(new Request(origin+"/api/model-analysis"))).json();
 if(!settings.enabled){console.log(JSON.stringify({status:"NOT_EXECUTED",reason:"Existing runtime configuration disabled"}));process.exitCode=2;}
 else{
 const session=await runtime.session(new Request(origin+"/api/session",{headers:{"x-vercel-forwarded-for":"127.0.0.1"}}));
 const cookie=session.headers.get("set-cookie")?.split(";")[0],csrf=(await session.json()).csrfToken;
 const first=JSON.parse(await readFile(new URL("../tests/fixtures/source-first-cases.json",import.meta.url),"utf8")).records;
 const third=JSON.parse(await readFile(new URL("../tests/fixtures/semantic-postings-50.json",import.meta.url),"utf8")).records.find(r=>r.id==="50176196");
 const require=createRequire(import.meta.url),load=require("../tests/load-browser-module.cjs"),review=load("../assets/posting-review.js"),comparison=load("../assets/requirement-comparison.js"),roadmap=load("../assets/roadmap.js");
 const report={actualModel:true,model:process.env.MUTTAJI_AI_MODEL,startedAt:new Date().toISOString(),maximumRequests:3,rows:[]};
 for(const record of [...first,third].slice(0,3)){
  const request={schemaVersion:1,revision:"live-"+record.id,posting:record.posting,source:{type:"manual"},consent:{externalAi:true}};
  const response=await runtime.model(new Request(origin+"/api/model-analysis",{method:"POST",headers:{origin,"content-type":"application/json",cookie,"x-muttaji-csrf":csrf,"x-vercel-forwarded-for":"127.0.0.1"},body:JSON.stringify({task:"classify-posting",request})}));
  const payload=await response.json(),row={id:record.id,sourceSha256:createHash("sha256").update(record.posting).digest("hex"),httpStatus:response.status,apiSuccess:response.ok,error:payload.error||null,validation:payload.validation||null};
  row.rawModelOutput=rawOutputs.find(x=>x.revision===request.revision)||null;
  if(response.ok){
   const data=payload.data;row.counts=Object.fromEntries(["responsibilities","required","preferred","unresolved"].map(k=>[k,data.items.filter(x=>x.category===k).length]));
   row.classifications=data.items;row.coverage=data.coverage;row.semanticAccuracy="REQUIRES_HUMAN_REVIEW";
   const oracle=record.expected?record.expected.items.filter(x=>["responsibilities","required","preferred"].includes(x.category)):[...Array.from({length:10},(_,i)=>({line:27+i,endLine:27+i,category:"responsibilities"})),...Array.from({length:6},(_,i)=>({line:39+i,endLine:39+i,category:"required"})),...Array.from({length:7},(_,i)=>({line:52+i,endLine:52+i,category:"preferred"}))];
   row.expectedCounts=Object.fromEntries(["responsibilities","required","preferred"].map(k=>[k,oracle.filter(x=>x.category===k).length]));
   row.mismatches=oracle.filter(x=>!data.items.some(y=>y.category===x.category&&y.line<=x.line&&y.endLine>=x.endLine)).map(({line,endLine,category})=>({line,endLine,expected:category}));
   row.sampleConditionOraclePass=!row.mismatches.length&&Object.entries(row.expectedCounts).every(([k,v])=>row.counts[k]===v);
   const state=review.create();state.receive(record.posting,data);row.draftUnapproved=state.snapshot().approved===null;
   const approved=state.approve(record.posting,true);const items=comparison.requirements(record.posting,{analyze(){throw Error("unexpected rule parser");}},approved);
   // Simulated explicit user approval, not a real user's approved eligibility.
   const plan=roadmap.buildRoadmap(items.map(x=>({...x,status:"확인 필요"})));
   row.handoff={kind:"automated-approval-contract",comparisonCount:items.length,roadmapCount:plan.total,autoFulfilled:plan.totals["충족"]};
  }
  report.rows.push(row);console.log(JSON.stringify({id:row.id,httpStatus:row.httpStatus,counts:row.counts,error:row.error,validation:row.validation}));
  // No repeat for failures; no further spend after budget/auth/availability failures.
  if(!response.ok)break;
 }
 const folder=new URL("../live-results/",import.meta.url);await mkdir(folder,{recursive:true});
 const file=new URL("classification-"+Date.now()+".json",folder);await writeFile(file,JSON.stringify(report,null,2));console.log("REPORT: "+file.pathname);
 }
}
