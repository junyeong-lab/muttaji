"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const modules=Promise.all([import("../lib/job-url/policy.js"),import("../lib/job-url/service.js"),import("../lib/job-url/extract.js"),import("../lib/job-url/robots.js"),import("../lib/job-url/api.js")]);
const html=fs.readFileSync(path.join(__dirname,"fixtures/job-url/structured.html"),"utf8");
const bodyHtml=fs.readFileSync(path.join(__dirname,"fixtures/job-url/body.html"),"utf8");
const publicDns=async()=>[{address:"8.8.8.8",family:4}];
const url="https://jobs.example.org/jobs/1";

test("URL validation blocks protocol tricks, IP encodings, credentials, local hosts and secret queries",async()=>{
 const [{validateUrl}]=await modules;
 assert.equal(validateUrl(url+"#section").href,url);
 for(const value of ["","not a url","http://example.org/job","file:///etc/passwd","https://localhost/job","https://127.0.0.1/","https://2130706433/","https://0x7f000001/","https://0177.0.0.1/","https://[::1]/","https://[::ffff:127.0.0.1]/","https://metadata.google.internal/","https://jobs.local/","https://example.org:444/","https://user:secret@example.org/","https://example.org\\@localhost/","https://example.org/?token=private","https://example.org./"])
  assert.throws(()=>validateUrl(value),undefined,value);
});
test("DNS rejects private, metadata, reserved, mapped and mixed answer sets",async()=>{
 const [{publicAddress,resolvePublic,validateUrl}]=await modules;
 for(const ip of ["127.0.0.1","10.0.0.1","172.16.1.1","192.168.1.1","169.254.169.254","168.63.129.16","100.100.100.200","0.0.0.0","224.0.0.1","192.0.2.1","198.18.0.1","::1","::","fc00::1","fe80::1","::ffff:127.0.0.1","::ffff:8.8.8.8","64:ff9b::a00:1","2002:7f00:1::","2001:db8::1"]){
  assert.equal(publicAddress(ip),false,ip);
  await assert.rejects(resolvePublic(validateUrl(url),new AbortController().signal,async()=>[{address:ip}]),{code:"UNSAFE_DNS"});
 }
 assert.equal(publicAddress("8.8.8.8"),true);assert.equal(publicAddress("2001:4860:4860::8888"),true);
 await assert.rejects(resolvePublic(validateUrl(url),new AbortController().signal,async()=>[{address:"8.8.8.8"},{address:"10.0.0.1"}]),{code:"UNSAFE_DNS"});
});
test("normal public import uses validated targets, structured data and existing parser",async()=>{
 const [, {createImporter}]=await modules;const calls=[];
 const importer=createImporter({resolver:publicDns,transport:async(u,target,options)=>{calls.push({url:u.href,target,options});return options.kind==="robots"?{status:404}:{status:200,body:html};}});
 const result=await importer(url);
 assert.equal(result.method,"jsonld");assert.equal(result.reviewRequired,true);assert.equal(result.analysisInput.aiEnabled,false);
 assert.equal(result.fields.company[0].value,"가상 기업");assert.equal(result.fields.role[0].value,"보안 엔지니어");
 assert.equal(result.fields.department[0].value,"보안팀");assert.equal(result.fields.location[0].value,"대한민국 서울");
 assert.equal(result.fields.required.length,1);assert.equal(result.fields.preferred.length,1);
 assert.equal(result.fields.preferred[0].value,"- SQLD 보유");
 assert.equal(calls.every(x=>x.target.address==="8.8.8.8"),true);
 const {analyze}=require("./load-browser-module.cjs")("../assets/job-text-analyzer.js");
 const parsed=analyze(result.text);assert.equal(parsed.required.length,1);assert.equal(parsed.preferred.length,1);
 assert.equal(parsed.required[0].text,"Linux 운영 경험");
 assert.equal(JSON.stringify(result).includes("REMOTE_SCRIPT_MUST_NOT_RUN"),false);
});
test("HTML fallback removes menus, related jobs, forms, scripts and footer without inventing metadata",async()=>{
 const [,,{extractPosting}]=await modules;const result=extractPosting(bodyHtml,url);
 assert.equal(result.method,"html-body");assert.equal(result.fields.company[0].value,"가상 기업");
 assert.equal(result.fields.role[0].value,"정보보안 담당자");assert.equal(result.fields.required[0].value,"네트워크 기초 이해");
 assert.equal(result.fields.deadline.length,0);
 for(const text of ["로그인 메뉴 광고","엉뚱한 공고","관련 채용공고","doNotRun","푸터 연락처"])assert.equal(result.text.includes(text),false);
});
test("login, bot challenges, JS shells, multiple listings and oversized extracts fail with precise codes",async()=>{
 const [,,{extractPosting}]=await modules;
 for(const [page,code] of [["<title>로그인</title><main>로그인이 필요합니다.</main>","LOGIN_REQUIRED"],["<title>Just a moment</title><form id=challenge-form>Captcha</form>","BOT_CHALLENGE"],["<main>JavaScript를 활성화하세요</main><script>render()</script>","NO_POSTING"],["<main><h2>필수조건</h2><p>"+"가".repeat(21000)+"</p></main>","EXTRACT_TOO_LONG"]])assert.throws(()=>extractPosting(page,url),{code});
 const two='<script type="application/ld+json">'+JSON.stringify([{ "@type":"JobPosting",title:"A",description:"A"},{"@type":"JobPosting",title:"B",description:"B"}])+"</script>";
 assert.throws(()=>extractPosting(two,url),{code:"MULTIPLE_POSTINGS"});
});
test("every redirect is HTTPS-validated and DNS-checked, with loop and login protection",async()=>{
 const [,{createImporter}]=await modules;
 for(const [location,code] of [["http://example.org/job","UNSAFE_URL"],["https://127.0.0.1/","UNSAFE_URL"],["https://evil.example.org/private","UNSAFE_DNS"],["/login","LOGIN_REQUIRED"]]){
  const calls=[];const importer=createImporter({resolver:async host=>host==="evil.example.org"?[{address:"10.0.0.1"}]:publicDns(),transport:async(u,t,o)=>{calls.push(u.href);return o.kind==="robots"?{status:404}:{status:302,headers:{location}};}});
  await assert.rejects(importer(url),{code});assert.equal(calls.some(x=>x.includes("private")),false);
 }
 let calls=0;
 const loop=createImporter({resolver:publicDns,transport:async(u,t,o)=>o.kind==="robots"?{status:404}:(calls++,{status:302,headers:{location:"/again"}})});
 await assert.rejects(loop(url),{code:"TOO_MANY_REDIRECTS"});assert.equal(calls,4);
});
test("DNS rebinding between policy fetch and page fetch is blocked before connection",async()=>{
 const [,{createImporter}]=await modules;let lookups=0,requests=0;
 const importer=createImporter({resolver:async()=>++lookups===1?publicDns():[{address:"127.0.0.1"}],transport:async()=>{requests++;return {status:404};}});
 await assert.rejects(importer(url),{code:"UNSAFE_DNS"});assert.equal(requests,1);
});
test("timeout covers stalled DNS and responses without retries",async()=>{
 const [,{createImporter}]=await modules;let calls=0;
 await assert.rejects(createImporter({timeoutMs:10,resolver:()=>new Promise(()=>{}),transport:()=>{calls++;}})(url),{code:"TIMEOUT"});
 assert.equal(calls,0);
 await assert.rejects(createImporter({timeoutMs:10,resolver:publicDns,transport:()=>{calls++;return new Promise(()=>{});}})(url),{code:"TIMEOUT"});
 assert.equal(calls,1);
});
test("robots policy respects disallow, longest allow and crawler-specific rules",async()=>{
 const [,,,{checkRobots}]=await modules;
 assert.throws(()=>checkRobots("User-agent: *\nDisallow: /jobs",new URL(url)),{code:"ROBOTS_DENIED"});
 assert.doesNotThrow(()=>checkRobots("User-agent: *\nDisallow: /\nAllow: /jobs/",new URL(url)));
 assert.throws(()=>checkRobots("User-agent: MuttajiJobImport\nDisallow: /jobs/*\nUser-agent: *\nAllow: /",new URL(url)),{code:"ROBOTS_DENIED"});
 const importer=(await modules)[1].createImporter({resolver:publicDns,transport:async()=>({status:403})});
 await assert.rejects(importer(url),{code:"ROBOTS_UNAVAILABLE"});
});
test("API requires auth, rejects extra profile data, enforces limits and does not disclose secrets",async()=>{
 const [,,,,{createImportHandler,processLimiter}]=await modules;
 let calls=0;
 const handler=createImportHandler({config:()=>({mode:"mock",token:"private-test-code"}),limiter:processLimiter({limit:2}),importer:async()=>{calls++;return {reviewRequired:true};}});
 const request=(body,token="private-test-code",headers={})=>new Request("https://app.example.org/api/job-url-import",{method:"POST",headers:{"content-type":"application/json","x-job-import-token":token,...headers},body:JSON.stringify(body)});
 assert.equal((await handler(request({url},"wrong"))).status,403);
 assert.equal((await handler(request({url},"é".repeat(17)))).status,403);
 assert.equal((await handler(request({url},undefined,{origin:"https://evil.example.org"}))).status,403);
 assert.equal((await handler(request({url,profile:"PRIVATE"}))).status,400);
 assert.equal((await handler(request({url}))).status,200);
 assert.equal((await handler(request({url}))).status,429);assert.equal(calls,1);
 const disabled=createImportHandler({importer:async()=>{throw Error("must not call");}});
 assert.equal((await disabled(request({url}))).status,503);
 const live=createImportHandler({config:()=>({mode:"live",token:"private-test-code",ownerApproved:true})});
 assert.equal((await live(request({url}))).status,503);
 const shared=createImportHandler({config:()=>({mode:"live",token:"private-test-code",ownerApproved:true}),limiter:{scope:"shared",take:async()=>true},importer:async()=>{throw Error("PRIVATE_ACCOUNT_DATA");}});
 const failure=await shared(request({url}));assert.equal(failure.headers.get("cache-control"),"no-store");assert.equal((await failure.text()).includes("PRIVATE_ACCOUNT_DATA"),false);
});
test("API limits UTF-8 request bytes even without Content-Length and shared limiter failure stays closed",async()=>{
 const {createImportHandler}=await import("../lib/job-url/api.js");let calls=0;
 const handler=createImportHandler({config:()=>({mode:"mock",token:"private-test-code"}),importer:async()=>{calls++;return {};}});
 const request=new Request("https://app.example.org/api/job-url-import",{method:"POST",headers:{"content-type":"application/json","x-job-import-token":"private-test-code"},body:JSON.stringify({url:"https://example.org/"+"가".repeat(3000)})});
 assert.equal((await handler(request)).status,413);assert.equal(calls,0);
 const failed=createImportHandler({config:()=>({mode:"live",token:"private-test-code",ownerApproved:true}),limiter:{scope:"shared",take:async()=>{throw Error("PRIVATE_LIMITER_CONNECTION");}},importer:async()=>{calls++;}});
 const response=await failed(new Request("https://app.example.org/api/job-url-import",{method:"POST",headers:{"content-type":"application/json","x-job-import-token":"private-test-code"},body:JSON.stringify({url})}));
 assert.equal(response.status,503);assert.equal((await response.text()).includes("PRIVATE_LIMITER_CONNECTION"),false);assert.equal(calls,0);
});
test("metadata-only JSON-LD is reported as partial instead of a full posting; ambiguous HTML lists fail",async()=>{
 const {extractPosting}=await import("../lib/job-url/extract.js");
 assert.throws(()=>extractPosting('<script type="application/ld+json">'+JSON.stringify({"@type":"JobPosting",title:"보안 엔지니어",hiringOrganization:{name:"가상 회사"},description:"상세요강은 이미지 참고"})+'</script>',url),{code:"PARTIAL_POSTING"});
 const article=text=>'<article><h2>필수조건</h2><p>'+text.repeat(20)+'</p></article>';
 assert.throws(()=>extractPosting('<main>'+article('첫번째 공고 업무 ')+article('두번째 공고 업무 ')+'</main>',url),{code:"MULTIPLE_POSTINGS"});
});
test("short structured descriptions with no explicit requirements are marked partial for human review",async()=>{
 const {extractPosting}=await import("../lib/job-url/extract.js");
 const page='<script type="application/ld+json">'+JSON.stringify({"@type":"JobPosting",title:"공개 공고",description:"공고에서 안내한 업무를 수행합니다. ".repeat(6)})+'</script>';
 const result=extractPosting(page,url);assert.equal(result.contentStatus,"partial");assert.equal(result.reviewRequired,true);
});
test("pathologically deep or tag-dense HTML is rejected before DOM construction",async()=>{
 const {extractPosting}=await import("../lib/job-url/extract.js");
 assert.throws(()=>extractPosting("<div>".repeat(301)+"</div>".repeat(301),url),{code:"TOO_LARGE"});
 assert.throws(()=>extractPosting("<br>".repeat(12001),url),{code:"TOO_LARGE"});
});

test("job posting with several separate role sections exposes a warning rather than silently merging roles",async()=>{
 const [,,{extractPosting}]=await modules;
 const src=[
  "<html><main>",
  "<h2>담당 업무</h2><p>클라우드 네트워크 구축과 보안 운영 업무를 담당합니다.</p>",
  "<h2>자격요건</h2><p>네트워크 운영 2년 이상의 실무경험</p>",
  "<h2>우대사항</h2><p>CCNA 자격증 보유자 우대</p>",
  "<h2>담당 업무</h2><p>데이터베이스 개발과 SQL 운영 업무를 담당합니다.</p>",
  "<h2>자격요건</h2><p>SQL 데이터 모델링 경험</p>",
  "<h2>우대사항</h2><p>SQLD 자격증 보유자 우대</p>",
  "</main></html>"
 ].join("");
 const result=extractPosting(src,url);
 assert.equal(result.contentStatus,"body");
 assert.equal(result.warnings.some(x=>x.includes("여러 모집 포지션")),true);
 assert.equal(result.reviewRequired,true);
 assert.doesNotMatch(result.text,/보유 자격증을 확인했으므로 충족/);
});

test("public URL import timeout budget stays below the function duration and browser timeout",async()=>{
 const [{LIMITS}]=await modules;
 assert.equal(LIMITS.timeoutMs,17000);
 assert.ok(LIMITS.timeoutMs<19000,"client must outlive the server's bounded importer");
 assert.ok(LIMITS.timeoutMs<20000,"importer must finish before Vercel's URL function limit");
});
