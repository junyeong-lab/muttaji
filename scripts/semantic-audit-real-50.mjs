// Capture final current 50 public vacancies after replacement of an unfilled employer template.
// Reaudit all fifty real posted texts after corrected semantic section boundaries.
import {readFileSync,writeFileSync} from "node:fs";
import {createRequire} from "node:module";
import {createImporter} from "../lib/job-url/service.js";
const require=createRequire(import.meta.url);
const {analyze}=require("../tests/load-browser-module.cjs")("../assets/job-text-analyzer.js");
const corpus=JSON.parse(readFileSync(new URL("../tests/fixtures/real-postings-smoke.json",import.meta.url),"utf8"));
if(corpus.length!==50||new Set(corpus.map(x=>x.url)).size!==50)throw Error("Need 50 unique URLs");
const importer=createImporter();
const records=[];
for(let i=0;i<corpus.length;i++){
 const item=corpus[i],id=item.url.match(/(?:GI_Read\/|rec_idx=)(\d+)/)?.[1];
 const row={number:i+1,id,site:item.site,field:item.field,url:item.url,sourceNote:item.note||"",method:"",length:0,ok:false,lines:[],classified:{},flags:[],counts:{}};
 try{
  const source=await importer(item.url);
  row.method=source.method;row.length=source.text.length;row.ok=source.contentStatus==="body";
  const lines=source.text.split(/\r?\n/);
  row.lines=lines.map((text,index)=>({line:index+1,text}));
  const parsed=analyze(source.text);
  for(const group of ["company","role","responsibilities","required","preferred","unresolved"]){
   row.classified[group]=parsed[group].map(x=>({line:x.line,endLine:x.endLine||x.line,text:x.text,sectionLine:x.sectionLine||null,sectionHeading:!!x.sectionHeading,kindHint:x.kindHint||null}));
   row.counts[group]=row.classified[group].filter(x=>!x.sectionHeading).length;
  }
  const assigned=Array.from({length:lines.length+1},()=>new Set());
  for(const [g,values] of Object.entries(row.classified))for(const x of values)for(let k=x.line;k<=x.endLine;k++)if(assigned[k])assigned[k].add(g);
  const headingRule=[
   {g:"preferred",re:/^(?:우대(?:\s*(?:사항|조건|요건|자격))?|이런\s*분(?:이라면|이면).*좋아요|가산점|preferred)$/i},
   {g:"required",re:/^(?:필수(?:\s*(?:요건|조건|자격|사항))?|자격\s*요건|지원\s*자격|지원\s*요건|이런\s*분.*찾고\s*있어요)$/i},
   {g:"responsibilities",re:/^(?:담당\s*업무|주요\s*업무|수행\s*업무|이런\s*업무를\s*해요)$/i},
   {g:"unresolved",re:/^(?:복리\s*후생|복지\s*혜택|근무\s*(?:조건|시간|지역|지|장소)|채용\s*절차|전형\s*절차|접수\s*(?:기간|방법)|기타\s*사항|지원\s*방법)$/i}
  ];
  let headed="unresolved";
  for(let k=0;k<lines.length;k++){
   const val=lines[k].trim().replace(/^[\s■●•◦▷▶▪·ㆍ*\-]+/,"").replace(/[：:]$/,"").replace(/^[\[(【]\s*|\s*[\])】]$/g,"").trim();
   if(!val)continue;
   for(const marker of headingRule)if(marker.re.test(val)){headed=marker.g;break;}
   const actual=[...assigned[k+1]];
   if(!actual.length)continue;
   if(actual.some(g=>g==="required"||g==="preferred")){
     if(/(?:복리후생|식대\s*지원|연차\s*휴가|퇴직금|4대\s*보험|서류\s*전형|면접\s*전형|제출\s*서류|접수\s*마감|출퇴근|근무\s*요일|회사\s*소개)/.test(val))row.flags.push({kind:"NON_REQUIREMENT_LEAK",line:k+1,text:val.slice(0,180),actual});
     if(/(?:^우대\s*[:：]|우대\s*사항\s*[:：]|우대\s*조건\s*[:：])/.test(val)&&actual.includes("required"))row.flags.push({kind:"EXPLICIT_PREFERRED_AS_REQUIRED",line:k+1,text:val.slice(0,180),actual});
     if(/(?:^필수\s*[:：]|^자격\s*요건\s*[:：]|^지원\s*자격\s*[:：])/.test(val)&&actual.includes("preferred"))row.flags.push({kind:"EXPLICIT_REQUIRED_AS_PREFERRED",line:k+1,text:val.slice(0,180),actual});
     if(headed==="preferred"&&actual.includes("required"))row.flags.push({kind:"SECTION_PREFERRED_BUT_REQUIRED",line:k+1,text:val.slice(0,180),actual});
     if(headed==="required"&&actual.includes("preferred")&&!/우대(?:자|해|할|함|되|가)?\s*$/.test(val))row.flags.push({kind:"SECTION_REQUIRED_BUT_PREFERRED",line:k+1,text:val.slice(0,180),actual});
     if(headed==="unresolved"&&/^(?:근무|복지|채용|전형|접수)/.test(val))row.flags.push({kind:"BOUNDARY_UNKNOWN",line:k+1,text:val.slice(0,180),actual});
   }
  }
  for(const [g,values] of Object.entries(row.classified))for(const x of values){
   const ev=lines.slice(x.line-1,x.endLine).map(t=>t.trim()).join("\n");
   if(!ev.trim())row.flags.push({kind:"EMPTY_EVIDENCE",line:x.line,g,text:x.text.slice(0,100)});
   if(x.endLine<x.line||x.line<1||x.endLine>lines.length)row.flags.push({kind:"INVALID_LINE_RANGE",line:x.line,g});
  }
  if(!row.counts.required)row.flags.push({kind:"NO_REQUIRED",line:0});
  if(!row.counts.preferred)row.flags.push({kind:"NO_PREFERRED",line:0});
  if(row.counts.unresolved>=10)row.flags.push({kind:"MANY_UNRESOLVED",line:0,count:row.counts.unresolved});
  if(row.counts.required>15||row.counts.preferred>15)row.flags.push({kind:"MANY_CLASSIFIED",line:0,required:row.counts.required,preferred:row.counts.preferred});
  row.flags=[...new Map(row.flags.map(f=>[f.kind+":"+f.line+":"+(f.actual?.join()||""),f])).values()];
 }catch(e){row.error=e.code||String(e.message).slice(0,200);row.flags.push({kind:"SOURCE_FETCH_FAILED",reason:row.error});}
 records.push(row);
 console.log("AUDIT_CASE",JSON.stringify({number:row.number,id:row.id,ok:row.ok,counts:row.counts,flagCount:row.flags.length,error:row.error}));
 await new Promise(r=>setTimeout(r,1300));
}
const index=records.map(row=>({number:row.number,id:row.id,site:row.site,field:row.field,ok:row.ok,error:row.error,lines:row.lines.length,counts:row.counts,flagCount:row.flags.length,flags:row.flags.slice(0,15)}));
writeFileSync("real-50-semantic-source.json",JSON.stringify({timestamp:new Date().toISOString(),auditVersion:1,records},null,2));
writeFileSync("real-50-semantic-index.json",JSON.stringify({timestamp:new Date().toISOString(),target:50,imported:records.filter(x=>x.ok).length,cases:index},null,2));
console.log("AUDIT_SUMMARY",JSON.stringify({total:records.length,imported:records.filter(x=>x.ok).length,failures:records.filter(x=>!x.ok).map(x=>({id:x.id,error:x.error})),flagged:records.filter(x=>x.flags.length).length,flags:records.reduce((a,x)=>a+x.flags.length,0)}));
if(records.filter(x=>x.ok).length!==50)process.exitCode=1;
