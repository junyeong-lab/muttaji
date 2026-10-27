const test=require('node:test'),assert=require('node:assert/strict'),load=require('./load-browser-module.cjs');
const parser=load('../assets/job-text-analyzer.js'),comparison=load('../assets/requirement-comparison.js'),engine=load('../assets/experience-explanations.js');
const posting='필수조건\n정보보안 및 개인정보보호 컨설턴트 채용 경력\n( ○명 )\nㆍ학력 : 대졸이상 (졸업예정자 가능)\nㆍ경력 : 신입·경력1년↑\n우대사항\nㆍ유관업무 경험자(인턴·알바)\nㆍ문서작성 우수자\nㆍ석사학위 수여자\nㆍ박사학위 수여자\nㆍ자격증 : CISA, CISSP, 정보보안기사';
const profile={education:'해양대학교 기관공학 전공',experience:'사이버보안 점검 수행\n기관평가 준비 및 대응\n월간 위협 분석 자료 작성\n문서 작성 및 보고',certs:'정보처리기사\n네트워크관리사 2급'};
test('job title and headcount leave eligibility and retain source positions',()=>{
 const parsed=parser.analyze(posting);assert.equal(parsed.role.some(x=>/컨설턴트 채용/.test(x.text)),true);assert.equal(parsed.unresolved.some(x=>/○명/.test(x.text)),true);
 const rows=comparison.requirements(posting,parser);assert.equal(rows.length,7);assert.equal(rows.some(x=>/○명|컨설턴트 채용/.test(x.text)),false);assert.equal(rows[0].line,4);
 assert.equal(parser.nonRequirementKind('경력 3년 이상'),null);assert.equal(parser.nonRequirementKind('2명과 협업한 경험'),null);
 const reviewed={text:posting,result:parsed};reviewed.result.required.push({text:'( ○명 )',line:3});assert.equal(comparison.requirements(posting,parser,reviewed).length,7);
});
test('related duties and writing link real evidence, degrees and unrelated certificates do not',()=>{
 const requirements=comparison.requirements(posting,parser);const result=engine.buildAnalysis({posting,requirements,profile,certificateMatcher:comparison.certificateMatches});
 const find=term=>result.explanations.find(x=>x.postingEvidence.quote.includes(term));
 assert.ok(find('유관업무').inputEvidence.some(x=>/점검|기관평가/.test(x.quote)));
 assert.ok(find('문서작성').inputEvidence.some(x=>/자료 작성|문서 작성/.test(x.quote)));
 for(const term of ['석사','박사','자격증'])assert.equal(find(term).inputEvidence.length,0);
 assert.equal(comparison.certificateMatches('정보보안기사 보유','정보처리기사'),false);
 assert.equal(comparison.certificateMatches('SQLD 보유','SQLDP'),false);
 assert.equal(comparison.certificateMatches('정보보안기사 보유','정보보안기사'),true);
 assert.equal(result.explanations.some(x=>'status' in x),false);
});
test('explicit higher degree references can link but never assert graduation',()=>{
 const requirements=comparison.requirements(posting,parser);const result=engine.buildAnalysis({posting,requirements,profile:{education:'정보보호 석사 재학'},certificateMatcher:comparison.certificateMatches});
 const masters=result.explanations.find(x=>x.topic==='masters');assert.equal(masters.inputEvidence.length,1);assert.match(masters.explanation,/자동 확정하지/);
 assert.equal(result.explanations.find(x=>x.topic==='doctorate').inputEvidence.length,0);
});
test('missing certificate information cannot become model non-possession, while explicit absence remains',async()=>{
 const {applySuggestionPolicy}=await import('../lib/agent/provider-interface.js');
 const requirements=[{id:'r',sourceQuote:'정보보안기사 보유'}],catalog=[{id:'1',name:'정보보안기사'}];
 const value={items:[{id:'r',proposedStatus:'미충족',reason:'없는 것으로 판단',profileEvidence:[{field:'certs',quote:'정보처리기사'}]}]};
 const options={request:{profile:{certs:'정보처리기사'}},requirements,catalog};
 assert.equal(applySuggestionPolicy(value,options).items[0].proposedStatus,'확인 필요');assert.equal(value.items[0].proposedStatus,'미충족');
 options.request.profile.certs='정보보안기사는 없습니다.';assert.equal(applySuggestionPolicy(value,options).items[0].proposedStatus,'미충족');
});

test('degree guidance focuses on graduation and unrelated employment examples are omitted',()=>{
 const extra=posting+'\nㆍ유관업무 경력자';
 const rows=comparison.requirements(extra,parser);
 const result=engine.buildAnalysis({posting:extra,requirements:rows,profile,certificateMatcher:comparison.certificateMatches});
 const find=term=>result.explanations.find(x=>x.postingEvidence.quote.includes(term));
 assert.equal(find('학력').topic,'degree');assert.match(find('학력').nextAction,/졸업/);assert.doesNotMatch(find('학력').nextAction,/전공에서 배운/);
 assert.match(find('유관업무 경험자').explanation,/인턴·알바/);assert.doesNotMatch(find('유관업무 경력자').explanation,/인턴·알바/);
});

test('entry route alone does not become fulfillment; internship examples are not additional gaps',async()=>{
 const {applySuggestionPolicy}=await import('../lib/agent/provider-interface.js');
 const value={items:[{id:'career',proposedStatus:'충족',reason:'신입 경로로 지원할 수 있습니다.'},{id:'related',proposedStatus:'부분 충족',reason:'인턴 경험 없음',interpretation:'인턴 필수',missing:['인턴·알바 형태의 경험 여부','수행 업무의 구체적 결과'],actions:['인턴 경험 여부를 확인하세요.','업무 결과를 정리하세요.']}]};
 const options={request:{profile:{certs:''}},requirements:[{id:'career',sourceQuote:'ㆍ경력 : 신입·경력1년↑'},{id:'related',sourceQuote:'ㆍ유관업무 경험자(인턴·알바)'}],catalog:[]};
 const result=applySuggestionPolicy(value,options);assert.equal(result.items[0].proposedStatus,'확인 필요');assert.match(result.items[0].reason,/신입 지원이 가능/);
 assert.deepEqual(result.items[1].missing,['수행 업무의 구체적 결과']);assert.deepEqual(result.items[1].actions,['업무 결과를 정리하세요.']);assert.equal(value.items[0].proposedStatus,'충족');
 options.requirements[1].sourceQuote='인턴 경력 필수';assert.equal(applySuggestionPolicy(value,options).items[1].interpretation,'인턴 필수');
});

test('technical projects cannot substitute for an explicitly named major',async()=>{
 const {applySuggestionPolicy}=await import('../lib/agent/suggestion-policy.js');
 const item={id:'major',proposedStatus:'부분 충족',reason:'다른 공학 전공이나 실습 경험이 있습니다.',profileEvidence:[{field:'education',quote:'기관공학 전공'},{field:'skills',quote:'보안 로그 실습'}],missing:[],actions:[]};
 const options={request:{posting:'전공 : 산업공학과, 정보통신공학과, 컴퓨터공학과',profile:{education:'기관공학 전공',certs:''}},requirements:[{id:'major',sourceQuote:'전공 : 산업공학과, 정보통신공학과, 컴퓨터공학과'}],catalog:[]};
 const result=applySuggestionPolicy({items:[item]},options).items[0];assert.equal(result.proposedStatus,'확인 필요');assert.equal(result.profileEvidence.length,1);assert.ok(result.preparationSuggestions.length);assert.equal(item.proposedStatus,'부분 충족');
 options.request.profile.education='컴퓨터공학 전공';assert.equal(applySuggestionPolicy({items:[item]},options).items[0].proposedStatus,'부분 충족');
 options.requirements[0].sourceQuote='전공 : 관련 공학 계열';assert.equal(applySuggestionPolicy({items:[item]},options).items[0].proposedStatus,'부분 충족');
});
test('unrequested private-sector deliverables become optional advice but explicit requirements remain',async()=>{
 const {applySuggestionPolicy}=await import('../lib/agent/suggestion-policy.js');
 const value={items:[{id:'work',proposedStatus:'부분 충족',reason:'민간 컨설팅 산출물 경험이 없습니다.',missing:['민간 컨설팅 산출물 경험','점검 수행 결과'],actions:[]}]};
 const options={request:{posting:'유관업무 경력자',profile:{certs:''}},requirements:[{id:'work',sourceQuote:'유관업무 경력자'}],catalog:[]};
 const result=applySuggestionPolicy(value,options).items[0];assert.deepEqual(result.missing,['점검 수행 결과']);assert.match(result.preparationSuggestions[0],/참고/);assert.doesNotMatch(result.reason,/경험이 없습니다/);
 options.request.posting+='\n민간 컨설팅 산출물 작성 경험 필수';assert.deepEqual(applySuggestionPolicy(value,options).items[0].missing,value.items[0].missing);
});
test('explicit entry route removes redundant inquiry but preserves career-recognition question',async()=>{
 const {applySuggestionPolicy}=await import('../lib/agent/suggestion-policy.js');
 const value={items:[{id:'career',proposedStatus:'부분 충족',reason:'관련 업무',missing:[],actions:['신입 및 경력 경로의 지원 가능 여부를 확인하세요.','경력 인정 기준을 문의하세요.','업무 결과를 정리하세요.']}]};
 const options={request:{posting:'경력 : 신입·경력1년↑',profile:{certs:''}},requirements:[{id:'career',sourceQuote:'경력 : 신입·경력1년↑'}],catalog:[]};
 assert.deepEqual(applySuggestionPolicy(value,options).items[0].actions,['경력 인정 기준을 문의하세요.','업무 결과를 정리하세요.']);
});
