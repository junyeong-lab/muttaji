"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const db=require("../data/certifications.json");
const ui=fs.readFileSync(path.join(__dirname,"../index.html"),"utf8");
const {credentialSuggestion}=require("../assets/requirement-comparison.js");
test("34개 선택 목록과 아이디·중복 없음",()=>{
assert.equal(db.count,34);assert.equal(db.certifications.length,34);
assert.deepEqual(db.certifications.map(x=>x.id),Array.from({length:34},(_,i)=>i+1));
assert.equal(new Set(db.certifications.map(x=>x.name.normalize("NFKC").toLowerCase())).size,34);
assert.deepEqual(db.certifications.slice(-4).map(x=>x.name),["DAP","DAsP","산업보안관리사","AICE associate"]);
});
test("사용자가 공식 검증 완료라고 확인한 34개로 상태 갱신",()=>{
assert.equal(db.verification_confirmed_by,"user");
assert.ok(db.certifications.every(x=>x.verification_status==="verified"));
assert.ok(ui.includes("data.certifications.length!==data.count"));
assert.ok(!ui.includes("data.certifications.length!==23"));
});
test("자격증명 비교와 경력 혼합 조건 오판 방지",()=>{
for(const name of ["DAP","DAsP","산업보안관리사","PC정비사 2급","AICE associate"])
assert.equal(credentialSuggestion({text:name+" 자격증 보유"},name)?.status,"충족",name);
assert.equal(credentialSuggestion({text:"정보처리기사 및 경력 3년 이상"},"정보처리기사"),null);
});
