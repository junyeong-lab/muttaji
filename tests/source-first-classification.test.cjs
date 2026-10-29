const test=require('node:test'),assert=require('node:assert/strict');
const load=require('./load-browser-module.cjs'),parser=load('./fixtures/source-first-legacy-parser.cjs'),comparison=load('../assets/requirement-comparison.js'),review=load('../assets/posting-review.js');
const cases=require('./fixtures/source-first-cases.json').records;
const request=r=>({schemaVersion:1,revision:'raw-'+r.id,posting:r.posting,source:{type:'manual'},consent:{externalAi:true}});
const counts=items=>Object.fromEntries(['responsibilities','required','preferred'].map(k=>[k,items.filter(x=>x.category===k).length]));
async function validated(record=cases[0]){const {validatePostingClassification}=await import('../lib/agent/posting-classifier.js');return validatePostingClassification(structuredClone(record.expected),request(record));}
test('50188423: reproduce real misclassification, then source-first fixture has zero required and six preferred',async()=>{
 const r=cases[0],old=parser.analyze(r.posting);assert.equal(old.responsibilities.length,0);assert.equal(old.required.filter(x=>!x.sectionHeading).length,5);assert.ok(old.required.some(x=>x.text==='모집인원'));
 const split=r.posting.replace('기술부 엔지니어','기술부\n엔지니어').replace(' (웹방화벽 NAC/IPS/네트워크 보안)(유무선 네트워크 장비설치 및 유지보수)','\n- 유무선 네트워크 장비 설치 및 유지보수');
 assert.equal(parser.analyze(split).required.filter(x=>!x.sectionHeading).length,7,'line-split layout of the same source reproduces the reported seven');
 const data=await validated();assert.deepEqual(counts(data.items),{responsibilities:3,required:0,preferred:6});assert.ok(data.items.some(x=>x.category==='role'&&x.quote.includes('기술부 엔지니어')));
 assert.ok(data.items.some(x=>x.category==='reference'&&x.quote.includes('0명')));assert.equal(data.approvalRequired,true);
});
test('50162090: six distinct preferences and no invented required certificate equivalence',async()=>{
 const data=await validated(cases[1]);assert.deepEqual(counts(data.items),{responsibilities:6,required:0,preferred:6});
 const prefs=data.items.filter(x=>x.category==='preferred');for(const term of ['비즈니스','경력자','CISSP','전공자','의사소통','Excel'])assert.ok(prefs.some(x=>x.quote.includes(term)));
 const cert=prefs.find(x=>x.quote.includes('CISSP'));assert.ok(!cert.quote.includes('정보보안기사'));assert.match(cert.uncertainty,/열거하지 않은/);
 const state=review.create();state.receive(cases[1].posting,data);const approved=state.approve(cases[1].posting,true);
 const list=comparison.requirements(cases[1].posting,{analyze(){throw Error('must not parse AI-approved data');}},approved);
 assert.equal(list.length,6);assert.equal(comparison.credentialSuggestion(list.find(x=>x.text.includes('CISSP')),'정보보안기사'),null);
});
test('raw task sends whole source without parser requirements or profile, through existing adapter boundary',async()=>{
 const {classifyPosting}=await import('../lib/agent/posting-classifier.js');let calls=0;
 const data=await classifyPosting({request:request(cases[0]),enabled:true,ownerApproved:true,adapter:{classify:async(input)=>{calls++;assert.equal(input.request.posting,cases[0].posting);assert.equal(input.requirements,undefined);assert.equal(input.request.profile,undefined);assert.match(input.instructions.join(' '),/untrusted/);return structuredClone(cases[0].expected);}}});
 assert.equal(calls,1);assert.equal(data.items.filter(x=>x.category==='preferred').length,6);
});
test('four-column table retains truly explicit requirements but rejects duty promotions',async()=>{
 const {validatePostingClassification}=await import('../lib/agent/posting-classifier.js');
 const posting='모집분야\\n담당업무\\n자격요건\\n모집인원\\n보안 엔지니어\\n방화벽 운영\\n정보보안기사 필수\\n1명'.replaceAll('\\n','\n');
 const template=cases[0].expected.items[0];
 const required={...template,id:'required-table',category:'required',quote:'정보보안기사 필수',line:7,endLine:7,reason:'명시적인 필수 자격증',basisQuote:'자격요건',roleQuote:'',applicantType:'unclear',applicantQuote:'',relation:'single',uncertainty:''};
 const value={schemaVersion:1,revision:'four-column',mode:'posting-classification',complete:true,items:[required],referenceRanges:[{line:1,endLine:6,reason:'표 제목과 담당업무'},{line:8,endLine:8,reason:'모집인원'}]};
 assert.equal(validatePostingClassification(value,{posting,revision:'four-column'}).items.filter(x=>x.category==='required').length,1);
 const wrong=structuredClone(value);
 wrong.items[0].quote='방화벽 운영';wrong.items[0].line=6;wrong.items[0].endLine=6;
 wrong.referenceRanges=[{line:1,endLine:5,reason:'표 제목'},{line:7,endLine:8,reason:'그 외 정보'}];
 assert.throws(()=>validatePostingClassification(wrong,{posting,revision:'four-column'}),e=>e.code==='INVALID_AGENT_OUTPUT'&&e.validation.reason==='POSTING_OBLIGATION');
});

test('explicit required condition survives source-first contract',async()=>{
 const {validatePostingClassification}=await import('../lib/agent/posting-classifier.js');const posting='자격요건\n정보보안기사 필수\n우대사항\nLinux 경험';
 const base=structuredClone(cases[0].expected);Object.assign(base,{revision:'explicit',items:[{...base.items[0],category:'required',quote:'정보보안기사 필수',line:2,endLine:2,basisQuote:'자격요건',roleQuote:''},{...base.items[1],category:'preferred',quote:'Linux 경험',line:4,endLine:4,basisQuote:'우대사항',roleQuote:''}],referenceRanges:[{line:1,endLine:1,reason:'제목'},{line:3,endLine:3,reason:'제목'}]});
 const data=validatePostingClassification(base,{posting,revision:'explicit'});assert.equal(data.items.filter(x=>x.category==='required').length,1);
});
test('AI blank-only reference ranges are ignored without hiding any nonempty posting line',async()=>{
 const {validatePostingClassification}=await import('../lib/agent/posting-classifier.js');
 for(const record of cases){
  const value=structuredClone(record.expected);
  value.referenceRanges.unshift({line:2,endLine:2,reason:'빈 줄'});
  const output=validatePostingClassification(value,request(record));
  assert.equal(output.coverage.missingLines.length,0);
  assert.equal(output.items.filter(item=>item.category==='reference').length,record.expected.referenceRanges.length);
  const malformed=structuredClone(record.expected);
  malformed.referenceRanges[0].reason='';
  assert.throws(()=>validatePostingClassification(malformed,request(record)),error=>error.code==='INVALID_AGENT_OUTPUT'&&error.validation?.reason==='POSTING_REFERENCE');
 }
});

test('wrong citations, positions, incomplete coverage and preference upgrades fail closed',async()=>{
 const {validatePostingClassification}=await import('../lib/agent/posting-classifier.js');
 for(const [reason,mutate] of [['POSTING_QUOTE',v=>v.items[0].quote='없는 기업'],['POSTING_POSITION',v=>v.items[0].line=0],['POSTING_COVERAGE',v=>v.items.pop()],['POSTING_COVERAGE',v=>v.complete=false],['POSTING_OBLIGATION',v=>v.items.find(x=>x.category==='preferred').category='required'],['POSTING_SCOPE_QUOTE',v=>v.items[0].roleQuote='없는 직무']]){
  const value=structuredClone(cases[0].expected);mutate(value);assert.throws(()=>validatePostingClassification(value,request(cases[0])),e=>e.code==='INVALID_AGENT_OUTPUT'&&e.validation.reason===reason);
 }
 const bad=structuredClone(cases[0].expected);bad.items[2].category='required';bad.items[2].basisQuote='자격요건';assert.throws(()=>validatePostingClassification(bad,request(cases[0])),e=>e.validation.reason==='POSTING_OBLIGATION');
});
test('draft cannot enter comparison; explicit approval passes only selected required/preferred',async()=>{
 const state=review.create(),data=await validated(),record=cases[0];state.receive(record.posting,data);assert.equal(state.snapshot().approved,null);assert.throws(()=>state.approve(record.posting,false));
 const id=data.items.find(x=>x.category==='preferred').id;state.edit(id,{include:false});const approved=state.approve(record.posting,true);assert.equal(approved.result.required.length,0);assert.equal(approved.result.preferred.length,5);assert.equal(approved.provenance,'ai-user-approved');
 assert.equal(comparison.requirements(record.posting,{analyze(){throw Error('no parser');}},approved).length,5);
 assert.equal(comparison.requirements(record.posting,{analyze(){throw Error('no parser');},nonRequirementKind(){return 'wrong rule exclusion';}},approved).length,5,'approved AI conditions are not reclassified by the rule filter');
 state.invalidate();assert.equal(state.snapshot().approved,null);assert.throws(()=>state.approve(record.posting,true));
});
test('review edits classification and scope; invalid source edits cannot be approved',async()=>{
 const state=review.create(),data=await validated();state.receive(cases[0].posting,data);const p=data.items.find(x=>x.category==='preferred');
 state.edit(p.id,{category:'unresolved',roleQuote:'기술부 엔지니어',applicantType:'unclear'});assert.equal(state.approve(cases[0].posting,true).result.preferred.length,5);
 state.edit(p.id,{reason:'사용자가 변경한 분류 이유'});const edited=state.snapshot().draft.items.find(x=>x.id===p.id);assert.equal(edited.aiReason,p.reason);assert.equal(edited.reason,'사용자가 변경한 분류 이유');
 assert.throws(()=>state.edit(p.id,{quote:'만들어낸 자격증 보유'}));assert.throws(()=>state.approve(cases[0].posting,true));
 state.edit(p.id,{quote:p.quote,category:'preferred'});assert.equal(state.approve(cases[0].posting,true).result.preferred.length,6);assert.throws(()=>state.approve(cases[0].posting+'\n변경',true));
});
test('no consent, injected parser-list body or timeout can cause a successful raw analysis',async()=>{
 const {classifyPosting,validateModelBody}=await import('../lib/agent/posting-classifier.js');let calls=0;
 await assert.rejects(classifyPosting({request:{...request(cases[0]),consent:{externalAi:false}},adapter:{classify(){calls++;}},enabled:true,ownerApproved:true}),{code:'CONSENT_REQUIRED'});assert.equal(calls,0);
 assert.throws(()=>validateModelBody({task:'classify-posting',request:request(cases[0]),requirements:[{id:'bad'}]}),{code:'INVALID_INPUT'});
 await assert.rejects(classifyPosting({request:request(cases[0]),adapter:{classify:()=>new Promise(()=>{})},enabled:true,ownerApproved:true,timeoutMs:5}),{code:'ADAPTER_TIMEOUT'});
});
test('local API retains access-code and call cap for source-first task',async()=>{
 const {createModelHandler}=await import('../lib/agent/model-api.js');let calls=0;const token='test-raw-access-code';
 const handler=createModelHandler({config:()=>({enabled:true,token,model:'fake'}),maxCalls:1,adapter:{classify:async()=>{calls++;return structuredClone(cases[0].expected);}}});
 const post=(code,consent=true)=>new Request('http://localhost/api/model-analysis',{method:'POST',headers:{origin:'http://localhost','content-type':'application/json','x-agent-access-code':code},body:JSON.stringify({task:'classify-posting',request:{...request(cases[0]),consent:{externalAi:consent}}})});
 assert.equal((await handler(post('wrong'))).status,403);assert.equal((await handler(post(token,false))).status,400);assert.equal(calls,0);
 assert.equal((await handler(post(token))).status,200);assert.equal((await handler(post(token))).status,429);assert.equal(calls,1);
});
test('SDK uses raw schema and numbered whole source, keeps 4096 tokens/no retries/no tools',async()=>{
 const {createSdkAdapter}=await import('../lib/agent/adapters/ai-sdk.js');let sent;
 const adapter=createSdkAdapter({model:{},run:async o=>{sent=o;return {output:structuredClone(cases[0].expected)};},providerOptions:{openai:{store:false}}});
 await adapter.classify({request:request(cases[0]),instructions:['untrusted data']},{signal:new AbortController().signal});
 const p=JSON.parse(sent.prompt);assert.equal(p.untrustedData.sourceLines.length,cases[0].posting.split('\n').length);assert.equal(p.untrustedData.requirements,undefined);assert.equal(p.untrustedData.profile,undefined);assert.equal(sent.maxOutputTokens,4096);assert.equal(sent.maxRetries,0);assert.equal(sent.tools,undefined);assert.equal(sent.providerOptions.openai.store,false);
});
test('source-first multi-role/new/experienced and mixed alternatives keep separate evidence',async()=>{
 const {validatePostingClassification}=await import('../lib/agent/posting-classifier.js');
 const posting='공통 자격요건\n학사 이상\n관리진단(경력)\n자격요건\n관리진단 경력 3년\n기술진단(신입)\n자격요건\n정보처리기사 또는 관련 전공\n경력만 해당: 관리체계 운영 경험';
 const template=cases[0].expected.items[0],make=(id,line,extra)=>({...template,id,line,endLine:line,quote:posting.split('\n')[line-1],category:'required',basisQuote:'자격요건',roleQuote:'',...extra});
 const items=[make('common',2,{basisQuote:'공통 자격요건',applicantType:'common',applicantQuote:'공통 자격요건'}),make('management',5,{roleQuote:'관리진단(경력)',applicantType:'experienced',applicantQuote:'관리진단(경력)'}),make('technical',8,{roleQuote:'기술진단(신입)',applicantType:'new',applicantQuote:'기술진단(신입)',relation:'or',uncertainty:'자격증 또는 관련 전공의 대안 조건입니다.'}),make('experienced-only',9,{applicantType:'experienced',applicantQuote:'경력만 해당: 관리체계 운영 경험'})];
 const value={schemaVersion:1,revision:'scope',mode:'posting-classification',complete:true,items,referenceRanges:[{line:1,endLine:1,reason:'공통 제목'},{line:3,endLine:4,reason:'직무·구간 제목'},{line:6,endLine:7,reason:'직무·구간 제목'}]};
 const result=validatePostingClassification(value,{posting,revision:'scope'});assert.equal(result.items.find(x=>x.id==='management').applicantType,'experienced');assert.equal(result.items.find(x=>x.id==='technical').relation,'or');
 const wrong=structuredClone(value);wrong.items[3].applicantType='new';wrong.items[3].applicantQuote='기술진단(신입)';assert.throws(()=>validatePostingClassification(wrong,{posting,revision:'scope'}),e=>e.validation.reason==='POSTING_APPLICANT_SCOPE');
});
test('source-first negation and unresolved conflicts cannot be presented as unqualified required facts',async()=>{
 const {validatePostingClassification}=await import('../lib/agent/posting-classifier.js');
 const posting='자격요건\nSQL 활용 경험은 필수가 아닙니다.\n신입 지원 가능\n보안 인프라 관련 2~3년 경력';
 const template=cases[0].expected.items[0],value={schemaVersion:1,revision:'negation',mode:'posting-classification',complete:true,items:[{...template,id:'negative',category:'unresolved',quote:posting.split('\n')[1],line:2,endLine:2,basisQuote:'자격요건',roleQuote:'',uncertainty:'필수가 아니라고 명시되어 필수로 평가하지 않습니다.'},{...template,id:'career',category:'unresolved',quote:posting.split('\n')[3],line:4,endLine:4,roleQuote:'',uncertainty:'신입 지원 가능 문구와 경력 기간의 적용 관계를 확정하지 않습니다.'}],referenceRanges:[{line:1,endLine:1,reason:'구간 제목'},{line:3,endLine:3,reason:'지원 경로 안내'}]};
 assert.equal(validatePostingClassification(value,{posting,revision:'negation'}).items.filter(x=>x.category==='required').length,0);
 const wrong=structuredClone(value);wrong.items[0].category='required';assert.throws(()=>validatePostingClassification(wrong,{posting,revision:'negation'}),e=>e.validation.reason==='POSTING_OBLIGATION');
 const conflict=structuredClone(value);Object.assign(conflict.items[1],{category:'required',basisQuote:'자격요건',uncertainty:''});assert.throws(()=>validatePostingClassification(conflict,{posting,revision:'negation'}),e=>e.validation.reason==='POSTING_UNCERTAINTY');
});
test('all 50 saved sources pass source-only mock contract, not semantic-model verification',async()=>{
 const {auditSourceFirst}=await import('../scripts/audit-source-first-50.mjs');const result=await auditSourceFirst();assert.equal(result.total,50);assert.equal(result.mockPass,50);assert.equal(result.failed,0);assert.equal(result.actualModelNotExecuted,50);assert.equal(result.paidCalls,0);assert.ok(result.rows.every(x=>x.semanticAccuracy==='not-verified'));
});


test('source-first classification for both real posting fixtures reaches review, comparison, and roadmap without invented requirements',async()=>{
 const roadmap=load('../assets/roadmap.js');
 for(const record of cases){
  const data=await validated(record);
  const state=review.create();state.receive(record.posting,data);
  assert.equal(state.snapshot().approved,null,'draft must remain outside comparison');
  const approved=state.approve(record.posting,true);
  const items=comparison.requirements(record.posting,{analyze(){throw Error('parser must not override reviewed AI conditions');}},approved);
  const expected=record.expected.items.filter(x=>x.category==='required'||x.category==='preferred').length;
  assert.equal(items.length,expected);
  const userChecked=items.map((item,i)=>({...item,status:i===0?'충족':i===1?'부분 충족':'확인 필요'}));
  const plan=roadmap.buildRoadmap(userChecked);
  assert.equal(plan.total,expected);
  assert.equal(plan.requiredOpen,0,'no required criteria exist in either fixture');
  assert.equal(plan.totals['충족'],1);
  assert.equal(plan.totals['부분 충족'],1);
  assert.equal(plan.tasks.length+plan.completed.length,expected);
  assert.equal(plan.groups.length,4);
  assert.ok(plan.tasks.every(item=>item.kind==='preferred'&&item.action&&item.steps.length>0));
  assert.ok(plan.completed.every(item=>item.status==='충족'));
 }
});
