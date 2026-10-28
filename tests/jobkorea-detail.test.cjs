const test=require('node:test'),assert=require('node:assert/strict');
const dns=async()=>[{address:'8.8.8.8',family:4}];
const page='<script type="application/ld+json">'+JSON.stringify({'@type':'JobPosting',title:'Security role',hiringOrganization:{name:'Example'},description:'Public summary '.repeat(8)})+'</script>';
const detail='<div class="dev-template-v2-root"><h2>담당업무</h2><p>보안 장비 운영 및 로그 분석과 침해사고 대응 수행</p><h2>자격요건</h2><p>관련 업무 경력 5년 이상 및 학사 이상 지원 가능</p></div>';
test('JobKorea fixed public detail is validated and merged with evidence',async()=>{
 const {createImporter}=await import('../lib/job-url/service.js');const calls=[];
 const result=await createImporter({resolver:dns,transport:async(u,t,o)=>{calls.push(u.href);return o.kind==='robots'?{status:404}:{status:200,headers:{},body:u.pathname.includes('Comt_Ifrm')?detail:page};}})('https://www.jobkorea.co.kr/Recruit/GI_Read/50216612');
 assert.equal(result.method,'jobkorea-public-detail');assert.match(result.text,/경력 5년/);assert.equal(result.fields.company[0].value,'Example');assert.match(result.fields.required[0].evidence.sourceUrl,/Comt_Ifrm/);assert.equal(calls.length,3);
});
test('JobKorea detail respects robots and does not follow redirects',async()=>{
 const {createImporter}=await import('../lib/job-url/service.js');
 for(const blocked of [true,false]){
 const importer=createImporter({resolver:dns,transport:async(u,t,o)=>o.kind==='robots'?{status:200,body:blocked?'User-agent: *\nDisallow: /Recruit/GI_Read_Comt_Ifrm':''}:{status:u.pathname.includes('Comt_Ifrm')?302:200,headers:{location:'https://127.0.0.1'},body:page}});
 await assert.rejects(importer('https://www.jobkorea.co.kr/Recruit/GI_Read/50216612'));
 }
});

test('image-only detail gives OCR guidance rather than a generic missing posting error',async()=>{
 const {extractPosting}=await import('../lib/job-url/extract.js');
 const {messages}=await import('../lib/job-url/errors.js');
 assert.throws(()=>extractPosting('<div id="detail-content"><img src="https://images.example.org/poster.png"></div>','https://www.jobkorea.co.kr/Recruit/GI_Read_Comt_Ifrm?Gno=123'),{code:'IMAGE_POSTING'});
 assert.match(messages.IMAGE_POSTING,/PowerToys.*Win \+ Shift \+ T/);
 assert.throws(()=>extractPosting('<img src="logo.png">','https://example.org'),{code:'NO_POSTING'});
});

const jobUrl='https://www.jobkorea.co.kr/Recruit/GI_Read/50176196';
const emptyShell='<html><title>Public job</title><div id="app"></div></html>';
const newDetail='<div id="detail-content"><div class="tempate-detailed-summary-root"><h2>담당업무</h2><p>WAF 및 방화벽 운영과 보안 이벤트 분석, 관련 부서 협업을 수행합니다.</p><h2>필수조건</h2><p>정보보호 운영 경력 3년 이상 및 네트워크 프로토콜 이해가 필요합니다.</p><h2>스킬</h2><p>TCP/IP, WAF</p><h2>우대사항</h2><p>정보보안기사 자격증 보유자를 우대합니다.</p></div></div>';
const metadata='<script type="application/ld+json">'+JSON.stringify({'@type':'JobPosting',title:'보안 엔지니어',hiringOrganization:{name:'예시 기업'}})+'</script>';
async function mockJob({shell=emptyShell,body=newDetail,robots='',status=200}={}){
 const {createImporter}=await import('../lib/job-url/service.js');const calls=[];
 return {calls,run:createImporter({resolver:dns,transport:async(u,t,o)=>{calls.push(u.href);return o.kind==='robots'?{status:200,body:robots}:{status:u.pathname.includes('Comt_Ifrm')?status:200,headers:{location:'https://127.0.0.1/private'},body:u.pathname.includes('Comt_Ifrm')?body:shell};}})};
}
test('missing shell and metadata-only shell still fetch the fixed detail and keep true evidence',async()=>{
 for(const shell of [emptyShell,metadata]){
  const {run,calls}=await mockJob({shell});const result=await run(jobUrl);
  assert.equal(calls.length,3);assert.match(calls[2],/Gno=50176196&isHiringCenter=false&hideMapView=false$/);
  assert.equal(result.contentStatus,'body');assert.match(result.text,/보안 이벤트 분석/);
  assert.equal(result.sourceUrl,jobUrl);assert.equal(result.analysisInput.source.url,jobUrl);
  assert.equal(result.analysisInput.postingText,result.text);assert.equal(result.reviewRequired,true);
  assert.ok(result.fields.required.every(x=>x.evidence.sourceUrl.includes('Comt_Ifrm')));
  if(shell===metadata){assert.equal(result.fields.company[0].value,'예시 기업');assert.equal(result.fields.company[0].evidence.sourceUrl,jobUrl);}
  else{assert.equal(result.fields.company.length,0);assert.equal(result.fields.role.length,0);}
 }
});
test('normal shell plus detail deduplicates body while preserving input source and six parser categories',async()=>{
 const shell='<script type="application/ld+json">'+JSON.stringify({'@type':'JobPosting',title:'보안 엔지니어',hiringOrganization:{name:'예시 기업'},description:newDetail})+'</script>';
 const {run}=await mockJob({shell});const result=await run(jobUrl);
 assert.equal(result.text.split('WAF 및 방화벽 운영').length-1,1);
 assert.equal(new Set(result.fields.extras.map(x=>x.value)).size,result.fields.extras.length);
 for(const list of Object.values(result.fields))for(const entry of list)assert.ok([jobUrl,jobUrl.replace('/GI_Read/50176196','/GI_Read_Comt_Ifrm?Gno=50176196&isHiringCenter=false&hideMapView=false')].includes(entry.evidence.sourceUrl));
 const parser=require('./load-browser-module.cjs')('../assets/job-text-analyzer.js');const parsed=parser.analyze(result.text);
 assert.ok(parsed.required.length);assert.ok(parsed.preferred.length);assert.ok(parsed.unresolved.some(x=>/TCP/.test(x.text)));assert.equal('skills' in parsed,false);
});
test('HTTP success without a real detail body is not reported as extraction success',async()=>{
 for(const body of [emptyShell,metadata]){const {run,calls}=await mockJob({shell:page,body});await assert.rejects(run(jobUrl),e=>['NO_POSTING','PARTIAL_POSTING'].includes(e.code));assert.equal(calls.length,3);}
});
test('robots denial blocks detail even if the shell has no body',async()=>{
 const {run,calls}=await mockJob({robots:'User-agent: *\nDisallow: /Recruit/GI_Read_Comt_Ifrm'});
 await assert.rejects(run(jobUrl),{code:'ROBOTS_DENIED'});assert.equal(calls.length,2);
});
test('detail access denial, login, CAPTCHA and redirects fail without following another URL',async()=>{
 for(const [status,body,code] of [[403,newDetail,'REMOTE_BLOCKED'],[429,newDetail,'REMOTE_BLOCKED'],[401,newDetail,'LOGIN_REQUIRED'],[302,newDetail,'REMOTE_ERROR'],[200,'<title>CAPTCHA</title>'+newDetail,'BOT_CHALLENGE']]){
  const {run,calls}=await mockJob({status,body});await assert.rejects(run(jobUrl),{code});assert.equal(calls.length,3);
 }
 const {run,calls}=await mockJob({shell:'<title>CAPTCHA</title>'+emptyShell});await assert.rejects(run(jobUrl),{code:'BOT_CHALLENGE'});assert.equal(calls.length,2);
});
test('detail shares the original timeout and DNS checks; no fallback on non-JobKorea shells',async()=>{
 const {createImporter}=await import('../lib/job-url/service.js');let calls=0;
 await assert.rejects(createImporter({resolver:dns,timeoutMs:15,transport:async(u,t,o)=>{calls++;return o.kind==='robots'?{status:404}:u.pathname.includes('Comt_Ifrm')?new Promise(()=>{}):{status:200,body:emptyShell};}})(jobUrl),{code:'TIMEOUT'});assert.equal(calls,3);
 let lookups=0;calls=0;
 await assert.rejects(createImporter({resolver:async()=>++lookups===3?[{address:'127.0.0.1',family:4}]:dns(),transport:async(u,t,o)=>{calls++;return o.kind==='robots'?{status:404}:{status:200,body:emptyShell};}})(jobUrl),{code:'UNSAFE_DNS'});assert.equal(calls,2);
 const plain=await mockJob();await assert.rejects(plain.run('https://jobs.example.org/Recruit/GI_Read/50176196'),{code:'NO_POSTING'});assert.equal(plain.calls.length,2);
});
test('new detail container is recognized only at the fixed JobKorea endpoint',async()=>{
 const {extractPosting}=await import('../lib/job-url/extract.js');
 assert.throws(()=>extractPosting(newDetail,'https://other.example/Recruit/GI_Read_Comt_Ifrm?Gno=50176196'),{code:'NO_POSTING'});
 assert.throws(()=>extractPosting(metadata,jobUrl),{code:'PARTIAL_POSTING'});
});
