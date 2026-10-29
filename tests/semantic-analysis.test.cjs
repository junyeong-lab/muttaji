const test=require('node:test'),assert=require('node:assert/strict');
const corpus=require('./fixtures/semantic-postings-50.json').records;
const profile={'goal-job':'정보보안','education':'가상대학교 기관공학전공 학사 졸업','experience':'가상 지원자의 군 정보통신 업무\n사이버보안 기획\n정보자산·보안정책·취약점 점검\n사이버 위협 분석 및 정례 보고\n통신지원 및 부대 간 협력 경험','certs':'정보처리기사\nSQLD\n네트워크관리사 2급','skills':'Wazuh 로그 수집 및 분석 실습\nGNS3 네트워크 구축 실습\nLinux·Windows 시스템 실습\n가상 보안 교육 프로젝트'};
const source=id=>corpus.find(x=>x.id===id).posting;
const line=(id,n)=>source(id).split('\n')[n-1];
const unit=(quote,extra={})=>({quote,obligation:'unclear',roleScope:'unclear',roleQuote:'',applicantType:'unclear',applicantQuote:'',relation:'start',...extra});
const request=posting=>({schemaVersion:1,revision:'semantic-test',posting,profile:structuredClone(profile),source:{type:'manual'},consent:{externalAi:true}});
function response(req,quote,units,uncertainties=[]){return {schemaVersion:1,revision:req.revision,mode:'model-suggestion',needsHumanReview:true,items:[{id:'r',postingQuote:quote,interpretation:'원문 조건 확인',taskType:'unclear',keySkills:[],profileEvidence:[],proposedStatus:'확인 필요',reason:'계약 검사용 의견',missing:[],actions:[],certifications:[],semantics:{units,uncertainties}}]};}
// Explicit fake output: these tests verify contracts/guards, not a live model.
async function run(posting,quote,units,options={}){
 const {analyzePrepared}=await import('../lib/agent/provider-interface.js');
 const req=request(posting);if(options.context)req.analysisContext=options.context;
 Object.assign(req.profile,options.profile||{});
 const value=response(req,quote,units,options.uncertainties||[]),item=value.items[0];
 Object.assign(item,{interpretation:'공고에 적힌 조건을 해석한 모의 의견입니다.',profileEvidence:[{field:'experience',quote:'정보자산·보안정책·취약점 점검'}],proposedStatus:'부분 충족',reason:'입력한 보안 점검은 관련 경험입니다.'},options.item||{});
 return {result:await analyzePrepared({request:req,requirements:[{id:'r',sourceQuote:quote}],catalog:options.catalog||[],adapter:{analyze:async()=>value},enabled:true,ownerApproved:true}),req,value};
}
test('50190160: mixed negative/positive sentence is an AI-only candidate and keeps both meanings',async()=>{
 const {prepareSemanticRequirements}=await import('../lib/agent/semantic-analysis.js');
 const posting=source('50190160'),quote=line('50190160',43),clauses=quote.split(/(?<=\.) /);
 const prepared=prepareSemanticRequirements(posting,[{id:'python',sourceQuote:line('50190160',38)}]);
 assert.equal(prepared.requirements.length,2);assert.equal(prepared.requirements[1].sourceQuote,quote);
 const {result}=await run(posting,quote,[unit(clauses[0],{obligation:'not_required'}),unit(clauses[1],{obligation:'required',relation:'unclear'})]);
 assert.equal(result.items[0].semanticAnalysis.units[0].obligation,'not_required');
 assert.equal(result.items[0].semanticAnalysis.units[1].obligation,'required');
 assert.equal(result.items[0].semanticAnalysis.units[0].locations[0].line,43);
 await assert.rejects(run(posting,quote,[unit(quote,{obligation:'required'})]),e=>e.validation.reason==='SEMANTIC_NEGATION');
});
test('54699487: role-specific requirements stay separate until explicit matching role is selected',async()=>{
 const posting=source('54699487'),quote=line('54699487',19),units=[unit(quote,{obligation:'required',roleScope:'specific',roleQuote:line('54699487',18),applicantType:'experienced',applicantQuote:line('54699487',18)})];
 const unknown=await run(posting,quote,units);assert.equal(unknown.result.items[0].proposedStatus,'확인 필요');
 assert.match(unknown.result.items[0].reason,/직무.*선택되지/);
 const wrong=await run(posting,quote,units,{context:{selectedRole:'기술진단 컨설팅',applicantType:'new'}});assert.equal(wrong.result.items[0].proposedStatus,'확인 필요');
 const matching=await run(posting,quote,units,{context:{selectedRole:'관리진단 컨설팅',applicantType:'experienced'}});assert.equal(matching.result.items[0].proposedStatus,'부분 충족');
 assert.equal(matching.req.profile['goal-job'],'정보보안');
});
test('53349215: common/experienced/new headings and arrow examples retain source context',async()=>{
 const posting=source('53349215');
 for(const [n,type,heading] of [[53,'common',52],[60,'experienced',58],[66,'new',65]]){
  const quote=line('53349215',n),{result}=await run(posting,quote,[unit(quote,{obligation:'preferred',applicantType:type,applicantQuote:line('53349215',heading)})]);
  assert.equal(result.items[0].semanticAnalysis.units[0].applicantType,type);
  assert.equal(result.items[0].semanticAnalysis.units[0].applicantLocations[0].line,heading);
 }
 const quote=[63,64].map(n=>line('53349215',n)).join('\n');
 const parts=quote.split(' 및 ');
 const {result}=await run(posting,quote,parts.map((q,i)=>unit(q,{obligation:'preferred',applicantType:'experienced',applicantQuote:'[경력]',relation:i?'and':'start'})));
 assert.match(result.items[0].semanticAnalysis.units[1].quote,/→ 서버/);
});
test('52242444: experienced-only qualifier is not imposed on a new applicant',async()=>{
 const posting=source('52242444'),quote=line('52242444',21),units=[unit(quote,{obligation:'required',applicantType:'experienced',applicantQuote:quote})];
 const {result}=await run(posting,quote,units,{context:{selectedRole:'',applicantType:'new'},item:{proposedStatus:'미충족'}});
 assert.equal(result.items[0].proposedStatus,'확인 필요');assert.match(result.items[0].reason,/그대로 적용/);
 await assert.rejects(run(posting,quote,[unit(quote,{applicantType:'new',applicantQuote:'ㆍ신입 혹은 경력 2년 이하 경력'})]),e=>e.validation.reason==='SEMANTIC_APPLICANT_SCOPE');
});
test('50186173: AND/OR in one physical line remains traceable; one credential cannot fulfill the compound',async()=>{
 const posting=source('50186173'),whole=line('50186173',25),quote=whole.split('[자격요건]')[1].split('[우대사항]')[0].trim();
 const parts=['학력 : 초대졸 이상(졸업예정자 가능)','경력 : 신입','시스템 엔지니어 경력 2년 이상'];
 const {result}=await run(posting,quote,parts.map((q,i)=>unit(q,{obligation:'required',relation:i===0?'start':i===1?'and':'or'})),{item:{proposedStatus:'충족',profileEvidence:[{field:'certs',quote:'정보처리기사'}]}});
 assert.equal(result.items[0].proposedStatus,'확인 필요');
 assert.deepEqual(result.items[0].semanticAnalysis.units.map(x=>x.relation),['start','and','or']);
 for(const u of result.items[0].semanticAnalysis.units)assert.equal(u.locations[0].line,25);
 const omitted=[unit(parts[0])];await assert.rejects(run(posting,quote,omitted),e=>e.validation.reason==='SEMANTIC_COVERAGE');
});
test('52030033: novice eligibility and career threshold conflict remains unresolved with exact evidence',async()=>{
 const posting=source('52030033'),quote=line('52030033',10),uncertainties=[{quote:line('52030033',8),reason:'신입 지원 가능 문구와 경력 기간의 적용 관계가 불명확합니다.'}];
 const {result}=await run(posting,quote,[unit(quote,{obligation:'required'})],{uncertainties,item:{proposedStatus:'충족'}});
 assert.equal(result.items[0].proposedStatus,'확인 필요');
 assert.equal(result.items[0].semanticAnalysis.uncertainties[0].locations[0].line,8);
 assert.equal(result.items[0].semanticAnalysis.units[0].locations[0].line,10);
});
test('invented, missing, reordered or cross-requirement semantic evidence fails closed',async()=>{
 const posting='필수조건\nSQL 경험 및 Python 경험\n우대사항\nLinux 경험',quote='SQL 경험 및 Python 경험';
 for(const units of [[unit('SQL 숙련')],[unit('Linux 경험')],[unit('Python 경험'),unit('SQL 경험',{relation:'and'})],[unit('SQL 경험'),unit('Python 경험',{relation:'or'})]])await assert.rejects(run(posting,quote,units),{code:'INVALID_AGENT_OUTPUT'});
 await assert.rejects(run(posting,quote,[unit(quote,{roleScope:'specific',roleQuote:'없는 직무'})]),e=>e.validation.reason==='SEMANTIC_SCOPE_QUOTE');
 await assert.rejects(run(posting,quote,[unit('SQL 경험'),unit('Python 경험',{relation:'and'})],{uncertainties:[{quote:'없는 문구',reason:'test'}]}),e=>e.validation.reason==='SEMANTIC_QUOTE');
});
test('owned certificate reacquisition recommendations are removed without mutating input or roadmap',async()=>{
 const quote='정보처리기사 보유자 우대',catalog=[{id:'owned',name:'정보처리기사'},{id:'other',name:'정보보안기사'}];
 const {result,req,value}=await run(quote,quote,[unit(quote,{obligation:'preferred'})],{catalog,item:{actions:['정보처리기사 취득을 준비하세요.','보안점검 역할과 결과를 정리하세요.'],certifications:[{id:'owned',reason:'학습',postingQuote:quote}]}});
 assert.equal(result.items[0].certifications.length,0);assert.deepEqual(result.items[0].actions,['보안점검 역할과 결과를 정리하세요.']);
 assert.equal(value.items[0].certifications.length,1);assert.equal(req.profile.certs,profile.certs);
 assert.equal(result.items[0].roadmapSupplement.advisoryOnly,true);assert.equal(result.assessments,undefined);
});
test('labs and military assessment do not certify production tenure or auditor credentials',async()=>{
 for(const quote of ['상용 운영 경력 3년 이상','ISMS-P 인증 심사원 보유']){
  const posting='필수조건\n'+quote,{result}=await run(posting,quote,[unit(quote,{obligation:'required'})],{item:{proposedStatus:'충족',profileEvidence:[{field:'skills',quote:'Wazuh 로그 수집 및 분석 실습'}]}});
  assert.equal(result.items[0].proposedStatus,'확인 필요');assert.match(result.items[0].reason,/동일하게 확정하지/);
 }
});
test('location offsets preserve CRLF, repeated text and original strings',async()=>{
 const {locations,prepareSemanticRequirements}=await import('../lib/agent/semantic-analysis.js');
 const posting='공통\r\nSQL 경험\r\nSQL 경험';assert.deepEqual(locations(posting,'SQL 경험').map(x=>x.line),[2,3]);
 for(const p of locations(posting,'SQL 경험'))assert.equal(posting.slice(p.start,p.end),'SQL 경험');
 const p=prepareSemanticRequirements('SQL 경험은 필수가 아닙니다.',Array.from({length:20},(_,i)=>({id:String(i),sourceQuote:'다른 조건'})));assert.equal(p.pending.length,1);assert.equal(p.requirements.length,20);
});
test('malformed explicit selection is rejected before any adapter call',async()=>{
 const {analyzePrepared}=await import('../lib/agent/provider-interface.js');let calls=0;
 await assert.rejects(analyzePrepared({request:{...request('조건'),analysisContext:{selectedRole:'관리진단',applicantType:'invented'}},requirements:[{id:'r',sourceQuote:'조건'}],catalog:[],adapter:{analyze:()=>{calls++;}},enabled:true,ownerApproved:true}),{code:'INVALID_INPUT'});assert.equal(calls,0);
});
test('old applicant heading cannot override the nearest branch and forward scope quotes are rejected',async()=>{
 const posting=source('53349215'),quote=line('53349215',60);
 await assert.rejects(run(posting,quote,[unit(quote,{applicantType:'common',applicantQuote:'[공통]'})]),e=>e.validation.reason==='SEMANTIC_APPLICANT_SCOPE');
 await assert.rejects(run(posting,quote,[unit(quote,{applicantType:'new',applicantQuote:'[신입]'})]),e=>e.validation.reason==='SEMANTIC_SCOPE_QUOTE');
});
test('invented probabilities, guaranteed durations and labs replacing tenure are rejected',async()=>{
 const quote='상용 운영 경력 3년 이상';
 for(const action of ['합격 확률은 90%입니다.','3주 만에 취득할 수 있습니다.','실습으로 경력 기간을 충족합니다.'])await assert.rejects(run(quote,quote,[unit(quote)],{item:{actions:[action]}}),e=>e.validation.reason==='SEMANTIC_UNSUPPORTED_CLAIM');
});
test('fixed 50 sources preserve existing 458 conditions; offline audit reports its skipped case honestly',async()=>{
 const {audit}=await import('../scripts/audit-agent-semantics-50.mjs');
 const manifest=require('./fixtures/real-postings-smoke.json');
 assert.equal(corpus.length,50);assert.equal(new Set(corpus.map(x=>x.id)).size,50);
 assert.ok(manifest.every(x=>corpus.some(r=>r.url===x.url)));
 const result=await audit();assert.equal(result.externalCalls,0);assert.equal(result.liveNotExecuted,50);assert.equal(result.failed,0);assert.equal(result.contractPass,49);
 assert.equal(result.rows.reduce((n,r)=>n+r.ordinaryRequirements,0),458);
 assert.deepEqual(result.rows.filter(r=>r.status==='not-run-item-limit').map(r=>r.id),['50032590']);
 await assert.rejects(audit({live:true}),/LIVE_REQUIRES_APPROVED_RUNTIME/);
});
test('SDK schema requires semantic units without breaking the legacy contract',async()=>{
 const {schemaForRequest}=await import('../lib/agent/model-schema.js');const req=request('SQL 경험');
 const base={request:req,requirements:[{id:'r',sourceQuote:'SQL 경험'}],catalog:[]};
 assert.equal(schemaForRequest(base).properties.items.items.properties.semantics,undefined);
 const schema=schemaForRequest({...base,semantic:true});assert.ok(schema.properties.items.items.required.includes('semantics'));
 const {createSdkAdapter}=await import('../lib/agent/adapters/ai-sdk.js');const {analyzePrepared}=await import('../lib/agent/provider-interface.js');
 const value=response(req,'SQL 경험',[unit('SQL 경험')]);delete value.items[0].semantics;
 await assert.rejects(analyzePrepared({...base,enabled:true,ownerApproved:true,adapter:createSdkAdapter({model:{},run:async()=>({output:value})})}),e=>e.validation.reason==='SEMANTIC_FORMAT');
});
test('one physical source line does not permit quoting a different selected condition',async()=>{
 const {analyzePrepared}=await import('../lib/agent/provider-interface.js');
 const quote='SQL 경험',other='Python 경험',posting=quote+' / '+other,req=request(posting);
 const base={request:req,requirements:[{id:'r',sourceQuote:posting,conditionQuote:quote}],catalog:[],enabled:true,ownerApproved:true};
 const good=response(req,quote,[unit(quote)]);
 const result=await analyzePrepared({...base,adapter:{analyze:async()=>good}});
 assert.equal(result.items[0].semanticAnalysis.contextQuote,posting);assert.equal(result.items[0].semanticAnalysis.sourceQuote,quote);
 const wrong=response(req,other,[unit(other)]);
 await assert.rejects(analyzePrepared({...base,adapter:{analyze:async()=>wrong}}),e=>e.validation.reason==='POSTING_QUOTE');
 await assert.rejects(analyzePrepared({...base,requirements:[{id:'r',sourceQuote:posting,conditionQuote:'없는 문구'}],adapter:{analyze:async()=>good}}),{code:'INVALID_INPUT'});
});
test('53349215: glued examples and script/language preferences keep their distinct quotes',async()=>{
 const posting=source('53349215'),quote=line('53349215',57),parts=quote.split(' ㆍ');
 const {result}=await run(posting,quote,[unit(parts[0],{obligation:'preferred',applicantType:'common',applicantQuote:'[공통]'}),unit('ㆍ'+parts[1],{obligation:'preferred',applicantType:'common',applicantQuote:'[공통]',relation:'unclear'})]);
 assert.equal(result.items[0].semanticAnalysis.units.length,2);assert.equal(result.items[0].semanticAnalysis.units[1].locations[0].line,57);
 assert.match(result.items[0].semanticAnalysis.units[1].quote,/영어회화/);
});
test('explicit obligation wording cannot be reversed in AI metadata',async()=>{
 for(const [quote,obligation] of [['SQLD 보유자 우대','required'],['Linux 경험 필수','preferred'],['필수 우대','required']])await assert.rejects(run(quote,quote,[unit(quote,{obligation})]),e=>e.validation.reason==='SEMANTIC_OBLIGATION');
});
test('self-reported certificate possession suppresses reacquisition, while preparation is not possession',async()=>{
 const quote='SQLD 보유자 우대',catalog=[{id:'sqld',name:'SQLD'}],item={actions:['SQLD 취득을 준비하세요.'],certifications:[{id:'sqld',reason:'공고 명시',postingQuote:quote}]};
 const owned=await run(quote,quote,[unit(quote,{obligation:'preferred'})],{catalog,item,profile:{certs:'SQLD 보유 (2025년 취득)'}});
 assert.equal(owned.result.items[0].certifications.length,0);assert.equal(owned.result.items[0].actions.length,0);
 const planned=await run(quote,quote,[unit(quote,{obligation:'preferred'})],{catalog,item,profile:{certs:'SQLD 준비 예정'}});
 assert.equal(planned.result.items[0].certifications.length,1);
});
