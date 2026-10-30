"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const db=require("../data/certifications.json");
const ui=fs.readFileSync(path.join(__dirname,"../index.html"),"utf8");
const {credentialSuggestion}=require("./load-browser-module.cjs")("../assets/requirement-comparison.js");
test("등록 자격증의 아이디·중복 없음",()=>{
assert.equal(db.count,74);assert.equal(db.certifications.length,74);
assert.deepEqual(db.certifications.map(x=>x.id),Array.from({length:74},(_,i)=>i+1));
assert.equal(new Set(db.certifications.map(x=>x.name.normalize("NFKC").toLowerCase())).size,74);
assert.deepEqual(db.certifications.slice(30,34).map(x=>x.name),["DAP","DAsP","산업보안관리사","AICE associate"]);
});
test("기존 34개 사용자 확인 상태와 새 항목 검토 필요 상태 구분",()=>{
assert.equal(db.verification_confirmed_by,"user");
assert.ok(db.certifications.slice(0,34).every(x=>x.verification_status==="verified") && db.certifications.slice(34).every(x=>x.verification_status==="needs_official_review"));
assert.ok(ui.includes("data.certifications.length!==data.count"));
assert.ok(!ui.includes("data.certifications.length!==23"));
});
test("자격증명 비교와 경력 혼합 조건 오판 방지",()=>{
for(const name of ["DAP","DAsP","산업보안관리사","PC정비사 2급","AICE associate"])
assert.equal(credentialSuggestion({text:name+" 자격증 보유"},name)?.status,"충족",name);
assert.equal(credentialSuggestion({text:"정보처리기사 및 경력 3년 이상"},"정보처리기사"),null);
});

test("사용자 제공 설명 5개를 정확히 반영하고 다른 자격증 데이터와 상태를 보존",()=>{
 const descriptions={
  "컴퓨터시스템기사": "2026년부터 기존의 '전자계산기기사'와 '전자계산기조직응용기사'가 통합되어 신설된 국가기술자격",
  "컴퓨터시스템응용기술사": "과학기술정보통신부가 주관하고 한국산업인력공단에서 시행하는 정보기술(IT) 분야의 최고 권위 국가기술자격",
  "정보보호위험관리사": "조직의 정보보호 리스크를 체계적으로 분석하고 대응할 수 있는 능력을 검증하는 전문 자격",
  "정보보호능력검정": "국민의 보안 인식 제고와 일상 속 침해사고 예방·초기 대응 역량을 객관적으로 평가하는 시험",
  "정보관리기술사": "과학기술정보통신부가 소관하고 한국산업인력공단이 시행하는 대한민국 SW·IT 분야 최고의 국가기술자격"
};
 for(const [name,expected] of Object.entries(descriptions)){
  const item=db.certifications.find(x=>x.name===name);
  assert.ok(item,name);
  assert.equal(item.description,expected,name);
  assert.equal(item.verification_status,"verified");
  assert.doesNotMatch(item.description,/첨부 CSV|서비스용 요약/);
 }
 assert.equal(db.count,74);
});

test("사용자 제공 신규 자격증 설명 2개 반영",()=>{
 const descriptions={
  "정보처리산업기사": "과학기술정보통신부 주관, 한국산업인력공단 시행의 IT 분야 중간 관리자급 국가기술자격",
  "정보기기운용기능사": "컴퓨터 및 정보통신 장비의 설치·조작·유지보수·검사 등의 직무를 수행하는 전문 기술 자격"
};
 for(const [name,description] of Object.entries(descriptions)){
  const record=db.certifications.find(x=>x.name===name);
  assert.ok(record,name);
  assert.equal(record.description,description);
  assert.equal(record.verification_status,"verified");
 }
 assert.equal(db.certifications.length,74);
});

test("PC정비사 1급/2급 설명은 입력받은 각각의 내용으로 유지",()=>{
 const expected={
  "PC정비사 1급": "컴퓨터 시스템과 하드웨어 전반에 대한 상급 수준의 유지보수, 시스템 최적화, 네트워크 활용 능력을 평가하는 자격",
  "PC정비사 2급": "컴퓨터 시스템과 하드웨어에 대한 지식을 바탕으로 PC 진단, 수리, 업그레이드, 네트워크 유지보수 능력을 검정하는 자격"
};
 for(const [name,description] of Object.entries(expected)){
  const record=db.certifications.find(x=>x.name===name);
  assert.ok(record,name);
  assert.equal(record.description,description);
  assert.equal(record.verification_status,"verified");
 }
 assert.equal(db.certifications.length,74);
});

test("AICE associate 설명은 사용자 수정 내용대로 유지",()=>{
 const aice=db.certifications.find(x=>x.name==="AICE associate");
 assert.ok(aice);
 assert.equal(aice.description,"KT가 개발하고 한국경제신문이 공동 주관하는 국가공인 인공지능(AI) 실무 활용 능력 평가 자격");
 assert.equal(aice.type,"국가공인 민간자격");
 assert.equal(db.count,74);
});
