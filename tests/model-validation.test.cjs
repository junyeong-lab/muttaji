const test=require('node:test'),assert=require('node:assert/strict');
const request={revision:'current',posting:'필수조건\n보안 점검 경험',profile:{'goal-job':'','education':'','experience':'보안 점검을 했습니다.','certs':'','skills':''}};
const requirements=[{id:'required-0',sourceQuote:'보안 점검 경험'}],catalog=[{id:'1',name:'가상 자격'}];
const output=()=>({schemaVersion:1,revision:'current',mode:'model-suggestion',needsHumanReview:true,items:[{id:'required-0',postingQuote:'보안 점검 경험',interpretation:'점검 경험 요건입니다.',taskType:'technical',keySkills:[],profileEvidence:[{field:'experience',quote:'보안 점검을 했습니다.'}],proposedStatus:'부분 충족',reason:'입력한 점검과 관련됩니다.',missing:[],actions:[],certifications:[]}]});
test('validation distinguishes exact failure paths without exposing personal data',async()=>{
 const {validateSuggestions}=await import('../lib/agent/provider-interface.js');
 const cases=[['REVISION_MISMATCH',x=>x.revision='wrong'],['REQUIREMENT_COUNT',x=>x.items=[]],['REQUIREMENT_ID',x=>x.items[0].id='wrong'],['POSTING_QUOTE',x=>x.items[0].postingQuote='경험을 보유'],['PROFILE_QUOTE',x=>x.items[0].profileEvidence[0].quote='PRIVATE_INVENTED_TEXT'],['STATUS_WITHOUT_EVIDENCE',x=>x.items[0].profileEvidence=[]],['SKILL_QUOTE',x=>x.items[0].keySkills=[{name:'X',quote:'없는 공고 문구'}]],['CERTIFICATE_ID',x=>x.items[0].certifications=[{id:'unknown',reason:'test',postingQuote:request.posting}]],['CERTIFICATE_QUOTE',x=>x.items[0].certifications=[{id:'1',reason:'test',postingQuote:'없는 문구'}]]];
 for(const [reason,mutate] of cases){const value=output();mutate(value);assert.throws(()=>validateSuggestions(value,{request,requirements,catalog}),e=>{assert.equal(e.code,'INVALID_AGENT_OUTPUT');assert.equal(e.validation.reason,reason);assert.doesNotMatch(JSON.stringify(e.validation),/PRIVATE|점검/);return true;});}
 assert.deepEqual(validateSuggestions(output(),{request,requirements,catalog}),output());
});
test('dynamic schema fixes revision, item count, requirement and catalog IDs per request',async()=>{
 const {schemaForRequest,suggestionSchema}=await import('../lib/agent/model-schema.js');
 const schema=schemaForRequest({request,requirements,catalog});
 assert.deepEqual(schema.properties.revision.enum,['current']);assert.equal(schema.properties.items.minItems,1);assert.equal(schema.properties.items.maxItems,1);
 assert.deepEqual(schema.properties.items.items.properties.id.enum,['required-0']);
 assert.deepEqual(schema.properties.items.items.properties.certifications.items.properties.id.enum,['1']);
 assert.equal(schemaForRequest({request,requirements,catalog:[]}).properties.items.items.properties.certifications.maxItems,0);
 assert.equal(suggestionSchema.properties.items.minItems,undefined);
});

test('unverified optional skills are removed with safe warnings, while core evidence remains mandatory',async()=>{
 const {analyzePrepared}=await import('../lib/agent/provider-interface.js');
 const sourceRequest={...request,schemaVersion:1,source:{type:'manual'},consent:{externalAi:true}};
 const value=output();value.items[0].keySkills=[{name:'보안',quote:'보안'},{name:'invented technical claim',quote:'PRIVATE_INVALID_QUOTE'}];
 const base={request:sourceRequest,requirements,catalog,adapter:{analyze:async()=>structuredClone(value)},enabled:true,ownerApproved:true};
 const result=await analyzePrepared(base);
 assert.deepEqual(result.items[0].keySkills,[{name:'보안',quote:'보안'}]);assert.deepEqual(result.validationWarnings,[{code:'UNVERIFIED_SKILL_REMOVED',itemIndex:0,count:1}]);
 assert.equal(value.items[0].keySkills.length,2);assert.doesNotMatch(JSON.stringify(result),/PRIVATE_INVALID|invented technical/);
 value.items[0].profileEvidence[0].quote='PRIVATE_FAKE_HISTORY';
 await assert.rejects(analyzePrepared(base),e=>e.validation.reason==='PROFILE_QUOTE');
});
test('malformed skills cannot bypass output validation through optional cleanup',async()=>{
 const {analyzePrepared}=await import('../lib/agent/provider-interface.js');const value=output();value.items[0].keySkills=[{name:'x',quote:'not present',unexpected:'field'}];
 await assert.rejects(analyzePrepared({request:{...request,schemaVersion:1,source:{type:'manual'},consent:{externalAi:true}},requirements,catalog,adapter:{analyze:async()=>value},enabled:true,ownerApproved:true}),{code:'INVALID_AGENT_OUTPUT'});
});
