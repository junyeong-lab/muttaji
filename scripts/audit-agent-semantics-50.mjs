// Offline contract audit by default. A mock pass is NOT a semantic model pass.
// Live verification belongs to the existing authenticated, shared-quota API.
// This audit deliberately has no provider credentials or paid-call escape hatch.
import {readFileSync,writeFileSync} from "node:fs";
import {createRequire} from "node:module";
import {pathToFileURL} from "node:url";
import {resolve} from "node:path";
import {analyzePrepared} from "../lib/agent/provider-interface.js";
import {prepareSemanticRequirements} from "../lib/agent/semantic-analysis.js";
const require=createRequire(import.meta.url),load=require("../tests/load-browser-module.cjs");
const parser=load("../assets/job-text-analyzer.js"),comparison=load("../assets/requirement-comparison.js");
const corpus=JSON.parse(readFileSync(new URL("../tests/fixtures/semantic-postings-50.json",import.meta.url),"utf8"));
const profile={"goal-job":"정보보안","education":"가상대학교 기관공학전공 학사 졸업","experience":"가상 지원자의 군 정보통신 업무\n사이버보안 기획\n정보자산·보안정책·취약점 점검\n사이버 위협 분석 및 정례 보고\n통신지원 및 부대 간 협력 경험","certs":"정보처리기사\nSQLD\n네트워크관리사 2급","skills":"Wazuh 로그 수집 및 분석 실습\nGNS3 네트워크 구축 실습\nLinux·Windows 시스템 실습\n가상 보안 교육 프로젝트"};
const catalog=JSON.parse(readFileSync(new URL("../data/certifications.json",import.meta.url),"utf8")).certifications.map(x=>({id:String(x.id),name:x.name}));
export function mockAdapter(){return {async analyze({request,requirements}){return {schemaVersion:1,revision:request.revision,mode:"model-suggestion",needsHumanReview:true,items:requirements.map(r=>{
 const quote=r.conditionQuote||r.sourceQuote;
 const clauses=(/필수가 아닙니다\./.test(quote)?quote.split(/(?<=필수가 아닙니다\.)\s*/).filter(Boolean):[quote]).flatMap(s=>s.split(/\s+(?:및|또는|혹은)\s+/));
 return {id:r.id,postingQuote:quote,interpretation:"계약 검사용 모의 응답이며 실제 의미 분석이 아닙니다.",taskType:"unclear",keySkills:[],profileEvidence:[],proposedStatus:"확인 필요",reason:"원문과 프로필을 사람이 검토해야 합니다.",missing:[],actions:[],certifications:[],semantics:{units:clauses.map((quote,i)=>({quote,obligation:/필수가 아닙니다/.test(quote)?"not_required":"unclear",roleScope:"unclear",roleQuote:"",applicantType:/경력\s*만\s*해당|경력의\s*경우/.test(quote)?"experienced":"unclear",applicantQuote:/경력\s*만\s*해당|경력의\s*경우/.test(quote)?quote:"",relation:i?"unclear":"start"})),uncertainties:[]}};
 })};}};}
export async function audit({live=false}={}){
 if(live)throw Error("LIVE_REQUIRES_APPROVED_RUNTIME: use the existing authenticated, quota-guarded API; no calls made");
 const adapter=mockAdapter(),rows=[];
 for(const record of corpus.records){
  const requirements=comparison.requirements(record.posting,parser).map(x=>{const sourceQuote=record.posting.includes(x.source)?x.source:x.text;return {id:x.id,sourceQuote,...(sourceQuote.includes(x.text)?{conditionQuote:x.text}:{})};});
  const prepared=prepareSemanticRequirements(record.posting,requirements);
  const row={id:record.id,url:record.url,ordinaryRequirements:requirements.length,agentRequirements:prepared.requirements.length,unexaminedCandidates:prepared.pending.length,mode:"mock-contract-only",liveModelExecuted:false,status:"not-run"};
  rows.push(row);
  if(requirements.length>20){row.status="not-run-item-limit";continue;}
  if(!requirements.length){row.status="not-run-no-requirements";continue;}
  const request={schemaVersion:1,revision:"audit-"+record.id,posting:record.posting,profile,source:{type:"manual"},consent:{externalAi:true}};
  try{
   const data=await analyzePrepared({request,requirements,catalog,adapter,enabled:true,ownerApproved:true,timeoutMs:45000});
   row.status="mock-contract-pass";
   row.items=data.items.length;row.units=data.items.reduce((n,x)=>n+(x.semanticAnalysis?.units.length||0),0);
  }catch(e){row.status="failed";row.error=e.code||"AUDIT_FAILED";row.validation=e.validation;}
 }
 return {sourceRun:corpus.sourceRun,sourceCommit:corpus.sourceCommit,live:false,externalCalls:0,total:rows.length,contractPass:rows.filter(x=>x.status==="mock-contract-pass").length,failed:rows.filter(x=>x.status==="failed").length,liveNotExecuted:50,rows};
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url){
 const args=process.argv.slice(2),live=args.includes("--live");
 try{
  const result=await audit({live});
  const output=args.find(x=>x.startsWith("--out="))?.slice(6);
  if(output)writeFileSync(output,JSON.stringify(result,null,2));
  console.log(JSON.stringify({...result,rows:result.rows.map(({output,...row})=>row)}));
  if(result.failed)process.exitCode=1;
 }catch(e){console.error(e.message);process.exitCode=1;}
}
