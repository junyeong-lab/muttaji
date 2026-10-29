const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const load=require('./load-browser-module.cjs'),record=require('./fixtures/source-first-cases.json').records[0];
class E{
 constructor(tag='div'){this.tag=tag;this.children=[];this.handlers={};this.value='';this.checked=false;this.disabled=false;this.hidden=false;this.textContent='';}
 append(...nodes){this.children.push(...nodes);}replaceChildren(){this.children=[];}addEventListener(t,fn){(this.handlers[t]??=[]).push(fn);}async emit(t){for(const fn of this.handlers[t]||[])await fn({type:t});}
}
async function setup({failure=null,deferred=null,local=false}={}){
 const ids=['posting-ai-run','posting-ai-status','posting-ai-results','posting-ai-consent','posting-ai-approve','posting-ai-confirm','posting-ai-review','posting-ai-summary','posting-ai-access-wrap','posting-ai-access','posting-ai-add','posting-ai-add-quote','job-text','requirements-check'];
 const nodes=Object.fromEntries(ids.map(x=>[x,new E()]));nodes['job-text'].value=record.posting;nodes['posting-ai-access'].value='test-access-code';const events=[],listeners={},calls=[];
 const win={MuttajiPostingReview:load('../assets/posting-review.js'),MuttajiSession:{get:async()=> 'test-csrf'},addEventListener(t,fn){(listeners[t]??=[]).push(fn);},dispatchEvent(e){events.push(e);for(const fn of listeners[e.type]||[])fn(e);}};
 const data=(await import('../lib/agent/posting-classifier.js')).validatePostingClassification(record.expected,{posting:record.posting,revision:record.expected.revision});
 const fetch=async(url,options)=>{
  calls.push({url,options});if(!options?.method)return new Response(JSON.stringify({enabled:true,localOnly:local}));
  if(deferred)await deferred;
  if(failure)return new Response(JSON.stringify(failure),{status:502});
  const output=structuredClone(data);output.revision=JSON.parse(options.body).request.revision;return new Response(JSON.stringify({data:output}));
 };
 const document={getElementById:id=>nodes[id],createElement:tag=>new E(tag),dispatchEvent(e){events.push(e);}};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../assets/posting-analysis-ui.js'),'utf8'),{window:win,document,fetch,AbortController,CustomEvent:class{constructor(type,options){this.type=type;this.detail=options?.detail;}},setTimeout,clearTimeout,console});
 await new Promise(setImmediate);return {nodes,win,events,calls};
}
test('source-first UI requires consent, sends no profile/parser-list, and does not hand off draft',async()=>{
 const {nodes,win,calls,events}=await setup();await nodes['posting-ai-run'].emit('click');assert.equal(calls.length,1);
 nodes['posting-ai-consent'].checked=true;await nodes['posting-ai-run'].emit('click');assert.equal(calls.length,2);
 const sent=JSON.parse(calls[1].options.body);assert.equal(sent.task,'classify-posting');assert.equal(sent.requirements,undefined);assert.equal(sent.request.profile,undefined);assert.equal(sent.request.posting,record.posting);
 assert.equal(calls[1].options.headers['x-muttaji-csrf'],'test-csrf');assert.equal(nodes['posting-ai-access-wrap'].hidden,true);
 assert.equal(win.MuttajiReviewedPosting,undefined);assert.equal(win.MuttajiPostingReviewGate.status,'draft');assert.equal(events.length,0);
 await nodes['posting-ai-approve'].emit('click');assert.equal(win.MuttajiReviewedPosting,undefined);
 nodes['posting-ai-confirm'].checked=true;await nodes['posting-ai-confirm'].emit('change');await nodes['posting-ai-approve'].emit('click');
 assert.equal(win.MuttajiReviewedPosting.result.required.length,0);assert.equal(win.MuttajiReviewedPosting.result.preferred.length,6);assert.equal(win.MuttajiPostingReviewGate.status,'approved');
 assert.ok(events.some(x=>x.type==='muttaji:comparison-changed'&&x.detail.items===null));
});
test('approved classification edits invalidate visible comparison and previous approved result',async()=>{
 const {nodes,win,events}=await setup();
 nodes['posting-ai-consent'].checked=true;
 await nodes['posting-ai-run'].emit('click');
 nodes['posting-ai-confirm'].checked=true;await nodes['posting-ai-confirm'].emit('change');
 await nodes['posting-ai-approve'].emit('click');
 assert.equal(win.MuttajiPostingReviewGate.status,'approved');
 assert.equal(win.MuttajiReviewedPosting.provenance,'ai-user-approved');
 nodes['requirements-check'].hidden=false;const oldEvents=events.length;
 const card=nodes['posting-ai-results'].children.find(x=>x.tag==='article');
 const category=card.children.find(x=>x.tag==='label'&&x.textContent==='검토 후 분류').children[0];
 category.value='unresolved';await category.emit('change');
 assert.equal(win.MuttajiPostingReviewGate.status,'draft');
 assert.equal(win.MuttajiReviewedPosting,null);
 assert.equal(nodes['requirements-check'].hidden,true);
 assert.ok(events.slice(oldEvents).some(x=>x.type==='muttaji:comparison-changed'&&x.detail.items===null));
});
test('successful reanalysis invalidates earlier review while failed reanalysis preserves it',async()=>{
 const {nodes,win,events}=await setup();
 nodes['posting-ai-consent'].checked=true;await nodes['posting-ai-run'].emit('click');
 nodes['posting-ai-confirm'].checked=true;await nodes['posting-ai-confirm'].emit('change');
 await nodes['posting-ai-approve'].emit('click');
 nodes['requirements-check'].hidden=false;
 await nodes['posting-ai-run'].emit('click');
 assert.equal(win.MuttajiReviewedPosting,null);
 assert.equal(win.MuttajiPostingReviewGate.status,'draft');
 assert.equal(nodes['requirements-check'].hidden,true);
 assert.ok(events.some(x=>x.type==='muttaji:comparison-changed'&&x.detail.items===null));
});

test('failure preserves old approved source and user comparison state, with no retry',async()=>{
 const {nodes,win,calls,events}=await setup({failure:{error:'INVALID_AGENT_OUTPUT',validation:{reason:'POSTING_COVERAGE',missingLines:[36]}}});
 const old={text:record.posting,provenance:'ai-user-approved',result:{required:[],preferred:[]},userState:'existing'};win.MuttajiReviewedPosting=old;win.MuttajiPostingReviewGate={requiresApproval:true,status:'approved',text:record.posting};
 nodes['posting-ai-consent'].checked=true;await nodes['posting-ai-run'].emit('click');assert.equal(win.MuttajiReviewedPosting,old);assert.equal(win.MuttajiPostingReviewGate.status,'approved');assert.equal(events.length,0);assert.equal(calls.length,2);assert.match(nodes['posting-ai-status'].textContent,/36/);assert.match(nodes['posting-ai-status'].textContent,/원문 누락/);
});
test('source change invalidates approvals and suppresses late AI response',async()=>{
 let finish;const {nodes,win,events}=await setup({deferred:new Promise(r=>finish=r)});
 win.MuttajiReviewedPosting={provenance:'ai-user-approved'};nodes['posting-ai-consent'].checked=true;const pending=nodes['posting-ai-run'].emit('click');await new Promise(setImmediate);
 nodes['job-text'].value+='\n추가 내용';await nodes['job-text'].emit('input');finish();await pending;
 assert.equal(win.MuttajiReviewedPosting,null);assert.equal(nodes['posting-ai-results'].children.length,0);assert.equal(win.MuttajiPostingReviewGate.status,'pending');assert.ok(events.some(x=>x.type==='muttaji:comparison-changed'));
});
test('classification edits require fresh approval and invalid source edits cannot be confirmed',async()=>{
 const {nodes,win}=await setup();nodes['posting-ai-consent'].checked=true;await nodes['posting-ai-run'].emit('click');
 const card=nodes['posting-ai-results'].children.find(x=>x.tag==='article'),category=card.children.find(x=>x.tag==='label'&&x.textContent==='검토 후 분류').children[0];
 category.value='unresolved';await category.emit('change');nodes['posting-ai-confirm'].checked=true;await nodes['posting-ai-confirm'].emit('change');await nodes['posting-ai-approve'].emit('click');assert.equal(win.MuttajiReviewedPosting.result.company.length,0);
 const quote=card.children.find(x=>x.tag==='label'&&x.textContent.startsWith('원문 인용')).children[0];quote.value='<script>invented</script>';await quote.emit('input');assert.equal(nodes['posting-ai-confirm'].checked,false);
 nodes['posting-ai-confirm'].checked=true;await nodes['posting-ai-confirm'].emit('change');assert.equal(nodes['posting-ai-approve'].disabled,true);assert.equal(win.MuttajiPostingReviewGate.status,'draft');
});
test('explicit rule fallback cancels a late AI result and remains labeled non-AI',async()=>{
 let finish;const {nodes,win}=await setup({deferred:new Promise(r=>finish=r)});nodes['posting-ai-consent'].checked=true;const pending=nodes['posting-ai-run'].emit('click');await new Promise(setImmediate);
 win.MuttajiReviewedPosting={text:record.posting,result:{required:[],preferred:[]}};win.dispatchEvent({type:'muttaji:rule-reviewed'});finish();await pending;
 assert.equal(win.MuttajiPostingReviewGate.requiresApproval,false);assert.equal(nodes['posting-ai-results'].children.length,0);assert.match(nodes['posting-ai-status'].textContent,/AI 확정 결과가 아닙니다/);
});
