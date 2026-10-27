const test=require('node:test'),assert=require('node:assert/strict');
test('provider errors expose only allowlisted category, never key or response text',async()=>{
 const {safeProviderError}=await import('../lib/agent/provider-errors.js');
 for(const [status,code,expected] of [[401,'invalid_api_key','PROVIDER_AUTH'],[429,'insufficient_quota','PROVIDER_QUOTA'],[429,'credit_balance_exhausted','PROVIDER_QUOTA'],[429,'project_spend_limit_exceeded','PROVIDER_QUOTA'],[429,'organization_usage_limit_exceeded','PROVIDER_QUOTA'],[404,'model_not_found','PROVIDER_MODEL_UNAVAILABLE'],[429,'rate_limit_exceeded','PROVIDER_RATE_LIMIT'],[400,'invalid_request_error','PROVIDER_BAD_REQUEST'],[503,null,'PROVIDER_UNAVAILABLE']]){
 const result=safeProviderError({statusCode:status,responseBody:JSON.stringify({error:{code,message:'private-key-and-input'}})});
 assert.equal(result.code,expected);assert.doesNotMatch(JSON.stringify(result),/private-key/);
 }
});
test('provider category survives boundary and is available without another paid request',async()=>{
 const {createModelHandler}=await import('../lib/agent/model-api.js');const {safeProviderError}=await import('../lib/agent/provider-errors.js');let calls=0;
 const token='test-access-code-long';const handler=createModelHandler({config:()=>({enabled:true,token,model:'fake'}),maxCalls:1,adapter:{analyze:async()=>{calls++;throw safeProviderError({statusCode:404});}}});
 const request={schemaVersion:1,revision:'test',posting:'Security experience',profile:{'goal-job':'','education':'','experience':'','certs':'','skills':''},source:{type:'manual'},consent:{externalAi:true}};
 const response=await handler(new Request('http://localhost/api',{method:'POST',headers:{origin:'http://localhost','content-type':'application/json','x-agent-access-code':token},body:JSON.stringify({request,requirements:[{id:'r',sourceQuote:request.posting}]})}));
 assert.equal((await response.json()).error,'PROVIDER_MODEL_UNAVAILABLE');
 const state=await (await handler(new Request('http://localhost/api'))).json();assert.equal(state.remaining,0);assert.equal(state.lastError,'PROVIDER_MODEL_UNAVAILABLE');assert.equal(calls,1);
});
