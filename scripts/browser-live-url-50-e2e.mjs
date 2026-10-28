// Verify semantic parser corrections against current 50 real URLs in the deployed browser.
// Verify the final 25 JobKorea + 25 Saramin corpus after live-checked network source replacement.
// Revalidate the deployed 17-second bounded importer and 19-second client timeout.
// Live production URL-button-to-roadmap browser test, sequential public requests.
import fs from "node:fs";
import {performance} from "node:perf_hooks";
import {chromium} from "playwright";
const root=process.env.MUTTAJI_E2E_BASE_URL||"https://project-muttaji.vercel.app";
const entries=JSON.parse(fs.readFileSync(new URL("../tests/fixtures/real-postings-smoke.json",import.meta.url),"utf8"));
if(entries.length!==50||new Set(entries.map(x=>x.url)).size!==50)throw Error("Exactly 50 unique public job posting URLs required");
const profile={
 "goal-job":"정보보안 컨설팅, 개인정보보호, IT 운영",
 education:"국립목포해양대학교 기관공학전공 학사 졸업",
 experience:"2021년부터 2026년까지 해군 정보통신장교. 사이버보안 기획과 보안정책·자산·취약점 점검, 위협 분석 및 지휘관 보고. Wazuh·GNS3는 실습으로 구분.",
 certs:"정보처리기사\nSQLD\n네트워크관리사 2급",
 skills:"네트워크 구성 실습, Linux 관리 실습, Wazuh SIEM 로그 분석 실습, 위협정보 분석, 보안정책 점검"
};
const out="real-url-browser-report.json";
const report={target:50,mode:"actual-live-URL-button-through-app-UI",started:new Date().toISOString(),urlMode:null,records:[]};
let browser;
function save(){fs.writeFileSync(out,JSON.stringify(report,null,2));}
function pct(a,p){if(!a.length)return null;const sorted=[...a].sort((x,y)=>x-y);return Math.round(sorted[Math.min(sorted.length-1,Math.ceil(sorted.length*p)-1)]);}
try{
 browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
 const page=await browser.newPage({locale:"ko-KR",viewport:{width:1280,height:900}});
 page.setDefaultTimeout(12000);
 const browserErrors=[];page.on("pageerror",err=>browserErrors.push(String(err).slice(0,160)));
 await page.goto(root+"/#analyze",{waitUntil:"domcontentloaded",timeout:30000});
 await page.locator("#job-url-fetch").waitFor();
 const mode=await page.evaluate(async()=>{
   try{const response=await fetch("/api/job-url-import",{cache:"no-store"});
    return {status:response.status,...await response.json()};
   }catch(error){return {error:String(error).slice(0,250)};}
 });
 // Never print session CSRF, cookies, access codes or credentials.
 report.urlMode={enabled:mode.enabled===true,requiresAccessCode:mode.requiresAccessCode===true,http:mode.status,readable:!!mode.status};
 if(!report.urlMode.enabled||report.urlMode.requiresAccessCode)throw Error("Live URL input is disabled or requires an access code; no code was supplied");
 await page.waitForFunction(()=>document.querySelector("#job-url-access")?.hidden===true,null,{timeout:15000});
 await page.evaluate(()=>{location.hash="#profile"});
 await page.locator("#profile").waitFor({state:"visible"});
 for(const [id,val] of Object.entries(profile))await page.locator("#"+id).fill(val);
 await page.locator("#profile-form button[type=submit]").click();
 for(let i=0;i<entries.length;i++){
  const item=entries[i],obj={index:i+1,id:item.url.match(/(?:GI_Read\/|rec_idx=)(\d+)/)?.[1],site:item.site,field:item.field,stage:"start"};
  const start=performance.now();
  try{
   await page.evaluate(()=>{location.hash="#analyze"});
   await page.locator("#analyze").waitFor({state:"visible"});
   obj.stage="url-entry-and-fetch";
   await page.locator("#job-url").fill(item.url);
   const fetchStart=performance.now();
   await page.locator("#job-url-fetch").click();
   try{await page.locator("#job-url-review").waitFor({state:"visible",timeout:21000});}
   catch{throw Error("URL preview not shown: "+(await page.locator("#job-url-status").innerText()).slice(0,180));}
   obj.urlImportMs=Math.round(performance.now()-fetchStart);
   const text=await page.locator("#job-url-draft").inputValue();
   if(text.trim().length<40)throw Error("URL preview text too short");
   obj.chars=text.length;
   const source=await page.locator("#job-url-source").innerText();
   if(!source.includes(obj.id))throw Error("Source citation does not reference requested vacancy ID");
   obj.stage="confirm-and-apply";
   await page.locator("#job-url-confirm").check();
   await page.locator("#job-url-apply").click();
   if((await page.locator("#job-text").inputValue()).trim()!==text.trim())throw Error("Applied content differs from reviewed URL");
   const startAnalysis=performance.now();
   obj.stage="first-classification";
   await page.locator("#job-form button[type=submit]").click();
   await page.locator("#job-result").waitFor({state:"visible"});
   obj.groupCards=await page.locator("#job-result-sections .result-block").count();
   if(obj.groupCards!==6)throw Error("Expected six classification group cards");
   obj.stage="profile-comparison";
   await page.evaluate(()=>{location.hash="#profile"});
   await page.locator("#profile").waitFor({state:"visible"});
   await page.locator("#requirements-run").click();
   await page.locator("#requirements-check").waitFor({state:"visible"});
   obj.requirements=await page.locator("#requirements-list [data-requirement]").count();
   if(obj.requirements===0)throw Error("No required or preferred conditions were rendered");
   const compared=await page.locator("#requirements-summary").innerText();
   if(!compared.includes("총 "+obj.requirements+"개 요건"))throw Error("Comparison summary disagrees with cards");
   obj.stage="roadmap-connection";
   await page.evaluate(()=>{location.hash="#roadmap"});
   await page.locator("#roadmap").waitFor({state:"visible"});
   await page.locator("#roadmap-results").waitFor({state:"visible"});
   obj.roadmap=await page.locator("#roadmap-list .roadmap-task").count();
   if(obj.roadmap!==obj.requirements)throw Error("Roadmap does not match compared requirements");
   const prep=await page.locator("#roadmap-list details.roadmap-steps").evaluateAll(nodes=>nodes.map(el=>el.querySelectorAll("ol li").length));
   if(prep.some(n=>n!==3))throw Error("Roadmap contains a non-three-step task");
   obj.roadmapThreeSteps=prep.length;
   obj.browserAnalysisMs=Math.round(performance.now()-startAnalysis);
   obj.stage="live-url-to-roadmap-pass";
  }catch(err){
   obj.stage="live-url-to-roadmap-failed";obj.error=String(err).slice(0,400);
   if(!report.screenshot){try{await page.screenshot({path:"live-url-browser-failure.png",fullPage:true});report.screenshot=true;}catch{}}
  }
  obj.totalMs=Math.round(performance.now()-start);
  report.records.push(obj);save();
  console.log("LIVE_URL_RESULT",JSON.stringify({index:obj.index,id:obj.id,stage:obj.stage,fetchMs:obj.urlImportMs,analysisMs:obj.browserAnalysisMs,error:obj.error}));
  // Respect public rate limits; never circumvent access controls, no auto retries.
  await new Promise(r=>setTimeout(r,3500));
 }
 const passes=report.records.filter(x=>x.stage==="live-url-to-roadmap-pass");
 report.summary={attempted:report.records.length,passed:passes.length,failed:50-passes.length,providerCount:{
  jobkorea:passes.filter(x=>x.site==="jobkorea").length,saramin:passes.filter(x=>x.site==="saramin").length
 },medianImportMs:pct(passes.map(x=>x.urlImportMs),.5),p95ImportMs:pct(passes.map(x=>x.urlImportMs),.95),
 medianAnalysisMs:pct(passes.map(x=>x.browserAnalysisMs),.5),p95AnalysisMs:pct(passes.map(x=>x.browserAnalysisMs),.95),pageErrors:browserErrors.slice(0,6)};
}catch(err){report.fatal=String(err).slice(0,500);console.error("LIVE_URL_FATAL",report.fatal);process.exitCode=1;
}finally{report.finished=new Date().toISOString();save();if(browser)await browser.close();}
console.log("LIVE_URL_SUMMARY",JSON.stringify(report.summary||{fatal:report.fatal}));
if(report.summary?.passed!==50)process.exitCode=1;
