"use strict";
// 1,000 deterministic SYNTHETIC posting scenarios.
// These are NOT 1,000 real Saramin/JobKorea postings.
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const load=require("./load-browser-module.cjs");
const {analyze}=load("../assets/job-text-analyzer.js");
const {requirements,assessment,credentialSuggestion,degreeSuggestion,certificateMatches}=load("../assets/requirement-comparison.js");
const {buildAnalysis}=load("../assets/experience-explanations.js");
const {buildRoadmap}=load("../assets/roadmap.js");
const db=JSON.parse(fs.readFileSync(path.join(__dirname,"../data/certifications.json"),"utf8")).certifications;
const types={
 "정보보안":["보안 운영","보안 이벤트 로그 분석"],
 "정보보호":["정보보호 관리체계","보안 정책 점검"],
 "개인정보보호":["개인정보보호 관리","개인정보 처리 점검"],
 "네트워크":["네트워크 엔지니어","VLAN 및 라우팅 설정"],
 "시스템":["서버 운영","Linux 계정 및 서비스 관리"],
 "정보통신":["통신망 운영","TCP/IP 통신 점검"],
 "클라우드":["클라우드 엔지니어","AWS 접근권한 검토"],
 "데이터":["데이터 엔지니어","SQL 데이터 모델링"],
 "데이터분석":["데이터 분석가","통계 분석 및 시각화"],
 "소프트웨어":["소프트웨어 개발자","웹 서비스 개발"],
 "IT":["IT 기획 및 운영","정보시스템 운영"]
};
const fields=Object.keys(types);
const userCerts=["정보처리기사","SQLD","네트워크관리사 2급"];
const profile={
 "goal-job":"정보보안, 데이터, 네트워크, IT 운영",
 education:"4년제 대학교 학사 졸업",
 experience:"사이버보안 기획 및 정보자산 점검. 사이버 위협 분석과 지휘관 보고 자료 작성.",
 certs:userCerts.join("\n"),
 skills:"Linux 및 GNS3 네트워크 실습. Wazuh 로그 분석 실습. XDR 학습 프로젝트."
};
function sample(index){
 const field=fields[index%fields.length];
 const options=db.filter(x=>x.field===field);
 assert.ok(options.length,field);
 const selected=options[Math.floor(index/fields.length)%options.length];
 const [role,work]=types[field];
 const numbered=index+1;
 const level=["경력 2년 이상","관련 실무 수행 경험","업무 이해","프로젝트 참여 경험"][Math.floor(index/37)%4];
 const duties=[
   "필수 조건에 해당하는 실제 업무 경험과 증빙을 확인하세요.",
   "관련 시스템 운영 절차와 장애 처리 경험",
   "담당 업무 관련 보안·개발·데이터의 기초 지식",
   "부서와 협업하여 작성한 보고서와 산출물"
 ];
 const posting=[
  "기업명: 가상 검증기업 "+numbered,
  "모집 직무: "+role,
  "담당업무",
  "- "+work,
  "필수조건",
  "- "+level,
  "- "+duties[index%duties.length],
  "우대사항",
  "- "+selected.name+" 보유",
  "- "+work+" 관련 경력"
 ].join("\n");
 return {field,selected,posting,index};
}
function verify(scenario){
 const {posting,selected,index,field}=scenario;
 const parsed=analyze(posting);
 assert.equal(parsed.method,"rule-based","scenario "+index+" method");
 assert.equal(parsed.required.length,2,"scenario "+index+" required");
 assert.equal(parsed.preferred.length,2,"scenario "+index+" preferred");
 const items=requirements(posting,{analyze});
 assert.equal(items.length,4,"scenario "+index+" total requirements");
 const cert=items.find(x=>x.kind==="preferred"&&x.text.includes(selected.name));
 assert.ok(cert,"scenario "+index+" preferred cert");
 const matched=userCerts.includes(selected.name);
 const auto=credentialSuggestion(cert,profile.certs);
 assert.equal(Boolean(auto),matched,"scenario "+index+" cert "+selected.name);
 const decided=items.map(item=>{
  const hint=credentialSuggestion(item,profile.certs)||degreeSuggestion(item,profile.education);
  return assessment(item,hint?.status||"확인 필요",hint?.reason||"");
 });
 const explanation=buildAnalysis({posting,requirements:items,profile,assessments:decided,certificateMatcher:certificateMatches});
 assert.equal(explanation.explanations.length,4,"scenario "+index+" explanations");
 const lines=posting.split("\n");
 for(const e of explanation.explanations){
  const quote=lines.slice(e.postingEvidence.line-1,e.postingEvidence.endLine).join("\n");
  assert.equal(e.postingEvidence.quote,quote,"scenario "+index+" source citation");
  assert.ok(!Object.hasOwn(e,"status"),"scenario "+index+" explanation must not decide status");
  for(const ref of e.inputEvidence){
   const origin=ref.source==="profile"?profile[ref.field]:decided.find(d=>d.id===ref.field)?.explanation;
   assert.equal(origin.slice(ref.start,ref.end),ref.quote,"scenario "+index+" profile quote");
  }
 }
 const road=buildRoadmap(decided.map((item,i)=>({...item,experienceExplanation:explanation.explanations[i]})));
 assert.equal(road.total,4,"scenario "+index+" roadmap total");
 assert.equal(road.groups.reduce((n,x)=>n+x.items.length,0),4,"scenario "+index+" roadmap groups");
 assert.equal(road.totals["충족"],matched?1:0,"scenario "+index+" fulfilled count");
 assert.equal(road.totals["확인 필요"],matched?3:4,"scenario "+index+" unverified count");
 for(const task of road.tasks){
  assert.equal(task.steps.length,3,"scenario "+index+" "+field+" steps");
  assert.ok(task.steps.every(s=>s.length>12),"scenario "+index+" step content");
  assert.match(task.steps[2],/내 역량/,"scenario "+index+" review instruction");
 }
}
test("1,000 deterministic synthetic jobs across all 11 certification fields complete the real app module chain",()=>{
 const counts=Object.fromEntries(fields.map(f=>[f,0]));
 for(let i=0;i<1000;i++){
  const s=sample(i);verify(s);counts[s.field]++;
 }
 assert.equal(Object.keys(counts).length,11);
 assert.equal(Object.values(counts).reduce((a,b)=>a+b,0),1000);
 assert.ok(Object.values(counts).every(n=>n>=90));
});
test("1,000 scenarios do not equate similar credentials or claimed experience to verified employer eligibility",()=>{
 const {ownedCertificates}=load("../assets/requirement-comparison.js");
 for(const [requested,owned] of [
   ["정보처리산업기사 보유","정보처리기사"],
   ["네트워크관리사 1급 보유","네트워크관리사 2급"],
   ["SQLP 보유","SQLD"],
   ["정보보안기사 보유","정보처리기사"],
   ["정보보안산업기사 보유","정보보안기사"]
 ]){
   const item={kind:"preferred",text:requested};
   assert.equal(credentialSuggestion(item,owned),null,requested+" "+owned);
 }
 assert.ok(ownedCertificates("정보처리기사\nSQLD\n네트워크관리사 2급").length===3);
});
