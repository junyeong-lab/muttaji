// Diagnostic-only: inspect public job-posting section boundaries without profile data.
import {createImporter} from "../lib/job-url/service.js";
import {createRequire} from "node:module";
const require=createRequire(import.meta.url);
const load=require("../tests/load-browser-module.cjs");
const {analyze}=load("../assets/job-text-analyzer.js");
const ids=["50121037"];
const importer=createImporter({timeoutMs:18000});
for(const id of ids){
 const site=id==="49554833"?"saramin":"jobkorea";
 const url=site==="saramin"?"https://www.saramin.co.kr/zf_user/jobs/view?rec_idx="+id:"https://www.jobkorea.co.kr/Recruit/GI_Read/"+id;
 try{
  const result=await importer(url);
  const parsed=analyze(result.text);
  const lines=result.text.split("\n");
  // Only bounded excerpts around structural labels; no applicant profiles.
  const candidates=lines.map((line,i)=>({line:line.trim(),i})).filter(x=>/필수|우대|자격|지원|경력|근무|직무|담당|이런|혜택|복지|채용|전형|접수|공고|모집|요건|조건/i.test(x.line)||x.i<4).slice(0,22).map(x=>({line:x.i+1,text:x.line.slice(0,85)}));
  console.log(JSON.stringify({id,site,chars:result.text.length,method:result.method,required:parsed.required.length,preferred:parsed.preferred.length,unresolved:parsed.unresolved.length,heads:candidates}));
 }catch(error){console.log(JSON.stringify({id,site,reason:error.code||"FAILED"}));}
}
