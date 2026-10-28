// Re-evaluate the immutable 50 real-public-posting source snapshot through current browser parser.
// Does not download advertisements again or publish source text to the repository.
import {readFileSync,writeFileSync} from "node:fs";
import {createRequire} from "node:module";
const require=createRequire(import.meta.url);
const {analyze}=require("../tests/load-browser-module.cjs")("../assets/job-text-analyzer.js");
const snapshots=JSON.parse(readFileSync("baseline/real-50-semantic-source.json","utf8")).records;
const corpus=JSON.parse(readFileSync(new URL("../tests/fixtures/real-postings-smoke.json",import.meta.url),"utf8"));
if(snapshots.length!==50||corpus.length!==50)throw Error("Unexpected snapshot count");
const rows=[];
for(const before of snapshots){
 const expected=corpus.find(x=>x.url===before.url);
 if(!expected)throw Error("Snapshot no longer matches current real URL set");
 if(!before.ok||!before.lines?.length)throw Error("Source snapshot missing for "+before.id);
 const text=before.lines.map(x=>x.text).join("\n");
 const parsed=analyze(text);
 const result={number:before.number,id:before.id,field:before.field,site:before.site,url:before.url,lines:before.lines,counts:{},classified:{},previousCounts:before.counts};
 for(const key of ["company","role","responsibilities","required","preferred","unresolved"]){
  result.classified[key]=parsed[key].map(x=>({line:x.line,endLine:x.endLine||x.line,text:x.text,sectionHeading:!!x.sectionHeading,kindHint:x.kindHint||null}));
  result.counts[key]=result.classified[key].filter(x=>!x.sectionHeading).length;
 }
 rows.push(result);
 console.log("RECLASSIFIED",JSON.stringify({id:result.id,field:result.field,required:result.counts.required,preferred:result.counts.preferred,previousRequired:before.counts.required,previousPreferred:before.counts.preferred}));
}
writeFileSync("real-50-semantic-current.json",JSON.stringify({timestamp:new Date().toISOString(),codeVersion:process.env.GITHUB_SHA,originRunId:40721100626,records:rows},null,2));
writeFileSync("real-50-semantic-current-index.json",JSON.stringify(rows.map(x=>({number:x.number,id:x.id,site:x.site,field:x.field,counts:x.counts,previousCounts:x.previousCounts})),null,2));
console.log("RECLASSIFY_SUMMARY",JSON.stringify({unique:rows.length,fields:[...new Set(rows.map(x=>x.field))]}));
