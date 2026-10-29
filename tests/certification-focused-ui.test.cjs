"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const html=fs.readFileSync(path.join(__dirname,"../index.html"),"utf8");
const {recommend}=require("./load-browser-module.cjs")("../assets/certification-recommendations.js");
const db=require("../data/certifications.json");
test("자격증 중심 UI에서 경력·학력 비교 및 로드맵은 숨겨진다",()=>{
  assert.match(html,/var pages=\["home","analyze","profile","certifications"\]/);
  assert.doesNotMatch(html,/<button[^>]*class="nav"[^>]*data-go="roadmap"/);
  assert.match(html,/<section id="roadmap" class="panel" hidden/);
  assert.match(html,/aria-labelledby="requirements-title" hidden aria-hidden="true"/);
  for(const id of ["education","experience","skills"])assert.ok(html.includes('hidden aria-hidden="true"><label class="label" for="'+id+'"'));
  for(const id of ["job-text","goal-job","certs","cert-search","cert-rec-run","cert-rec-results"])assert.ok(html.includes('id="'+id+'"'));
  assert.match(html,/if\(page==="roadmap"\) page="certifications"/);
  assert.ok(html.includes('var profileFieldsToStore=["goal-job","education","experience","certs","skills"];'));
  assert.ok(html.includes('assets/requirement-comparison.js'));
});
test("추천 결과에서 보유 자격증과 명시된 미보유 입력 자격증을 구분",()=>{
  assert.equal(db.count,34);
  const posting="우대사항\nIT, 정보보안 자격증(정보처리기사, 정보보안기사 등) 보유";
  const result=recommend(db.certifications,{posting,preferred:["IT, 정보보안 자격증(정보처리기사, 정보보안기사 등) 보유"],owned:"정보처리기사"});
  assert.ok(result.some(x=>x.name==="정보처리기사"&&x.owned&&x.explicit));
  assert.ok(result.some(x=>x.name==="정보보안기사"&&!x.owned&&x.explicit));
  assert.ok(result.length<=3);
});
