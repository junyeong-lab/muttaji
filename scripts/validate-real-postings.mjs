// A bounded, non-AI smoke test of real public job-posting URLs.
// This checks the existing application modules, not a browser's private profile.
// Respect robots.txt and access restrictions; never bypass a challenge.
import {readFileSync} from "node:fs";
import {createRequire} from "node:module";
import {createImporter} from "../lib/job-url/service.js";
const require=createRequire(import.meta.url);
const load=require("../tests/load-browser-module.cjs");
const {analyze}=load("../assets/job-text-analyzer.js");
const {requirements,assessment,credentialSuggestion,degreeSuggestion,certificateMatches}=load("../assets/requirement-comparison.js");
const {buildAnalysis}=load("../assets/experience-explanations.js");
const {buildRoadmap}=load("../assets/roadmap.js");
const corpus=JSON.parse(readFileSync(new URL("../tests/fixtures/real-postings-smoke.json",import.meta.url),"utf8"));
const knownFields=new Set(JSON.parse(readFileSync(new URL("../data/certifications.json",import.meta.url),"utf8")).certifications.map(x=>x.field));
const seen=new Set(),unique=[];
for(const entry of corpus){
  if(!knownFields.has(entry.field)||!["jobkorea","saramin"].includes(entry.site))throw Error("invalid field or provider");
  const key=entry.site==="jobkorea"?entry.url.match(/GI_Read\/(\d+)/)?.[1]:entry.url.match(/rec_idx=(\d+)/)?.[1];
  if(!key)throw Error("URL identifier absent");
  if(!seen.has(entry.site+":"+key)){seen.add(entry.site+":"+key);unique.push(entry);}
}
if(unique.length>1000)throw Error("1000 posting safety cap");
const importer=createImporter();
const profile={
  "goal-job":"정보보안·개인정보보호·IT 서비스·데이터 분야",
  education:"4년제 대학교 학사 졸업",
  experience:"사이버보안 기획 및 기관평가 대응. 정보자산·보안정책·취약점 점검. 사이버 위협 분석과 월간 보고자료 작성.",
  certs:"정보처리기사; SQLD; 네트워크관리사 2급",
  skills:"Wazuh SIEM 로그 분석 실습. GNS3 네트워크 구성 실습. XDR 보안 탐지·대응 학습 프로젝트."
};
const rows=[];
for(const entry of unique){
 const record={site:entry.site,field:entry.field,id:entry.site==="jobkorea"?entry.url.match(/GI_Read\/(\d+)/)[1]:entry.url.match(/rec_idx=(\d+)/)[1]};
 try{
  const posting=await importer(entry.url);
  record.import=posting.contentStatus==="partial"?"partial":"ok";
  record.method=posting.method;
  if(posting.text.length>20000||posting.text.split(/\r?\n/).length>400)throw Object.assign(Error("input too large for browser parser"),{code:"PARSER_LIMIT"});
  const parsed=analyze(posting.text);
  record.sections={required:parsed.required.length,preferred:parsed.preferred.length,unresolved:parsed.unresolved.length};
  const items=requirements(posting.text,{analyze});
  if(!items.length){record.validation="requires-human-review";record.reason="NO_REQUIRED_OR_PREFERRED";rows.push(record);continue;}
  const decisions=items.map(item=>{
    const suggestion=credentialSuggestion(item,profile.certs)||degreeSuggestion(item,profile.education);
    return assessment(item,suggestion?.status||"확인 필요",suggestion?.reason||"");
  });
  const explanations=buildAnalysis({posting:posting.text,requirements:items,profile,assessments:decisions,certificateMatcher:certificateMatches});
  const plan=buildRoadmap(decisions.map((item,i)=>({...item,experienceExplanation:explanations.explanations[i]})));
  if(plan.total!==items.length||plan.groups.reduce((n,g)=>n+g.items.length,0)!==items.length)throw Object.assign(Error("roadmap requirement count mismatch"),{code:"ROADMAP_INCONSISTENT"});
  if(explanations.explanations.some(x=>x.postingEvidence.line<1||x.postingEvidence.endLine>posting.text.split(/\r?\n/).length))throw Object.assign(Error("source evidence out of bounds"),{code:"EVIDENCE_MISMATCH"});
  if(plan.tasks.some(x=>x.steps.length!==3))throw Object.assign(Error("roadmap steps mismatch"),{code:"ROADMAP_STEPS"});
  record.validation="module-chain-pass";
  record.requirements=items.length;
  record.statuses=plan.totals;
 }catch(error){
   record.validation="not-completed";
   record.reason=error.code||error.name||"UNKNOWN";
   if(["ROBOTS_DENIED","ROBOTS_UNAVAILABLE","ACCESS_DENIED","BOT_CHALLENGE","LOGIN_REQUIRED"].includes(record.reason))record.blocker="source-access";
   else if(["PARTIAL_POSTING","NO_POSTING","TIMEOUT","NO_REQUIRED_OR_PREFERRED"].includes(record.reason))record.blocker="insufficient-public-content";
   else record.blocker="investigate";
 }
 rows.push(record);
 // polite bounded crawl: sequential requests and no retries/challenge bypass
 await new Promise(resolve=>setTimeout(resolve,1200));
}
const summary={
 target:1000,
 uniqueSeeded:unique.length,
 moduleChainPass:rows.filter(x=>x.validation==="module-chain-pass").length,
 incomplete:rows.filter(x=>x.validation!=="module-chain-pass").length,
 bySite:Object.fromEntries(["jobkorea","saramin"].map(site=>[site,{tested:rows.filter(x=>x.site===site).length,passed:rows.filter(x=>x.site===site&&x.validation==="module-chain-pass").length}])),
 testedFields:[...new Set(rows.map(x=>x.field))],
 results:rows
};
console.log(JSON.stringify(summary,null,2));
if(rows.length!==unique.length||rows.some(r=>r.blocker==="investigate"))process.exitCode=1;
