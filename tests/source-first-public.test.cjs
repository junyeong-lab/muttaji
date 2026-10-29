const test=require('node:test'),assert=require('node:assert/strict');
const record=require('./fixtures/source-first-cases.json').records[0];
const env={VERCEL:'1',MUTTAJI_PUBLIC_ENABLED:'true',MUTTAJI_PUBLIC_OWNER_APPROVED:'true',MUTTAJI_PUBLIC_URL_ENABLED:'true',MUTTAJI_PUBLIC_ORIGIN:'https://app.example',MUTTAJI_SESSION_SECRET:'s'.repeat(40),OPENAI_API_KEY:'fake-test-key',MUTTAJI_AI_MODEL:'gpt-5.6-terra'};
const body=()=>({task:'classify-posting',request:{schemaVersion:1,revision:record.expected.revision,posting:record.posting,source:{type:'manual'},consent:{externalAi:true}}});
async function auth(runtime){const r=await runtime.session(new Request('https://app.example/api/session'));return {cookie:r.headers.get('set-cookie').split(';')[0],'x-muttaji-csrf':(await r.json()).csrfToken};}
const post=(headers,value=body())=>new Request('https://app.example/api/model-analysis',{method:'POST',headers:{origin:'https://app.example','content-type':'application/json','x-vercel-forwarded-for':'8.8.8.8',...headers},body:JSON.stringify(value)});
test('raw classification passes real SDK/fake HTTP behind existing session, CSRF and shared reservation',async()=>{
 const {createPublicRuntime}=await import('../lib/public/runtime.js');let reserved=0,calls=0;
 const runtime=createPublicRuntime(env,{quota:{scope:'shared',reserve:async()=>{reserved++;return 'ALLOWED';}},fetchImpl:async(url,options)=>{
  calls++;assert.equal(reserved,1);assert.equal(url,'https://api.openai.com/v1/responses');const sent=JSON.parse(options.body);assert.equal(sent.store,false);assert.equal(sent.max_output_tokens,4096);assert.equal(sent.text.format.schema.properties.mode.enum[0],'posting-classification');
  return new Response(JSON.stringify({id:'fake',object:'response',created_at:1700000000,status:'completed',model:env.MUTTAJI_AI_MODEL,output:[{id:'fake-message',type:'message',role:'assistant',status:'completed',content:[{type:'output_text',text:JSON.stringify(record.expected),annotations:[]}]}],usage:{input_tokens:10,output_tokens:20,total_tokens:30}}),{headers:{'content-type':'application/json'}});
 }});
 assert.equal((await runtime.model(post({}))).status,403);assert.equal(reserved,0);
 const headers=await auth(runtime),noConsent=body();noConsent.request.consent.externalAi=false;
 assert.equal((await runtime.model(post(headers,noConsent))).status,400);assert.equal(reserved,0);
 const r=await runtime.model(post(headers));assert.equal(r.status,200,await r.clone().text());const data=(await r.json()).data;assert.equal(data.approvalRequired,true);assert.equal(data.items.filter(x=>x.category==='preferred').length,6);assert.equal(calls,1);
});
test('exhausted shared budget blocks source-first provider; no private error details escape',async()=>{
 const {createPublicRuntime}=await import('../lib/public/runtime.js');let calls=0;
 const runtime=createPublicRuntime(env,{quota:{scope:'shared',reserve:async()=> 'BUDGET_EXHAUSTED'},adapter:{classify:async()=>{calls++;throw Error('PRIVATE_PROVIDER_DETAIL');}}});
 const response=await runtime.model(post(await auth(runtime)));assert.equal(response.status,429);assert.equal((await response.json()).error,'BUDGET_EXHAUSTED');assert.equal(calls,0);
 const broken=createPublicRuntime(env,{quota:{scope:'shared',reserve:async()=> 'ALLOWED'},adapter:{classify:async()=>{calls++;throw Error('PRIVATE_PROVIDER_DETAIL');}}});
 const bad=await broken.model(post(await auth(broken)));assert.equal(bad.status,502);assert.doesNotMatch(await bad.text(),/PRIVATE_PROVIDER_DETAIL/);assert.equal(calls,1);
});
test('truncated raw classification fails as output limit without retry',async()=>{
 const {MockLanguageModelV4}=await import('ai/test'),{createSdkAdapter}=await import('../lib/agent/adapters/ai-sdk.js'),{classifyPosting}=await import('../lib/agent/posting-classifier.js');
 const model=new MockLanguageModelV4({doGenerate:async()=>({content:[{type:'text',text:'{"items":['}],finishReason:{unified:'length'},usage:{inputTokens:{total:10},outputTokens:{total:4096}},warnings:[]})});
 await assert.rejects(classifyPosting({request:body().request,adapter:createSdkAdapter({model}),enabled:true,ownerApproved:true}),{code:'PROVIDER_OUTPUT_LIMIT'});assert.equal(model.doGenerateCalls.length,1);
});


test('model diagnostics contain only allowlisted machine codes and counts, not source data',async()=>{
 const {safeModelDiagnostic}=await import('../lib/public/handler.js');
 const {AgentError}=await import('../lib/agent/contracts.js');
 const problem=new AgentError('INVALID_AGENT_OUTPUT',502);
 problem.validation={reason:'POSTING_COVERAGE',missingLines:[7,11,14],itemIndex:2,posting:'PRIVATE_POSTING',apiKey:'PRIVATE_KEY'};
 assert.deepEqual(safeModelDiagnostic(problem),{code:'INVALID_AGENT_OUTPUT',reason:'POSTING_COVERAGE',itemIndex:2,missingLineCount:3});
 assert.doesNotMatch(JSON.stringify(safeModelDiagnostic(problem)),/PRIVATE_POSTING|PRIVATE_KEY/);
 assert.equal(safeModelDiagnostic(new Error('PRIVATE_PROVIDER_DETAIL')),null);
 const other=new AgentError('PROVIDER_OUTPUT_INVALID',502);
 assert.deepEqual(safeModelDiagnostic(other),{code:'PROVIDER_OUTPUT_INVALID'});
});
test('classification prompt checks nonoverlapping full source coverage before returning',async()=>{
 const {POSTING_INSTRUCTIONS}=await import('../lib/agent/posting-schema.js');
 const guidance=POSTING_INSTRUCTIONS.join(' ');
 assert.match(guidance,/checking every numbered nonempty source line/);
 assert.match(guidance,/must not overlap/);
 assert.match(guidance,/Do not use references to conceal unexamined qualifications/);
});
