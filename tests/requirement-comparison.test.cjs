"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {requirements,assessment,tally}=require("./load-browser-module.cjs")("../assets/requirement-comparison.js");
const {analyze}=require("./load-browser-module.cjs")("../assets/job-text-analyzer.js");

const posting=[
  "ES기술부", "",
  "담당업무", "ㆍ 엔드포인트 보안솔루션 구축 및 유지보수",
  "[자격 요건]",
  "ㆍ 엔드포인트 보안솔루션 구축 및 유지관리 경험 보유자",
  "ㆍ 동종 경력 7년이상(과장급), 3년이상(대리급)",
  "[우대 사항]",
  "ㆍ 악성코드 분석 및 위협 탐지(Threat Hunting) 관련 보안 지식 보유자 우대",
  "ㆍ Presales(제품소개, PoC/BMT, 제안 등) 경험자 우대"
].join("\n");

test("공고에서 필수 2개 우대 2개만 평가 대상으로 수집",()=>{
  const result=requirements(posting,{analyze});
  assert.equal(result.length,4);
  assert.deepEqual(result.map(x=>x.kind),["required","required","preferred","preferred"]);
  assert.equal(result[0].line,6);
  assert.equal(result[3].line,10);
  assert.equal(result[0].text,"엔드포인트 보안솔루션 구축 및 유지관리 경험 보유자");
});
test("자동 충족 판정 없이 기본 상태는 확인 필요",()=>{
  const items=requirements(posting,{analyze});
  const evaluated=items.map(item=>assessment(item,"확인 필요",""));
  assert.deepEqual(tally(evaluated),{"충족":0,"부분 충족":0,"미충족":0,"확인 필요":4});
});
test("선택만 하고 사유가 없으면 확인 필요로 계산",()=>{
  const item=requirements(posting,{analyze})[0];
  for(const choice of ["충족","부분 충족","미충족"]){
    assert.equal(assessment(item,choice,"").status,"확인 필요");
    assert.equal(assessment(item,choice,"짧음").status,"확인 필요");
    assert.equal(assessment(item,choice,"").needsReason,true);
  }
});
test("사용자 설명이 있는 상태만 비교 결과로 반영",()=>{
  const items=requirements(posting,{analyze});
  const selected=[
    assessment(items[0],"부분 충족","솔루션 구축 실습 경험 보유, 유지보수 미경험"),
    assessment(items[1],"미충족","요구되는 동종 3년 경력은 보유하지 않음"),
    assessment(items[2],"충족","위협분석 과제에서 관련 지식을 사용함"),
    assessment(items[3],"확인 필요","")
  ];
  assert.deepEqual(tally(selected),{"충족":1,"부분 충족":1,"미충족":1,"확인 필요":1});
});
test("잘못된 상태 또는 공고 분석 불가를 오류로 처리",()=>{
  const item=requirements(posting,{analyze})[0];
  assert.throws(()=>assessment(item,"매우 우수","근거 없음"),TypeError);
  assert.throws(()=>requirements(posting,{}),TypeError);
});

test("대졸 이상 단독 조건에서 명시된 학사 졸업만 자동 충족하고 사유를 제공",()=>{
 const {degreeSuggestion}=require("./load-browser-module.cjs")("../assets/requirement-comparison.js");
 const item={kind:"required",text:"학력 : 대졸이상"};
 const graduated=[
   "국립목포해양대학교 기관·해양경찰학부 기관공학전공, 공학사 졸업",
   "국립목포해양대학교 기관공학전공, 학사 졸업",
   "4년제 대학교 졸업",
   "학사학위 취득"
 ];
 for(const education of graduated){
   const suggestion=degreeSuggestion(item,education);
   assert.equal(suggestion?.status,"충족",education);
   assert.match(suggestion.reason,/본인 입력 기준/);
   assert.equal(assessment(item,suggestion.status,suggestion.reason).status,"충족");
 }
});
test("재학·졸업예정·학교명·전문학사 및 복합 요구는 자동 충족 불가",()=>{
 const {degreeSuggestion}=require("./load-browser-module.cjs")("../assets/requirement-comparison.js");
 const item={kind:"required",text:"학력 : 대졸이상"};
 for(const education of [
  "국립목포해양대학교 기관공학전공", "국립목포해양대학교 기관공학전공 학사",
  "국립목포해양대학교 기관공학전공 학사 졸업예정",
  "국립목포해양대학교 기관공학전공 학사 재학",
  "국립목포해양대학교 기관공학전공 학사 수료",
  "전문학사 졸업", "2년제 대학 졸업", "고등학교 졸업", ""
 ])assert.equal(degreeSuggestion(item,education),null,education);
 for(const text of [
  "석사 이상", "학력: 대졸 이상 및 경력 3년",
  "컴퓨터공학과 대졸 이상", "대졸 이상, 정보처리기사 보유",
  "정보처리기사", "학력 무관"
 ])assert.equal(degreeSuggestion({kind:"required",text},"학사 졸업"),null,text);
});
