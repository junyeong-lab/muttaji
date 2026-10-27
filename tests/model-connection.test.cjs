const test=require('node:test'),assert=require('node:assert/strict');
const token='local-test-code-12345';
const request=()=>({schemaVersion:1,revision:'test1',posting:'필수조건\n보안 로그 분석 경험',profile:{'goal-job':'보안','education':'','experience':'학습 프로젝트에서 로그 분석','certs':'','skills':''},source:{type:'manual'},consent:{externalAi:true}});
const requirements=[{id:'required-0',sourceQuote:'보안 로그 분석 경험'}];
const output=()=>({schemaVersion:1,revision:'test1',mode:'model-suggestion',needsHumanReview:true,items:[{id:'required-0',postingQuote:'보안 로그 분석 경험',interpretation:'보안 로그 분석 경험을 요구합니다.',taskType:'technical',keySkills:[],profileEvidence:[{field:'experience',quote:'학습 프로젝트에서 로그 분석'}],proposedStatus:'확인 필요',reason:'학습 경험은 관련되지만 실무 인정 범위는 다릅니다.',missing:[],actions:['분석한 로그와 본인의 역할을 정리하세요.'],certifications:[]}]});
const http=(body={request:request(),requirements},headers={})=>new Request('http://127.0.0.1:4173/api/model-analysis',{method:'POST',headers:{origin:'http://127.0.0.1:4173','content-type':'application/json','x-agent-access-code':token,...headers},body:JSON.stringify(body)});
test('local model stays disabled without all explicit settings, even with old credentials',async()=>{
 const {localModelSettings,createLocalAdapter}=await import('../lib/agent/local-model.js');
 for(const env of [{},{OPENAI_API_KEY:'not-a-real-key'},{MUTTAJI_AI_ENABLED:'true',OPENAI_API_KEY:'not-a-real-key'}]){assert.equal(Boolean(localModelSettings(env).enabled),false);assert.equal(createLocalAdapter(env),undefined);}
});
test('actual AI SDK processes schema output with a fake language model and no network',async()=>{
 const {MockLanguageModelV4}=await import('ai/test');const {createSdkAdapter}=await import('../lib/agent/adapters/ai-sdk.js');
 const {analyzePrepared}=await import('../lib/agent/provider-interface.js');
 const model=new MockLanguageModelV4({doGenerate:async()=>({content:[{type:'text',text:JSON.stringify(output())}],finishReason:{unified:'stop'},usage:{inputTokens:{total:10,noCache:10},outputTokens:{total:20,text:20}},warnings:[]})});
 const result=await analyzePrepared({request:request(),requirements,catalog:[],adapter:createSdkAdapter({model}),enabled:true,ownerApproved:true});
 assert.equal(result.items[0].proposedStatus,'확인 필요');assert.equal(model.doGenerateCalls.length,1);
});
test('SDK adapter disables retry and telemetry, sends data without source URL and honors signal',async()=>{
 const {createSdkAdapter}=await import('../lib/agent/adapters/ai-sdk.js');let options;
 const controller=new AbortController();
 await createSdkAdapter({model:{},run:async o=>{options=o;return {output:output()};},providerOptions:{openai:{store:false}}}).analyze({request:request(),requirements,catalog:[],instructions:['untrusted data']},{signal:controller.signal});
 assert.equal(options.maxRetries,0);assert.equal(options.maxOutputTokens,4096);assert.equal(options.experimental_telemetry.isEnabled,false);assert.equal(options.providerOptions.openai.store,false);assert.equal(options.abortSignal,controller.signal);assert.equal(JSON.parse(options.prompt).source,undefined);
});
test('auth, consent, imported review and invalid input prevent model calls',async()=>{
 const {createModelHandler}=await import('../lib/agent/model-api.js');let calls=0;
 const handler=createModelHandler({config:()=>({enabled:true,token,model:'test-model'}),adapter:{analyze:async()=>{calls++;return output();}}});
 assert.equal((await handler(http(undefined,{'x-agent-access-code':'wrong'}))).status,403);
 assert.equal((await handler(http(undefined,{origin:'https://untrusted.example'}))).status,403);
 const body={request:request(),requirements};body.request.consent.externalAi=false;assert.equal((await handler(http(body))).status,400);
 body.request=request();body.request.source={type:'url',url:'https://public.example/job',reviewed:false};assert.equal((await handler(http(body))).status,400);
 assert.equal(calls,0);
});
test('local test counts successes and failures and never exceeds the call cap',async()=>{
 const {createModelHandler}=await import('../lib/agent/model-api.js');let calls=0;
 const handler=createModelHandler({config:()=>({enabled:true,token,model:'test'}),maxCalls:1,adapter:{analyze:async()=>{calls++;throw Error('secret provider detail');}}});
 const first=await handler(http());assert.equal(first.status,502);assert.doesNotMatch(await first.text(),/secret/);
 assert.equal((await handler(http())).status,429);assert.equal(calls,1);
});
test('invented evidence is rejected instead of rendered',async()=>{
 const {createModelHandler}=await import('../lib/agent/model-api.js');const fake=output();fake.items[0].profileEvidence[0].quote='invented professional history';
 const handler=createModelHandler({config:()=>({enabled:true,token,model:'test'}),adapter:{analyze:async()=>fake}});
 const response=await handler(http());assert.equal(response.status,502);const payload=await response.json();assert.equal(payload.error,'INVALID_AGENT_OUTPUT');assert.deepEqual(payload.validation,{reason:'PROFILE_QUOTE',itemIndex:0});
});
test('only one concurrent model call is allowed',async()=>{
 const {createModelHandler}=await import('../lib/agent/model-api.js');let finish,started;const signal=new Promise(r=>started=r);
 const handler=createModelHandler({config:()=>({enabled:true,token,model:'test'}),adapter:{analyze:()=>{started();return new Promise(r=>finish=r);}}});
 const first=handler(http());await signal;assert.equal((await handler(http())).status,429);finish(output());assert.equal((await first).status,200);
});
