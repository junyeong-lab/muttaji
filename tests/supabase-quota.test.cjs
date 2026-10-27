const test=require('node:test'),assert=require('node:assert/strict');
const secret='sb_secret_fake_local_test_only_12345';
test('Supabase quota sends only hashed identity and namespace to a fixed RPC with server secret',async()=>{
 const {createSupabaseQuota}=await import('../lib/public/supabase-quota.js');let call;
 const quota=createSupabaseQuota({url:'https://test.supabase.co',secret,fetchImpl:async(url,options)=>{call={url,options};return new Response(JSON.stringify('ALLOWED'));}});
 assert.equal(await quota.reserve({kind:'model',subject:'a'.repeat(30),session:'b'.repeat(48)}),'ALLOWED');
 assert.equal(String(call.url),'https://test.supabase.co/rest/v1/rpc/muttaji_reserve_quota');assert.equal(call.options.headers.apikey,secret);assert.equal(call.options.headers.authorization,undefined);
 assert.deepEqual(JSON.parse(call.options.body),{p_namespace:'release1',p_kind:'model',p_subject:'a'.repeat(30),p_session:'b'.repeat(48)});assert.equal(call.options.redirect,'error');
});
test('Supabase quota refuses publishable keys, invalid hosts, unknown responses and network failures',async()=>{
 const {createSupabaseQuota}=await import('../lib/public/supabase-quota.js');
 for(const url of ['http://test.supabase.co','https://evil.example','https://test.supabase.co/path'])assert.throws(()=>createSupabaseQuota({url,secret}));
 assert.throws(()=>createSupabaseQuota({url:'https://test.supabase.co',secret:'sb_publishable_not_a_server_key'}));
 const anon='x.'+Buffer.from(JSON.stringify({role:'anon'})).toString('base64url')+'.signature';assert.throws(()=>createSupabaseQuota({url:'https://test.supabase.co',secret:anon}));
 for(const fetchImpl of [async()=>new Response('error',{status:503}),async()=>new Response(JSON.stringify('UNKNOWN')),async()=>{throw Error('private secret response');}]){
 const quota=createSupabaseQuota({url:'https://test.supabase.co',secret,fetchImpl});await assert.rejects(quota.reserve({kind:'url',subject:'a'.repeat(30),session:'b'.repeat(48)}));
 }
});
test('Supabase deployment mode uses shared RPC; disabled budget prevents model generation',async()=>{
 const {createPublicRuntime}=await import('../lib/public/runtime.js');let calls=0;
 const env={VERCEL:'1',MUTTAJI_PUBLIC_ENABLED:'true',MUTTAJI_PUBLIC_OWNER_APPROVED:'true',MUTTAJI_PUBLIC_ORIGIN:'https://app.example',MUTTAJI_SESSION_SECRET:'s'.repeat(40),OPENAI_API_KEY:'fake',MUTTAJI_AI_MODEL:'gpt-5.6-terra',MUTTAJI_QUOTA_PROVIDER:'supabase',MUTTAJI_SUPABASE_URL:'https://test.supabase.co',MUTTAJI_SUPABASE_SECRET_KEY:secret};
 const runtime=createPublicRuntime(env,{fetchImpl:async(url)=>{calls++;assert.match(String(url),/supabase.co\/rest\/v1\/rpc/);return new Response(JSON.stringify('NOT_INITIALIZED'));},adapter:{analyze:()=>{throw Error('must not generate');}}});
 const start=await runtime.session(new Request('https://app.example/api/session'));const csrf=(await start.json()).csrfToken;
 const request={schemaVersion:1,revision:'test',posting:'보안 점검 경험',profile:{'goal-job':'',education:'',experience:'보안 점검 경험',certs:'',skills:''},source:{type:'manual'},consent:{externalAi:true}};
 const response=await runtime.model(new Request('https://app.example/api/model-analysis',{method:'POST',headers:{origin:'https://app.example','x-vercel-forwarded-for':'8.8.8.8',cookie:start.headers.get('set-cookie').split(';')[0],'x-muttaji-csrf':csrf,'content-type':'application/json'},body:JSON.stringify({request,requirements:[{id:'r',sourceQuote:request.posting}]})}));
 assert.equal(response.status,503);assert.equal((await response.json()).error,'NOT_INITIALIZED');assert.equal(calls,1);
});

test('safe connection diagnostics distinguish HTTP authentication and network failures',async()=>{
 const {createSupabaseQuota}=await import('../lib/public/supabase-quota.js');
 for(const [status,diagnostic] of [[401,'SUPABASE_AUTH_FAILED'],[403,'SUPABASE_PERMISSION_DENIED'],[404,'SUPABASE_RPC_NOT_FOUND'],[429,'SUPABASE_RATE_LIMITED']]){
 const quota=createSupabaseQuota({url:'https://test.supabase.co',secret,fetchImpl:async()=>new Response('PRIVATE_UPSTREAM_BODY',{status})});
 await assert.rejects(quota.reserve({kind:'model',subject:'a'.repeat(30),session:'b'.repeat(48)}),e=>{assert.equal(e.diagnostic,diagnostic);assert.doesNotMatch(e.message,/PRIVATE/);return true;});
 }
});
