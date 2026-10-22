"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const {compose,suggest} = require("../assets/ocr-column-review.js");
const {analyze} = require("../assets/job-text-analyzer.js");

test("4열 채용공고는 담당업무 후보만 제안하고 회사명은 추정하지 않는다",()=>{
  assert.equal(suggest(0,4),"unresolved");
  assert.equal(suggest(1,4),"unresolved");
  assert.equal(suggest(2,4),"responsibilities");
  assert.equal(suggest(3,4),"headings");
  assert.equal(suggest(2,3),"unresolved");
});
test("사용자 확인한 열별 구분을 실제 필수·우대·업무로 반영한다",()=>{
  const source=compose([
    {kind:"unresolved",text:"ES기술부"},
    {kind:"unresolved",text:"대리~과장"},
    {kind:"responsibilities",text:"- EDR/AV 구축 및 유지관리\n- 장애 이슈 대응"},
    {kind:"headings",text:"[자격 요건]\n- 구축 경험\n- 경력 3년 이상\n[우대 사항]\n- Threat Hunting"}
  ]);
  const result=analyze(source);
  assert.equal(result.company.length,0);
  assert.equal(result.role.length,0);
  assert.equal(result.responsibilities.length,2);
  assert.equal(result.required.length,2);
  assert.equal(result.preferred.length,1);
  assert.equal(result.unresolved.length,2);
});
test("인식 결과가 없는 열은 제외하고 분류 제목을 표시한다",()=>{
  assert.equal(compose([{kind:"preferred",text:"  자격증  "},{kind:"required",text:" "}]),"우대사항\n자격증");
});
test("정의하지 않은 분류를 허용하지 않는다",()=>{
  assert.throws(()=>compose([{kind:"company",text:"ABC"}]),Error);
});
test("20,000자 또는 400줄 제한을 지킨다",()=>{
  assert.throws(()=>compose([{kind:"unresolved",text:"a".repeat(21000)}]),RangeError);
  assert.throws(()=>compose([{kind:"unresolved",text:("a\n").repeat(402)}]),RangeError);
});
