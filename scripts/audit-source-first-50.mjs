// Offline source-only boundary/coverage audit. NOT model prediction or accuracy.
import {readFileSync,writeFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
import {resolve} from "node:path";
import {classifyPosting} from "../lib/agent/posting-classifier.js";
const corpus=JSON.parse(readFileSync(new URL("../tests/fixtures/semantic-postings-50.json",import.meta.url),"utf8"));
export async function auditSourceFirst(){
 const rows=[];
 for(const r of corpus.records){
  const request={schemaVersion:1,revision:"source-"+r.id,posting:r.posting,source:{type:"manual"},consent:{externalAi:true}};
  const row={id:r.id,url:r.url,liveModelExecuted:false,semanticAccuracy:"not-verified",status:"not-run"};rows.push(row);
  const adapter={async classify(input){
   if(input.requirements!==undefined||input.request.profile!==undefined)throw Error("Source-only boundary violation");
   const lines=r.posting.split(/\r\n|\r|\n/),first=lines.findIndex(x=>x.trim());
   return {schemaVersion:1,revision:request.revision,mode:"posting-classification",complete:true,items:[{id:"mock-source",category:"unresolved",quote:lines[first],line:first+1,endLine:first+1,reason:"모의 계약 검사",basisQuote:"",roleQuote:"",applicantType:"unclear",applicantQuote:"",relation:"unclear",uncertainty:"실제 모델 의미 판정 미실행"}],referenceRanges:first+1<lines.length&&lines.slice(first+1).some(x=>x.trim())?[{line:first+2,endLine:lines.length,reason:"계약 검사용 원문 범위입니다. 실제 분류 결과가 아닙니다."}]:[]};
  }};
  try{const output=await classifyPosting({request,adapter,enabled:true,ownerApproved:true});row.status="mock-source-contract-pass";row.lines=output.coverage.totalLines;row.missingLines=output.coverage.missingLines;}
  catch(e){row.status="failed";row.error=e.code||"AUDIT_FAILED";row.validation=e.validation;}
 }
 return {kind:"source-only-contract-audit-not-model-accuracy",sourceRun:corpus.sourceRun,total:rows.length,mockPass:rows.filter(x=>x.status==="mock-source-contract-pass").length,failed:rows.filter(x=>x.status==="failed").length,actualModelExecuted:0,actualModelNotExecuted:rows.length,paidCalls:0,rows};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 if(process.argv.includes("--live"))throw Error("LIVE_REQUIRES_EXISTING_AUTHENTICATED_QUOTA_API: offline audit never invokes a provider");
 const result=await auditSourceFirst(),output=process.argv.find(x=>x.startsWith("--out="))?.slice(6);if(output)writeFileSync(output,JSON.stringify(result,null,2));
 console.log(JSON.stringify({total:result.total,mockPass:result.mockPass,failed:result.failed,actualModelExecuted:0,actualModelNotExecuted:result.total,paidCalls:0}));if(result.failed)process.exitCode=1;
}
