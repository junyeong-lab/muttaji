const test=require('node:test'),assert=require('node:assert/strict');
const {lua,lauxlib,lualib,to_luastring,to_jsstring}=require('fengari');
function luaRedis(state){
 return function evalScript(script,keys,args){
  const L=lauxlib.luaL_newstate();lualib.luaL_openlibs(L);
  function array(name,items){lua.lua_newtable(L);items.forEach((value,index)=>{lua.lua_pushstring(L,to_luastring(String(value)));lua.lua_rawseti(L,-2,index+1);});lua.lua_setglobal(L,to_luastring(name));}
  array('KEYS',keys);array('ARGV',args);lua.lua_newtable(L);
  lua.lua_pushjsfunction(L,L=>{const command=to_jsstring(lua.lua_tostring(L,1));const key=to_jsstring(lua.lua_tostring(L,2));let value;
   if(command==='GET')value=state.get(key);
   else if(command==='INCR'||command==='INCRBY'){value=Number(state.get(key)||0)+(command==='INCR'?1:Number(to_jsstring(lua.lua_tostring(L,3))));state.set(key,String(value));}
   else if(command==='EXPIRE')value=1;else throw Error('unexpected redis command');
   if(value===undefined)lua.lua_pushnil(L);else lua.lua_pushstring(L,to_luastring(String(value)));return 1;
  });lua.lua_setfield(L,-2,to_luastring('call'));lua.lua_setglobal(L,to_luastring('redis'));
  if(lauxlib.luaL_loadstring(L,to_luastring(script))!==lua.LUA_OK||lua.lua_pcall(L,0,1,0)!==lua.LUA_OK)throw Error(to_jsstring(lua.lua_tostring(L,-1)));
  const result=to_jsstring(lua.lua_tostring(L,-1));lua.lua_close(L);return result;
 };
}
function quotaSetup(budget=1000000,total=10){
 const state=new Map([['muttaji:{release1}:ready','ready-v1'],['muttaji:{release1}:reserved','0'],['muttaji:{release1}:model:total','0'],['muttaji:{release1}:url:total','0']]);const run=luaRedis(state),calls=[];
 return {state,calls,options:{url:'https://fake.upstash.io',token:'fake-store-token',budgetMicros:budget,totalRequests:total,clock:()=>1700000000000,fetchImpl:async(url,options)=>{calls.push({url,options});const command=JSON.parse(options.body);return new Response(JSON.stringify({result:run(command[1],command.slice(3,3+command[2]),command.slice(3+command[2]))}));}}};
}
test('real quota Lua atomically caps parallel calls and survives handler recreation',async()=>{
 const {createSharedQuota}=await import('../lib/public/quota.js');const setup=quotaSetup();
 const quotas=Array.from({length:10},()=>createSharedQuota(setup.options));
 const responses=await Promise.all(quotas.map((q,i)=>q.reserve({kind:'model',subject:('subject-'+i).padEnd(30,'x'),session:i.toString(16).padStart(48,'0')})));
 assert.equal(responses.filter(x=>x==='ALLOWED').length,4);assert.equal(setup.state.get('muttaji:{release1}:reserved'),'1000000');
 const fresh=createSharedQuota(setup.options);assert.equal(await fresh.reserve({kind:'model',subject:'fresh'.padEnd(30,'x'),session:'f'.repeat(48)}),'BUDGET_EXHAUSTED');
 assert.ok(setup.calls.every(x=>x.options.redirect==='error'));assert.doesNotMatch(JSON.stringify(setup.calls.map(x=>JSON.parse(x.options.body))),/공고|개인정보/);
});
test('real quota Lua enforces identity, total limits and missing-state fail-closed',async()=>{
 const {createSharedQuota}=await import('../lib/public/quota.js');const setup=quotaSetup(5000000,10),quota=createSharedQuota(setup.options);
 const identity={kind:'model',subject:'a'.repeat(30),session:'a'.repeat(48)};
 for(let i=0;i<3;i++)assert.equal(await quota.reserve(identity),'ALLOWED');assert.equal(await quota.reserve(identity),'RATE_LIMITED');
 setup.state.delete('muttaji:{release1}:reserved');assert.equal(await quota.reserve(identity),'NOT_INITIALIZED');
 const limited=quotaSetup(5000000,1),q=createSharedQuota(limited.options);assert.equal(await q.reserve(identity),'ALLOWED');assert.equal(await q.reserve({...identity,subject:'b'.repeat(30),session:'b'.repeat(48)}),'TOTAL_LIMIT_REACHED');
});
test('sessions require signed unexpired cookie and CSRF; client identity is hashed',async()=>{
 const {createSessions}=await import('../lib/public/session.js');let now=1700000000000;const sessions=createSessions({secret:'s'.repeat(40),clock:()=>now});
 const bootstrap=sessions.establish(new Request('https://app.example'));
 assert.match(bootstrap.cookie,/Secure; HttpOnly; SameSite=Strict/);
 const headers={cookie:bootstrap.cookie.split(';')[0],'x-muttaji-csrf':bootstrap.csrfToken,'x-vercel-forwarded-for':'8.8.8.8'};
 const req=new Request('https://app.example',{headers});assert.ok(sessions.authorize(req));assert.doesNotMatch(sessions.subject(req),/8\.8\.8\.8/);
 assert.equal(sessions.authorize(new Request('https://app.example',{headers:{...headers,'x-muttaji-csrf':'wrong'}})),null);
 now+=86400001;assert.equal(sessions.authorize(req),null);
});
const request={schemaVersion:1,revision:'public-test',posting:'필수조건\n보안 로그 분석 경험',profile:{'goal-job':'','education':'','experience':'학습 프로젝트에서 로그 분석','certs':'','skills':''},source:{type:'manual'},consent:{externalAi:true}};
const requirements=[{id:'r',sourceQuote:'보안 로그 분석 경험'}];
const output={schemaVersion:1,revision:'public-test',mode:'model-suggestion',needsHumanReview:true,items:[{id:'r',postingQuote:'보안 로그 분석 경험',interpretation:'로그 분석 경험 요건',taskType:'technical',keySkills:[],profileEvidence:[{field:'experience',quote:'학습 프로젝트에서 로그 분석'}],proposedStatus:'확인 필요',reason:'학습 경험과 관련됨',missing:[],actions:[],certifications:[]}]};
output.items[0].semantics={units:[{quote:'보안 로그 분석 경험',obligation:'required',roleScope:'unclear',roleQuote:'',applicantType:'unclear',applicantQuote:'',relation:'start'}],uncertainties:[]};
const env={VERCEL:'1',MUTTAJI_PUBLIC_ENABLED:'true',MUTTAJI_PUBLIC_OWNER_APPROVED:'true',MUTTAJI_PUBLIC_URL_ENABLED:'true',MUTTAJI_PUBLIC_ORIGIN:'https://app.example',MUTTAJI_SESSION_SECRET:'s'.repeat(40),OPENAI_API_KEY:'fake-test-key',MUTTAJI_AI_MODEL:'gpt-5.6-terra'};
async function session(runtime){const response=await runtime.session(new Request('https://app.example/api/session'));return {cookie:response.headers.get('set-cookie').split(';')[0],csrf:(await response.json()).csrfToken};}
function post(auth,body={request,requirements},extra={}){return new Request('https://app.example/api/model-analysis',{method:'POST',headers:{origin:'https://app.example',cookie:auth.cookie,'x-muttaji-csrf':auth.csrf,'x-vercel-forwarded-for':'8.8.8.8','content-type':'application/json',...extra},body:JSON.stringify(body)});}
test('public endpoint uses real SDK with fake HTTP and reserves quota before any generation',async()=>{
 const {createPublicRuntime}=await import('../lib/public/runtime.js');let reserved=0,upstream=0;
 const runtime=createPublicRuntime(env,{quota:{scope:'shared',reserve:async()=>{reserved++;return 'ALLOWED';}},fetchImpl:async(url,options)=>{
  upstream++;assert.equal(reserved,1);assert.equal(url,'https://api.openai.com/v1/responses');const sent=JSON.parse(options.body);assert.equal(sent.store,false);assert.equal(sent.max_output_tokens,4096);
  return new Response(JSON.stringify({id:'fake-response',object:'response',created_at:1700000000,status:'completed',model:'gpt-5.6-terra',output:[{id:'fake-message',type:'message',role:'assistant',status:'completed',content:[{type:'output_text',text:JSON.stringify(output),annotations:[]}]}],usage:{input_tokens:10,output_tokens:20,total_tokens:30}}),{headers:{'content-type':'application/json'}});
 }});
 const auth=await session(runtime);const response=await runtime.model(post(auth));assert.equal(response.status,200,await response.clone().text());assert.equal(upstream,1);assert.equal((await response.json()).data.items[0].proposedStatus,'확인 필요');
});
test('public consent, origin, session and exhausted budget stop model calls',async()=>{
 const {createPublicRuntime}=await import('../lib/public/runtime.js');let reserved=0,generated=0;
 const runtime=createPublicRuntime(env,{quota:{scope:'shared',reserve:async()=>{reserved++;return 'BUDGET_EXHAUSTED';}},adapter:{analyze:async()=>{generated++;return output;}}});
 const auth=await session(runtime);
 assert.equal((await runtime.model(post(auth,undefined,{origin:'https://evil.example'}))).status,403);
 assert.equal((await runtime.model(post({...auth,csrf:'bad'}))).status,403);
 const body={request:{...request,consent:{externalAi:false}},requirements};assert.equal((await runtime.model(post(auth,body))).status,400);assert.equal(reserved,0);
 const response=await runtime.model(post(auth));assert.equal(response.status,429);assert.equal((await response.json()).error,'BUDGET_EXHAUSTED');assert.equal(generated,0);assert.equal(reserved,1);
});
test('disabled deployment, unapproved model and storage failure cannot generate or leak errors',async()=>{
 const {createPublicRuntime,cappedOpenAiFetch}=await import('../lib/public/runtime.js');
 const disabled=createPublicRuntime({});assert.equal((await (await disabled.model(new Request('https://app.example'))).json()).enabled,false);
 const fail=createPublicRuntime(env,{quota:{scope:'shared',reserve:async()=>{throw Error('private-store-secret');}},adapter:{analyze:async()=>{throw Error('must not run');}}});
 const auth=await session(fail);const response=await fail.model(post(auth));assert.equal(response.status,503);assert.doesNotMatch(await response.text(),/private-store-secret/);
 await assert.rejects(cappedOpenAiFetch(()=>{throw Error('must not fetch');})('https://other.example',{method:'POST',body:'{}'}));
});

test('public URL gate preserves import errors and rejects invalid URLs before quota',async()=>{
 const {createPublicHandler}=await import('../lib/public/handler.js');const {createSessions}=await import('../lib/public/session.js');const {ImportError}=await import('../lib/job-url/errors.js');let reserved=0;
 const sessions=createSessions({secret:'s'.repeat(40)}),cookie=sessions.establish(new Request('https://app.example'));const auth={cookie:cookie.cookie.split(';')[0],csrf:cookie.csrfToken};
 const handler=createPublicHandler({kind:'url',settings:{enabled:true,origin:'https://app.example'},sessions,quota:{scope:'shared',reserve:async()=>{reserved++;return 'ALLOWED';}},importer:async()=>{throw new ImportError('IMAGE_POSTING');}});
 const invalid=await handler(post(auth,{url:'http://127.0.0.1'}));assert.equal(invalid.status,400);assert.equal((await invalid.json()).error,"UNSAFE_URL");assert.equal(reserved,0);
 const response=await handler(post(auth,{url:'https://jobs.example.org/job'}));assert.equal((await response.json()).error,'IMAGE_POSTING');assert.equal(reserved,1);
});
test('shared browser session initialization is reused by parallel features',async()=>{
 const vm=require('node:vm'),fs=require('node:fs');let calls=0;const window={};
 vm.runInNewContext(fs.readFileSync(require('node:path').join(__dirname,'../assets/session-client.js'),'utf8'),{window,fetch:async()=>{calls++;return new Response(JSON.stringify({enabled:true,csrfToken:'fake-token'}));}});
 const tokens=await Promise.all([window.MuttajiSession.get(),window.MuttajiSession.get()]);assert.equal(calls,1);assert.deepEqual(tokens,['fake-token','fake-token']);
});

test('public URL endpoint distinguishes burst throttling from daily usage limits',async()=>{
 const {createPublicHandler}=await import('../lib/public/handler.js');
 const {createSessions}=await import('../lib/public/session.js');
 const sessions=createSessions({secret:'s'.repeat(40)});
 const bootstrap=sessions.establish(new Request('https://app.example'));
 const handler=createPublicHandler({
  kind:'url',settings:{enabled:true,origin:'https://app.example'},sessions,
  quota:{scope:'shared',reserve:async()=> 'RATE_LIMITED'},
  importer:async()=>{throw Error('must not import after rate limit');}
 });
 const auth={cookie:bootstrap.cookie.split(';')[0],csrf:bootstrap.csrfToken};
 const res=await handler(post(auth,{url:'https://jobs.example.org/job'}));
 assert.equal(res.status,429);
 const data=await res.json();
 assert.equal(data.error,'RATE_LIMITED');assert.match(data.message,/1분 후/);
});
test('URL unlimited migration retains burst limit, model cost guard and authenticated service role',()=>{
 const fs=require('node:fs'),path=require('node:path');
 const sql=fs.readFileSync(path.join(__dirname,'../db/migrations/20261028_unlimited_url_with_burst_guard.sql'),'utf8');
 assert.match(sql,/if p_kind='url' then/);
 assert.match(sql,/ip_count>=20 or session_count>=20/);
 assert.match(sql,/return 'ALLOWED'/);
 assert.match(sql,/if not state.enabled then return 'NOT_INITIALIZED'/);
 assert.match(sql,/reserved_micros\s*\+\s*charge\s*>\s*state.budget_micros/);
 assert.match(sql,/to service_role/);
 assert.match(sql,/enable row level security/);
});
