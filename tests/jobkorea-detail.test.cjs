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
 assert.match(messages.IMAGE_POSTING,/이미지 글자 추출/);
 assert.throws(()=>extractPosting('<img src="logo.png">','https://example.org'),{code:'NO_POSTING'});
});
