"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const {compose,suggest} = require("./load-browser-module.cjs")("../assets/ocr-column-review.js");
const {analyze} = require("./load-browser-module.cjs")("../assets/job-text-analyzer.js");

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
  assert.equal(result.role.length,1);
  assert.equal(result.role[0].text,"ES기술부");
  assert.equal(result.responsibilities.length,2);
  assert.equal(result.required.length,2);
  assert.equal(result.preferred.length,1);
  assert.equal(result.unresolved.length,1);
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

test("OCR 열의 첫 기타와 원문 제목 유지 선택에서 가짜 '기타' 제목을 넣지 않는다",()=>{
  const assembled=compose([
    {kind:"unresolved",text:"ES기술부"},
    {kind:"responsibilities",text:"ㆍ EDR/AV 구축 및\n유지보수"},
    {kind:"headings",text:"[자격 요건]\nㆍ 보안솔루션 구축 경험\n[우대 사항]\nㆍ Threat Hunting"}
  ]);
  assert.equal(assembled.startsWith("기타\n"),false);
  assert.equal(assembled.includes("기타\n[자격 요건]"),false);
  assert.equal(assembled.includes("\n\n[자격 요건]"),true);
  const result=analyze(assembled);
  assert.equal(result.responsibilities.length,1);
  assert.equal(result.responsibilities[0].text,"EDR/AV 구축 및 유지보수");
  assert.equal(result.required.length,1);
  assert.equal(result.preferred.length,1);
  assert.equal(result.role.length,1);
  assert.equal(result.unresolved.length,0);
});

test("이후에 나오는 제목 없는 기타 열은 앞 그룹으로 잘못 분류하지 않는다",()=>{
  const assembled=compose([
    {kind:"responsibilities",text:"ㆍ 로그 분석"},
    {kind:"unresolved",text:"ES기술부"}
  ]);
  const result=analyze(assembled);
  assert.equal(result.responsibilities.length,1);
  assert.equal(result.unresolved.length,1);
});

test("열별 검토에서 모집 부서를 명시하면 직무·부서 결과로 보인다",()=>{
  const result=analyze(compose([{kind:"role",text:"ES기술부"},{kind:"responsibilities",text:"- EDR/AV 운영"}]));
  assert.equal(result.role.length,1);
  assert.equal(result.role[0].text,"ES기술부");
  assert.equal(result.role[0].kindHint,"모집 부서");
  assert.equal(result.responsibilities.length,1);
});
