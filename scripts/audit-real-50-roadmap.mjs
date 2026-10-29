import {readFileSync,writeFileSync} from "node:fs";
import {createRequire} from "node:module";
const require=createRequire(import.meta.url),load=require("../tests/load-browser-module.cjs");
const {analyze,nonRequirementKind}=load("../assets/job-text-analyzer.js");
const {requirements,assessment,credentialSuggestion,degreeSuggestion,certificateMatches}=load("../assets/requirement-comparison.js");
const {buildAnalysis}=load("../assets/experience-explanations.js");
const {buildRoadmap}=load("../assets/roadmap.js");
const corpus=JSON.parse(readFileSync(new URL("../tests/fixtures/real-postings-smoke.json",import.meta.url),"utf8"));
const snapshots=JSON.parse(readFileSync("baseline/real-50-semantic-source.json","utf8")).records;
const profile={"goal-job":"정보보호 컨설팅, 보안점검, IT 운영",education:"국립목포해양대학교 기관공학전공 학사 졸업",
 experience:"해군 사이버보안 기획·정책 점검·기관평가 대응·위협 분석·정례 보고. ISMS-P 심사나 민간 클라우드 운영 경력 없음.",
 certs:"정보처리기사; SQLD; 네트워크관리사 2급",
 skills:"Wazuh SIEM 로그 분석 실습, GNS3 네트워크 구성 실습, Linux 및 Windows 관리 실습, 보안정책 점검"
};
if(corpus.length!==50||snapshots.length!==50)throw Error("Expected 50 public postings");
const records=[];
for(const row of snapshots){
 if(!corpus.some(x=>x.url===row.url)||!row.ok)throw Error("Source snapshot identity missing "+row.id);
 const source=row.lines.map(x=>x.text).join("\n");
 const parsed=analyze(source),items=requirements(source,{analyze,nonRequirementKind});
 const decisions=items.map(item=>{const candidate=credentialSuggestion(item,profile.certs)||degreeSuggestion(item,profile.education);return assessment(item,candidate?.status||"확인 필요",candidate?.reason||"");});
 const explanations=buildAnalysis({posting:source,requirements:items,profile,assessments:decisions,certificateMatcher:certificateMatches});
 const roadmap=buildRoadmap(decisions.map((d,i)=>({...d,experienceExplanation:explanations.explanations[i]})));
 const errors=[],warnings=[];
 if(roadmap.total!==items.length||roadmap.groups.reduce((sum,g)=>sum+g.items.length,0)!==items.length)errors.push("ROADMAP_NOT_SYNCED");
 if(roadmap.tasks.some(t=>t.steps.length!==3))errors.push("NON_THREE_STEP_ROADMAP");
 if(items.some(x=>x.line<1||x.endLine>row.lines.length||x.endLine<x.line))errors.push("SOURCE_LINE_INVALID");
 if(roadmap.completed.some(x=>!/(?:보유\s*자격증|학사|학력|졸업|취득|학위)/.test(x.reason)))errors.push("AUTO_FULFILLED_WITHOUT_CERT_OR_DEGREE");
 if(items.some(x=>/^(?:근무시간|근무지|제출서류|절차안내|서류전형|면접전형|4대보험|퇴직금)/.test(x.text)))errors.push("ADMIN_CONTENT_AS_ELIGIBILITY");
 if(roadmap.tasks.some(x=>!items.some(y=>x.kind===y.kind&&x.line===y.line&&x.text===y.text)))errors.push("STALE_ROADMAP");
 if(!parsed.required.length)warnings.push("NO_REQUIRED_IN_POSTING");
 if(!parsed.preferred.length)warnings.push("NO_PREFERRED_IN_POSTING");
 if(items.some(x=>x.text.length>250))warnings.push("COMPOUND_LONG_CONDITION");
 if(items.some(x=>/신입.{0,20}경력|경력.{0,20}신입|필수.{0,15}아니/.test(x.text)))warnings.push("MULTI_BRANCH_OR_NEGATION");
 const result={id:row.id,site:row.site,field:row.field,url:row.url,required:parsed.required.length,preferred:parsed.preferred.length,conditions:items.length,totals:roadmap.totals,errors,warnings,
 items:items.map((item,i)=>({kind:item.kind,line:item.line,text:item.text,status:decisions[i].status,reason:decisions[i].explanation,steps:roadmap.tasks.find(t=>t.kind===item.kind&&t.line===item.line&&t.text===item.text)?.steps||[]}))};
 records.push(result);
 console.log("ROADMAP_QA",JSON.stringify({id:result.id,conditions:items.length,completed:roadmap.completed.length,open:roadmap.tasks.length,errors,warnings}));
}
const totals={postings:records.length,conditions:records.reduce((x,r)=>x+r.conditions,0),failed:records.filter(r=>r.errors.length).length,flagged:records.filter(r=>r.warnings.length).length,fulfilled:records.reduce((x,r)=>x+r.totals["충족"],0),fields:[...new Set(records.map(r=>r.field))].length};
writeFileSync("real-50-roadmap-audit.json",JSON.stringify({generated:new Date().toISOString(),totals,records},null,2));
console.log("ROADMAP_AUDIT_SUMMARY",JSON.stringify(totals));
if(totals.postings!==50||totals.failed)process.exitCode=1;
