"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const db=require("../data/certifications.json");
const ui=fs.readFileSync(path.join(__dirname,"../index.html"),"utf8");
const {credentialSuggestion}=require("./load-browser-module.cjs")("../assets/requirement-comparison.js");
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

test("사용자 제공 설명 5개를 정확히 반영하고 다른 자격증 데이터와 상태를 보존",()=>{
 const descriptions={
  "컴퓨터시스템기사": "컴퓨터 시스템을 구성하는 하드웨어를 기반으로 시스템 소프트웨어를 설계하고 구현하는 업무를 수행(전자계산기기사와 전자계산기조직응용기사가 통합·개편)",
  "컴퓨터시스템응용기술사": "과학기술정보통신부가 주관하고 한국산업인력공단에서 시행하는 정보기술(IT) 분야의 최고 권위 국가기술자격으로 컴퓨터 하드웨어와 소프트웨어에 대한 고도의 전문 지식과 풍부한 실무 경험을 바탕으로, 정보시스템의 계획·연구·설계·분석·시험·운영·시공 및 기술 평가를 담당",
  "정보보호위험관리사": "조직의 정보보호 리스크를 체계적으로 분석하고 대응할 수 있는 능력을 검증하는 전문 자격증입니다. 단순한 기술 자격에서 벗어나 보안 거버넌스와 위험 관리 체계를 실무적으로 이해하고 운영하는 능력을 평가",
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
 assert.equal(db.count,34);
});
