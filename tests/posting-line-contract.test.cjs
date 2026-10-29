const test=require('node:test'),assert=require('node:assert/strict');
const cases=require('./fixtures/source-first-cases.json').records,{toCompact}=require('./helpers/compact-output.cjs');
const req=r=>({posting:r.posting,revision:r.expected.revision});
const item=(line,category='reference',extra={})=>({line,endLine:line,category,reason:'원문 검토',basisLine:0,roleLine:0,applicantLine:0,applicantType:'unclear',relation:'single',...extra});
const output=items=>({schemaVersion:2,revision:'test',mode:'posting-line-classification',complete:true,items});
async function expand(v,r){return (await import('../lib/agent/posting-line-contract.js')).expandCompactPostingOutput(v,r);}

test('numbered actual-source mock fixtures preserve all responsibilities/preferences without copying quotes',async()=>{
 const {validatePostingClassification}=await import('../lib/agent/posting-classifier.js');
 for(const record of cases){const request=req(record),model=await expand(toCompact(record.expected,request),request),data=validatePostingClassification(model,request);
 for(const category of ['responsibilities','required','preferred'])assert.equal(data.items.filter(x=>x.category===category).length,record.expected.items.filter(x=>x.category===category).length);
 for(const x of data.items)assert.equal(record.posting.slice(x.location.start,x.location.end),x.quote);
 assert.equal(data.approvalRequired,true);assert.deepEqual(data.coverage.missingLines,[]);
 }
});

test('empty, incomplete and selective output cannot fabricate full coverage or success',async()=>{
 const request={posting:'담당업무\n장비 운영\n자격요건\n학사 이상',revision:'test'};
 for(const value of [output([]),output([item(2,'responsibilities')]),{...output([item(1),item(2),item(3),item(4)]),complete:false}])await assert.rejects(expand(value,request),e=>e.validation?.reason==='POSTING_COVERAGE');
});

test('overlap and invalid positions fail rather than silently dropping source',async()=>{
 const request={posting:'공고\n업무',revision:'test'};
 for(const items of [[item(1),item(1),item(2)],[item(0),item(2)],[item(1),item(3)]])await assert.rejects(expand(output(items),request),e=>e.code==='INVALID_AGENT_OUTPUT');
});

test('explicit inline obligation survives; bad basis and cross-section evidence remain unresolved',async()=>{
 const request={posting:'자격요건\n학사 이상 필수\n우대사항\nLinux 경험',revision:'test'};
 const model=await expand(output([item(1),item(2,'required',{basisLine:2}),item(3),item(4,'required',{basisLine:1})]),request);
 assert.equal(model.items.find(x=>x.line===2).category,'required');assert.equal(model.items.find(x=>x.line===4).category,'unresolved');
});

test('CRLF, repeated headings, blank lines and Unicode quotes are server-derived',async()=>{
 const request={posting:'우대사항\r\n\r\n“SQL” 경험\r\n우대사항\r\nLinux 경험',revision:'test'};
 const model=await expand(output([item(1),item(3,'preferred',{basisLine:1}),item(4),item(5,'preferred',{basisLine:4})]),request);
 assert.equal(model.items[0].quote,'“SQL” 경험');assert.equal(model.items[1].quote,'Linux 경험');
});

test('negation, mixed required/preferred and invalid applicant scope cannot certify conditions',async()=>{
 for(const quote of ['SQL 경험은 필수가 아닙니다.','학사 이상 필수 / 보안 전공 우대','학사 이상 / 보안 전공 우대']){
 const request={posting:'자격요건\n'+quote,revision:'test'},model=await expand(output([item(1),item(2,'required',{basisLine:1})]),request);
 assert.equal(model.items[0].category,'unresolved');
 }
 const request={posting:'자격요건\n보안 경험',revision:'test'};
 const model=await expand(output([item(1),item(2,'required',{basisLine:1,applicantLine:99,applicantType:'experienced'})]),request);
 assert.equal(model.items[0].category,'required');assert.equal(model.items[0].applicantType,'unclear');assert.equal(model.items[0].applicantQuote,'');
});

test('a broad reference cannot conceal an explicit required qualification',async()=>{
 const request={posting:'회사 소개\n학력 학사 이상 필수 조건',revision:'test'};
 await assert.rejects(expand(output([{...item(1),endLine:2}]),request),e=>e.validation?.reason==='POSTING_REFERENCE_CONDITION');
});

test('multiple roles do not borrow preceding role obligation evidence',async()=>{
 const request={posting:'직무 A\n자격요건\nSQL 경험\n직무 B\nLinux 경험',revision:'test'};
 const model=await expand(output([item(1,'role'),item(2),item(3,'required',{basisLine:2,roleLine:1}),item(4,'role'),item(5,'required',{basisLine:2,roleLine:1})]),request);
 assert.equal(model.items.find(x=>x.line===5).category,'unresolved');
});

test('conversational qualification/preference headings retain explicit obligations',async()=>{
 const request={posting:'이런 경험을 가지신 분을 찾고 있어요!\n보안 경력 3년\n이런 경험이 있다면 더욱 좋아요!\nLinux 실무 경험',revision:'test'};
 const model=await expand(output([item(1),item(2,'required',{basisLine:1}),item(3),item(4,'preferred',{basisLine:3})]),request);
 assert.equal(model.items[0].category,'required');assert.equal(model.items[1].category,'preferred');
});

test('SDK retains safe validation reason rather than collapsing it to ADAPTER_FAILED',async()=>{
 const {createSdkAdapter}=await import('../lib/agent/adapters/ai-sdk.js');
 const adapter=createSdkAdapter({model:{},run:async()=>({output:output([])})});
 await assert.rejects(adapter.classify({request:{posting:'공고 내용',revision:'test'},instructions:[]},{signal:new AbortController().signal}),e=>e.code==='INVALID_AGENT_OUTPUT'&&e.validation.reason==='POSTING_COVERAGE');
});

test('Worxphere human-labeled source ranges retain duties 10, required 6, preferred 7 in mock contract',async()=>{
 const source=require('./fixtures/semantic-postings-50.json').records.find(x=>x.id==='50176196'),request={posting:source.posting,revision:'test'};
 const lines=source.posting.split('\n'),items=lines.flatMap((s,i)=>!s.trim()?[]:[item(i+1,i+1>=27&&i+1<=36?'responsibilities':i+1>=39&&i+1<=44?'required':i+1>=52&&i+1<=58?'preferred':'reference',{basisLine:i+1>=39&&i+1<=44?37:i+1>=52&&i+1<=58?51:0,relation:i+1===57?'mixed':[39,56].includes(i+1)?'or':'single'})]);
 const model=await expand(output(items),request);
 assert.deepEqual(['responsibilities','required','preferred'].map(k=>model.items.filter(x=>x.category===k).length),[10,6,7]);
});

test('line-derived draft requires approval then reaches unchanged comparison and roadmap',async()=>{
 const load=require('./load-browser-module.cjs'),review=load('../assets/posting-review.js'),compare=load('../assets/requirement-comparison.js'),roadmap=load('../assets/roadmap.js');
 const {validatePostingClassification}=await import('../lib/agent/posting-classifier.js');
 for(const record of cases){const request=req(record),data=validatePostingClassification(await expand(toCompact(record.expected,request),request),request),state=review.create();
 state.receive(record.posting,data);assert.equal(state.snapshot().approved,null);
 const approved=state.approve(record.posting,true),items=compare.requirements(record.posting,{analyze(){throw Error('must not reclassify');}},approved);
 assert.equal(items.length,6);const plan=roadmap.buildRoadmap(items.map(x=>({...x,status:'확인 필요'})));
 assert.equal(plan.total,6);assert.equal(plan.totals['충족'],0);
 state.invalidate();assert.equal(state.snapshot().approved,null);
 }
});

test('an OR clause cannot be accepted with a guessed AND relationship',async()=>{
 const request={posting:'자격요건\n정보보안기사 또는 관련 전공',revision:'test'};
 const model=await expand(output([item(1),item(2,'required',{basisLine:1,relation:'and'})]),request);
 assert.equal(model.items[0].category,'required');assert.equal(model.items[0].relation,'unclear');
});

test('recorded Worxphere failure: unsupported experienced label must not erase explicit required/preferred categories',async()=>{
 const posting='모집 직무: 보안 엔지니어 (3년이상)\n이런 경험을 가지신 분을 찾고 있어요!\n- 보안 운영 경험\n이런 경험이 있다면 더욱 좋아요!\n- 클라우드 경험',request={posting,revision:'test'};
 const model=await expand(output([item(1,'role'),item(2),item(3,'required',{basisLine:2,applicantLine:1,applicantType:'experienced'}),item(4),item(5,'preferred',{basisLine:4,applicantLine:1,applicantType:'experienced'})]),request);
 assert.deepEqual(model.items.map(x=>x.category),['role','required','preferred']);
 for(const x of model.items.slice(1)){assert.equal(x.applicantType,'unclear');assert.match(x.uncertainty,/적용 근거/);}
});

test('recorded grouped duties split at explicit bullet boundaries while continuation lines stay together',async()=>{
 const request={posting:'담당업무\n- IT보안\n- 네트워크 보안\n- 개인정보보안\n  (보안장비 설치 및 유지보수)',revision:'test'};
 const model=await expand(output([item(1),{...item(2,'responsibilities'),endLine:5}]),request);
 assert.equal(model.items.length,3);assert.equal(model.items[2].endLine,5);assert.match(model.items[2].quote,/유지보수/);
});

test('AND/OR words in legal reference text do not turn it into a qualification question',async()=>{
 const request={posting:'채용 서류를 반환 또는 파기하며 보관 및 처리 절차를 안내합니다.',revision:'test'};
 const model=await expand(output([item(1)]),request);
 assert.equal(model.items.length,0);assert.equal(model.referenceRanges.length,1);
});

test('test-only observer retains original line proposals for exact unpaid replay, even after server rejection',async()=>{
 const {createSdkAdapter}=await import('../lib/agent/adapters/ai-sdk.js');const raw=output([]),captured=[];
 const adapter=createSdkAdapter({model:{},run:async()=>({output:raw}),onClassificationOutput:v=>captured.push(v)});
 await assert.rejects(adapter.classify({request:{posting:'원문',revision:'test'},instructions:[]},{signal:new AbortController().signal}));
 assert.deepEqual(captured,[raw]);captured[0].complete=false;assert.equal(raw.complete,true);
});

test('explicit experienced-only source phrase survives even when model scope is absent',async()=>{
 const request={posting:'자격요건\n경력만 해당: 보안 운영 경험',revision:'test'};
 const model=await expand(output([item(1),item(2,'required',{basisLine:1})]),request);
 assert.equal(model.items[0].category,'required');assert.equal(model.items[0].applicantType,'experienced');assert.equal(model.items[0].applicantQuote,'경력만 해당');
});
