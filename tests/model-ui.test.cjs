const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const load=require('./load-browser-module.cjs');
class E{constructor(){this.value='';this.checked=false;this.handlers={};this.children=[];}addEventListener(t,f){(this.handlers[t]??=[]).push(f);}append(...x){this.children.push(...x);}replaceChildren(){this.children=[];}async emit(t){for(const f of this.handlers[t]||[])await f({type:t});}}
async function setup(deferred,failure,publicMode=false,semantic=null){
 const nodes=Object.fromEntries(['model-run','model-status','model-results','model-consent','model-access','job-text','goal-job','education','experience','certs','skills'].map(id=>[id,new E()]));
 nodes['job-text'].value='필수조건\n보안 로그 분석 경험';nodes.experience.value='학습 프로젝트에서 로그 분석';nodes['model-access'].value='test-access-code';const calls=[];
 const win={MuttajiAgentInput:load('../assets/agent-input.js'),MuttajiRequirements:{requirements:()=>[{id:'r',source:'보안 로그 분석 경험',text:'보안 로그 분석 경험'}]},JobTextAnalyzer:{}};
 if(publicMode)win.MuttajiSession={get:async()=>"fake-csrf-token"};
 const payload={data:{revision:null,items:[{postingQuote:'보안 로그 분석 경험',interpretation:'분석 경험 요건',proposedStatus:'확인 필요',reason:'학습 경험과 연결',profileEvidence:[{quote:'학습 프로젝트에서 로그 분석'}],missing:[],actions:['프로젝트 결과를 정리하세요.'],certifications:[]}]}};
 if(semantic)payload.data.items[0].semanticAnalysis=semantic;
 const fetch=async(url,options)=>{calls.push({url,options});if(!options?.method)return new Response(JSON.stringify({enabled:true,model:'fake',remaining:3,...(publicMode?{localOnly:false}:{})}));if(failure)return new Response(JSON.stringify(failure),{status:502});payload.data.revision=JSON.parse(options.body).request.revision;if(deferred)await deferred;return new Response(JSON.stringify(payload));};
 vm.runInNewContext(fs.readFileSync(require('node:path').join(__dirname,'../assets/model-analysis-ui.js'),'utf8'),{document:{getElementById:id=>nodes[id],createElement:()=>new E(),addEventListener(){}},window:win,fetch,AbortController,setTimeout,clearTimeout,URL,console});
 await new Promise(setImmediate);return {nodes,calls};
}
test('model UI only checks availability until explicit consent and click, then displays suggestions separately',async()=>{
 const {nodes,calls}=await setup();assert.equal(calls.length,1);await nodes['model-run'].emit('click');assert.equal(calls.length,1);
 nodes['model-consent'].checked=true;await nodes['model-run'].emit('click');assert.equal(calls.length,2,nodes['model-status'].textContent);assert.equal(nodes['model-results'].children.length,1);
 assert.equal(JSON.parse(calls[1].options.body).request.consent.externalAi,true);assert.equal(nodes.experience.value,'학습 프로젝트에서 로그 분석');
 await nodes.experience.emit('input');assert.equal(nodes['model-results'].children.length,0);assert.equal(nodes['model-consent'].checked,false);
});
test('changed inputs suppress a late model response',async()=>{
 let done;const {nodes}=await setup(new Promise(r=>done=r));nodes['model-consent'].checked=true;
 const pending=nodes['model-run'].emit('click');nodes.experience.value='새 경험';await nodes.experience.emit('input');done();await pending;
 assert.equal(nodes['model-results'].children.length,0);
});
test('preview serves disabled model API and integrated UI without paid calls',async()=>{
 const {spawn}=require('node:child_process');
 const child=spawn(process.execPath,['scripts/preview-agent.mjs','0'],{cwd:require('node:path').join(__dirname,'..'),env:{...process.env,MUTTAJI_AI_ENABLED:'false',MUTTAJI_AI_OWNER_APPROVED:'false'},stdio:['ignore','pipe','pipe']});
 try{
 const port=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('preview timeout')),5000);child.once('error',reject);child.stdout.on('data',chunk=>{const m=chunk.toString().match(/127\.0\.0\.1:(\d+)/);if(m){clearTimeout(timer);resolve(m[1]);}});});
 const base='http://127.0.0.1:'+port;const health=await (await fetch(base+'/api/model-analysis')).json();assert.equal(health.enabled,false);
 const html=await (await fetch(base)).text();
 assert.match(html,/id="job-text"/);assert.match(html,/id="cert-search"/);
 assert.doesNotMatch(html,/model-analysis-title|assets\/model-analysis-ui\.js/);
 const response=await fetch(base+'/api/model-analysis',{method:'POST',body:'{}'});assert.equal(response.status,503);
 }finally{child.kill();}
});


test('UI reports safe validation reason and renders no unverified results',async()=>{
 const {nodes,calls}=await setup(null,{error:'INVALID_AGENT_OUTPUT',validation:{reason:'PROFILE_QUOTE',itemIndex:1}});
 nodes['model-consent'].checked=true;await nodes['model-run'].emit('click');
 assert.match(nodes['model-status'].textContent,/응답 항목 2/);assert.match(nodes['model-status'].textContent,/경험 인용/);assert.equal(nodes['model-results'].children.length,0);assert.equal(calls.length,2);
});

test('public AI mode hides test code and uses session CSRF after explicit consent',async()=>{
 const {nodes,calls}=await setup(null,null,true);nodes['model-access'].value='';nodes['model-consent'].checked=true;
 assert.equal(nodes['model-access'].hidden,true);await nodes['model-run'].emit('click');
 assert.equal(calls[1].options.headers['x-muttaji-csrf'],'fake-csrf-token');assert.equal(calls[1].options.headers['x-agent-access-code'],undefined);assert.equal(nodes['model-results'].children.length,1);
});
test('semantic supplements render as text with locations and never alter the profile',async()=>{
 const semantic={locations:[{line:3}],units:[{quote:'<img src=x onerror=alert(1)>',obligation:'not_required',relation:'start',applicantType:'experienced',roleQuote:'관리진단',applicantQuote:'[경력]',locations:[{line:3}]}],uncertainties:[{quote:'공고 문구',reason:'범위 확인'}],reviewNotes:['직무 선택되지 않음']};
 const {nodes}=await setup(null,null,true,semantic);nodes['model-consent'].checked=true;await nodes['model-run'].emit('click');
 const texts=[];const walk=n=>{if(n.textContent)texts.push(n.textContent);(n.children||[]).forEach(walk);};walk(nodes['model-results']);
 assert.ok(texts.includes('원문 3행'));assert.ok(texts.some(x=>x.includes('필수 아님')));assert.ok(texts.includes(semantic.units[0].quote));
 assert.equal(nodes.experience.value,'학습 프로젝트에서 로그 분석');assert.equal(nodes['model-results'].children.length,1);
});
