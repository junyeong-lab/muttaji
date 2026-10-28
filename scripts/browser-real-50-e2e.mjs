// Runs the REAL deployed web UI in Chromium for every public posting in the 50-URL set.
// Requires no access tokens, never fabricates a passing URL import.
// Live URL-button test is separate from pasted-text analysis, and errors are reported.
import fs from "node:fs";
import {performance} from "node:perf_hooks";
import {createImporter} from "../lib/job-url/service.js";
import {chromium} from "playwright";
const origin=process.env.MUTTAJI_E2E_BASE_URL||"https://project-muttaji.vercel.app";
const manifest=JSON.parse(fs.readFileSync(new URL("../tests/fixtures/real-postings-smoke.json",import.meta.url),"utf8"));
if(manifest.length!==50||new Set(manifest.map(x=>x.url)).size!==50)throw Error("Exactly 50 unique real posting URLs required");
const profile={
 "goal-job":"정보보안 컨설팅, 개인정보보호, IT 운영",
 education:"국립목포해양대학교 기관공학전공 학사 졸업",
 experience:"2021년~2026년 해군 정보통신장교. 보안정책·정보자산·취약점 기관평가 점검. 사이버 위협 분석 및 지휘관 대상 정례 보고. 3군 사관학교 통합임관식 통신 지원. Wazuh 및 GNS3 실습은 상용서비스 운영경력과 구분.",
 certs:"정보처리기사\nSQLD\n네트워크관리사 2급",
 skills:"Windows/Linux 관리, 네트워크 VLAN 및 라우팅 구성 실습, Wazuh SIEM 로그 분석 실습, 보안정책 점검과 위협정보 분석"
};
const report={scope:"real-production-browser-ui-with-public-posting-text",baseUrl:origin,startedAt:new Date().toISOString(),target:50,
 navigation:{loaded:false,errors:[]},urlButton:{status:"not-checked"},results:[],summary:{}};
const outPath="real-posting-browser-report.json";
function publish(){fs.writeFileSync(outPath,JSON.stringify(report,null,2));}
function quantile(list,q){if(!list.length)return null;const a=list.slice().sort((x,y)=>x-y);return Math.round(a[Math.min(a.length-1,Math.ceil(q*a.length)-1)]);}
let browser;
try{
 browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
 const context=await browser.newContext({viewport:{width:1280,height:900},locale:"ko-KR",timezoneId:"Asia/Seoul"});
 const page=await context.newPage();
 page.setDefaultTimeout(12000);
 const errors=[];
 page.on("pageerror",e=>errors.push(String(e).slice(0,180)));
 const started=performance.now();
 await page.goto(origin+"/#analyze",{waitUntil:"domcontentloaded",timeout:30000});
 await page.locator("#job-text").waitFor();
 report.navigation={loaded:true,loadMs:Math.round(performance.now()-started),title:await page.title(),errors};
 const api=await page.evaluate(async()=>{
   try{const r=await fetch("/api/job-url-import",{cache:"no-store"});
     const body=await r.json();return {http:r.status,enabled:body.enabled===true,requiresAccessCode:body.requiresAccessCode!==false};
   }catch(e){return {error:String(e).slice(0,150)};}
 });
 report.urlButton={status:api.enabled?(api.requiresAccessCode?"requires-access-code":"public-mode-available"):"disabled-or-unavailable",config:api};
 if(api.enabled&&!api.requiresAccessCode){
   try{
     await page.waitForFunction(()=>document.querySelector("#job-url-access")?.hidden===true,{timeout:15000});
     await page.locator("#job-url").fill(manifest[0].url);
     const time=performance.now();
     await page.locator("#job-url-fetch").click();
     await page.locator("#job-url-review").waitFor({state:"visible",timeout:21000});
     report.urlButton={...report.urlButton,status:"import-preview-rendered",latencyMs:Math.round(performance.now()-time)};
     await page.locator("#job-url-confirm").check();
     await page.locator("#job-url-apply").click();
     if(!(await page.locator("#job-text").inputValue()).trim())throw Error("URL text not applied to input");
     report.urlButton.status="full-one-url-apply-pass";
   }catch(e){report.urlButton.status="live-url-flow-failed";report.urlButton.reason=String(e).slice(0,240);}
 }
 await page.evaluate(()=>{location.hash="#profile"});
 await page.locator("#profile").waitFor({state:"visible"});
 for(const [id,value] of Object.entries(profile))await page.locator('[id="'+id+'"]').fill(value);
 await page.locator("#profile-form button[type=submit]").click();
 // Page remains live; public importer obtains unchanged text from actual posting source.
 const importer=createImporter();
 for(let i=0;i<manifest.length;i++){
   const row=manifest[i],rec={number:i+1,site:row.site,field:row.field,id:row.url.match(/(?:GI_Read\/|rec_idx=)(\d+)/)?.[1],stage:"queued"};
   const start=performance.now();
   try{
     rec.stage="public-source-import";
     const posting=await importer(row.url);
     rec.sourceMethod=posting.method;rec.sourceChars=posting.text.length;
     rec.importMs=Math.round(performance.now()-start);
     if(posting.contentStatus!=="body"||posting.text.trim().length<40)throw Error("Source lacked full job body");
     const t0=performance.now();
     rec.stage="browser-ui-job-input";
     await page.evaluate(()=>{location.hash="#analyze"});
     await page.locator("#analyze").waitFor({state:"visible"});
     await page.locator("#job-text").fill(posting.text);
     await page.locator("#job-form button[type=submit]").click();
     await page.locator("#job-result").waitFor({state:"visible"});
     rec.classifiedSummary=await page.locator("#job-result-summary").innerText();
     rec.displayedConditions=await page.locator("#job-result-sections .result-block").count();
     if(rec.displayedConditions!==6)throw Error("Missing UI source category cards: "+rec.displayedConditions);
     rec.stage="browser-ui-profile-compare";
     await page.evaluate(()=>{location.hash="#profile"});
     await page.locator("#profile").waitFor({state:"visible"});
     await page.locator("#requirements-run").click();
     await page.locator("#requirements-check").waitFor({state:"visible"});
     rec.requirements=await page.locator('#requirements-list [data-requirement]').count();
     rec.comparisonSummary=await page.locator("#requirements-summary").innerText();
     if(!rec.requirements||!rec.comparisonSummary.includes("총 "+rec.requirements+"개 요건"))throw Error("Requirements count/summary disagreement");
     rec.stage="browser-ui-roadmap";
     await page.evaluate(()=>{location.hash="#roadmap"});
     await page.locator("#roadmap").waitFor({state:"visible"});
     await page.locator("#roadmap-results").waitFor({state:"visible"});
     rec.roadmapCards=await page.locator("#roadmap-list .roadmap-task").count();
     if(rec.roadmapCards!==rec.requirements)throw Error("Roadmap card count "+rec.roadmapCards+" != "+rec.requirements);
     const counts=await page.locator("#roadmap-list details.roadmap-steps").evaluateAll(nodes=>nodes.map(n=>n.querySelectorAll("ol li").length));
     if(counts.some(n=>n!==3))throw Error("Some unfulfilled roadmap tasks did not show 3 steps: "+counts);
     rec.threeStepTasks=counts.length;
     rec.roadmapSummary=await page.locator("#roadmap-summary").innerText();
     if(!rec.roadmapSummary.includes("비교한 조건 "+rec.requirements+"개"))throw Error("Roadmap summary not synced");
     const evidence=await page.locator("#requirements-list").innerText();
     if(!evidence.includes("공고")&&!evidence.includes("근거"))throw Error("No source reference shown in comparison view");
     rec.uiMs=Math.round(performance.now()-t0);
     rec.totalMs=Math.round(performance.now()-start);
     rec.stage="browser-ui-pass";
   }catch(e){
     rec.failure=String(e).slice(0,480);rec.totalMs=Math.round(performance.now()-start);rec.stage="browser-ui-failed";
     if(!report.firstScreenshot){
       try{await page.screenshot({path:"browser-failure.png",fullPage:true});report.firstScreenshot="browser-failure.png";}catch{}
     }
   }
   report.results.push(rec);
   console.log(JSON.stringify({number:rec.number,id:rec.id,field:rec.field,stage:rec.stage,uiMs:rec.uiMs,reason:rec.failure}));
   publish();
   await new Promise(resolve=>setTimeout(resolve,700)); // do not hammer source websites
 }
 const passed=report.results.filter(x=>x.stage==="browser-ui-pass");
 report.summary={attempted:report.results.length,browserUiPassed:passed.length,browserUiFailed:report.results.length-passed.length,medianUiMs:quantile(passed.map(x=>x.uiMs),0.5),p95UiMs:quantile(passed.map(x=>x.uiMs),0.95),
 sourceProviders:Object.fromEntries(["jobkorea","saramin"].map(site=>[site,{attempted:report.results.filter(x=>x.site===site).length,passed:passed.filter(x=>x.site===site).length}])),
 fields:[...new Set(report.results.map(x=>x.field))],liveUrlButtonStatus:report.urlButton.status};
}catch(e){report.fatal=String(e).slice(0,800);console.error("BROWSER_E2E_FATAL",report.fatal);process.exitCode=1;}
finally{report.finishedAt=new Date().toISOString();publish();if(browser)await browser.close();}
console.log("BROWSER_E2E_SUMMARY",JSON.stringify(report.summary));
if(report.summary.browserUiPassed!==50)process.exitCode=1;
