"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const html=fs.readFileSync(path.join(__dirname,"../index.html"),"utf8");
test("production is certification focused and hides comparison and roadmap",()=>{
  assert.match(html,/var pages=\["home","analyze","profile","certifications"\]/);
  assert.doesNotMatch(html,/class="nav" data-go="roadmap"/);
  assert.match(html,/aria-labelledby="requirements-title" hidden aria-hidden="true"/);
  for(const id of ["education","experience","skills"])assert.ok(html.includes('hidden aria-hidden="true"><label class="label" for="'+id+'"'));
  for(const id of ["certs","goal-job","cert-rec-run","cert-search"])assert.ok(html.includes('id="'+id+'"'));
  assert.match(html,/if\(page==="roadmap"\) page="certifications"/);
});
test("production job URL import and old user information are retained",()=>{
  for(const id of ["job-url","job-url-fetch","job-url-confirm","job-url-apply","job-url-undo"])assert.ok(html.includes('id="'+id+'"'));
  assert.match(html,/src="\.\/assets\/job-url-ui.js"/);
  assert.match(html,/src="\.\/assets\/session-client.js"/);
  assert.match(html,/var profileFieldsToStore=\["goal-job","education","experience","certs","skills"\]/);
});