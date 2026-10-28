import {chromium} from "playwright";
import {performance} from "node:perf_hooks";
const root="https://project-muttaji.vercel.app";
const candidates=[
 {id:"54767562",field:"네트워크",label:"원아이티 네트워크 보안 엔지니어"},
 {id:"54452855",field:"네트워크",label:"송우인포텍 정보통신 네트워크 엔지니어"},
 {id:"52726293",field:"네트워크",label:"대신네트웍스 엔지니어"}
];
let browser;
let passes=0;
try{
 browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
 const page=await browser.newPage({locale:"ko-KR"});
 await page.goto(root+"/#analyze",{waitUntil:"domcontentloaded",timeout:30000});
 await page.waitForFunction(()=>document.getElementById("job-url-access")?.hidden===true&&document.getElementById("job-url-fetch")?.disabled===false,null,{timeout:20000});
 for(const candidate of candidates){
   const start=performance.now();
   const url="https://www.saramin.co.kr/zf_user/jobs/view?rec_idx="+candidate.id;
   try{
     await page.locator("#job-url").fill(url);
     await page.locator("#job-url-fetch").click();
     await page.locator("#job-url-review").waitFor({state:"visible",timeout:24000});
     const text=await page.locator("#job-url-draft").inputValue();
     if(text.trim().length<40)throw Error("short-body");
     const counts=await page.evaluate(text=>{
       const parsed=window.JobTextAnalyzer.analyze(text);
       return {required:parsed.required.length,preferred:parsed.preferred.length};
     },text);
     if(counts.required+counts.preferred<2)throw Error("missing-conditions");
     await page.locator("#job-url-confirm").check();
     await page.locator("#job-url-apply").click();
     await page.locator("#job-form button[type=submit]").click();
     await page.locator("#job-result").waitFor({state:"visible"});
     console.log("CANDIDATE",JSON.stringify({...candidate,result:"real-production-url-ui-pass",ms:Math.round(performance.now()-start),...counts}));
     passes++;
   }catch(e){
     const status=await page.locator("#job-url-status").innerText().catch(()=>"unavailable");
     console.log("CANDIDATE",JSON.stringify({...candidate,result:"failed",reason:String(e).slice(0,200),status:status.slice(0,170)}));
   }
   await new Promise(r=>setTimeout(r,3500));
 }
}finally{await browser?.close();}
if(!passes)process.exitCode=1;
