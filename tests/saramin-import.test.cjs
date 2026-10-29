const test=require('node:test'),assert=require('node:assert/strict');
const dns=async()=>[{address:'8.8.8.8',family:4}];
const html='<div class="user_content jobsViewDetail_123"><main class="job-posting"><p>모집분야</p><p>사무지원직 비서</p><p>📋 주요업무</p><p>비서업무 및 사무 지원</p><p>📋 자격요건</p><p>고졸 이상 / 전공 무관</p><p>🏠 근무조건</p><p>계약직 12개월</p><p>🚀 채용절차</p><p>홈페이지 지원</p><p>🛎️ 유의사항</p><p>상세 사항은 홈페이지 확인</p></main></div>';
test('Saramin relay uses same numeric posting canonical URL and recognizes emoji headings',async()=>{
 const {createImporter}=await import('../lib/job-url/service.js');const calls=[];
 const result=await createImporter({resolver:dns,transport:async(u,t,o)=>{calls.push(u.href);return o.kind==='robots'?{status:404}:{status:200,headers:{},body:html};}})('https://www.saramin.co.kr/zf_user/jobs/relay/view?rec_idx=123&searchword=other#seq=0');
 assert.deepEqual(calls,['https://www.saramin.co.kr/robots.txt','https://www.saramin.co.kr/zf_user/jobs/view?rec_idx=123']);
 assert.equal(result.fields.responsibilities.length,1);assert.equal(result.fields.required.length,1);
 assert.match(result.fields.required[0].value,/고졸/);assert.equal(result.contentStatus,'body');
 assert.match(result.fields.required[0].evidence.sourceUrl,/rec_idx=123$/);
});
test('Saramin canonical still respects robots and rejects ambiguous identities',async()=>{
 const {createImporter}=await import('../lib/job-url/service.js');let requests=0;
 const importer=createImporter({resolver:dns,transport:async()=>{requests++;return {status:200,body:'User-agent: *\nDisallow: /zf_user/jobs/view'};}});
 for(const query of ['rec_idx=123&rec_idx=456','rec_idx=abc','other=123'])await assert.rejects(importer('https://www.saramin.co.kr/zf_user/jobs/relay/view?'+query),{code:'UNSAFE_URL'});
 assert.equal(requests,0);
 await assert.rejects(importer('https://www.saramin.co.kr/zf_user/jobs/relay/view?rec_idx=123'));assert.equal(requests,1);
});


test('public Saramin HTML retries one transient broken connection after the robots policy check',async()=>{
 const [{createImporter},{ImportError}]=await Promise.all([import('../lib/job-url/service.js'),import('../lib/job-url/errors.js')]);
 let htmlRequests=0,robotsRequests=0;
 const importer=createImporter({resolver:dns,transport:async(u,t,o)=>{
  if(o.kind==='robots'){robotsRequests++;return {status:404};}
  htmlRequests++;
  if(htmlRequests===1)throw new ImportError('FETCH_FAILED');
  return {status:200,headers:{},body:html};
 }});
 const result=await importer('https://www.saramin.co.kr/zf_user/jobs/view?rec_idx=123');
 assert.equal(result.contentStatus,'body');
 assert.equal(robotsRequests,1);
 assert.equal(htmlRequests,2);
});
test('do not retry robots failure, remote blocking, or repeated transport error',async()=>{
 const [{createImporter},{ImportError}]=await Promise.all([import('../lib/job-url/service.js'),import('../lib/job-url/errors.js')]);
 let robotsCalls=0,htmlCalls=0;
 const blocked=createImporter({resolver:dns,transport:async(u,t,o)=>{
  if(o.kind==='robots'){robotsCalls++;return {status:404};}
  htmlCalls++;return {status:429,headers:{},body:''};
 }});
 await assert.rejects(blocked('https://www.saramin.co.kr/zf_user/jobs/view?rec_idx=123'),{code:'REMOTE_BLOCKED'});
 assert.equal(htmlCalls,1);
 assert.equal(robotsCalls,1);
 let failures=0;
 const errors=createImporter({resolver:dns,transport:async(u,t,o)=>{
  if(o.kind==='robots')return {status:404};
  failures++;throw new ImportError('FETCH_FAILED');
 }});
 await assert.rejects(errors('https://www.saramin.co.kr/zf_user/jobs/view?rec_idx=123'),{code:'FETCH_FAILED'});
 assert.equal(failures,2);
 let policyAttempts=0;
 const unavailable=createImporter({resolver:dns,transport:async(u,t,o)=>{
  policyAttempts++;throw new ImportError('FETCH_FAILED');
 }});
 await assert.rejects(unavailable('https://www.saramin.co.kr/zf_user/jobs/view?rec_idx=123'),{code:'FETCH_FAILED'});
 assert.equal(policyAttempts,1);
});
