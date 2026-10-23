"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {requirements,assessment,tally,suggestCertificateAssessment,cleanCertRequirement}=require("../assets/requirement-comparison.js");
const {analyze}=require("../assets/job-text-analyzer.js");

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

const catalog=[
  {name:"정보처리기사",aliases:"정보처리기사; 정처기",verification_status:"needs_official_review"},
  {name:"정보보안기사",aliases:"정보보안기사",verification_status:"needs_official_review"},
  {name:"정보보안산업기사",aliases:"정보보안산업기사",verification_status:"needs_official_review"},
  {name:"SQLD",aliases:"SQLD; SQL 개발자",verification_status:"needs_official_review"}
];
test("자격증 보유만 요구하는 필수조건은 입력한 동일 자격으로 자동 충족 및 근거 생성",()=>{
  const item={text:"정보처리기사 자격증 보유",kind:"required"};
  const result=suggestCertificateAssessment(item,"정보처리기사, SQLD",catalog);
  assert.equal(result.status,"충족");
  assert.match(result.explanation,/입력한 '정보처리기사' 이름이 일치/);
  assert.match(result.explanation,/실제 취득·유효성/);
  assert.equal(assessment(item,result.status,result.explanation).status,"충족");
});
test("택1 조건은 정보처리기사나 정보보안기사 하나만 입력해도 자동 충족",()=>{
  const item={text:"정보처리기사 또는 정보보안기사 자격증 보유"};
  for(const entered of ["정보처리기사","정보보안기사","정처기"]){
    assert.equal(suggestCertificateAssessment(item,entered,catalog)?.status,"충족",entered);
  }
});
test("둘 다 필수인 경우에는 한 자격만 입력하면 자동 충족하지 않음",()=>{
  const item={text:"정보처리기사 및 정보보안기사 자격증 보유"};
  assert.equal(suggestCertificateAssessment(item,"정보처리기사",catalog),null);
  assert.equal(suggestCertificateAssessment(item,"정보처리기사, 정보보안기사",catalog)?.status,"충족");
});
test("다른 학력·경력·업무 요구가 결합되면 자격증 입력만으로 전체 충족 처리 금지",()=>{
  for(const text of [
    "학력 초대졸 이상 (비전공자는 정보처리기사 또는 정보보안기사 자격증 보유 必)",
    "정보처리기사 자격증 보유 및 정보보안 실무 3년",
    "정보보안기사 및 관련 업무 경력자",
    "정보처리기사 자격증 보유, 해외여행 결격 사유 없음"
  ])assert.equal(suggestCertificateAssessment({text},"정보처리기사, 정보보안기사",catalog),null,text);
});
test("자격증명 공백 또는 명칭 불일치·준비 중인 자격은 자동 충족하지 않음",()=>{
  const item={text:"정보보안기사 자격증 보유"};
  for(const held of ["","정보처리기사","정보보안산업기사","정보보안기사 준비 중","정보보안기사 취득예정"]){
    assert.equal(suggestCertificateAssessment(item,held,catalog),null,held);
  }
});
test("DB에 없는 자격을 임의 생성하거나 이름 일부가 겹치는 자격을 일치로 처리하지 않음",()=>{
  assert.equal(cleanCertRequirement("정보보안기사 자격증 보유",[]),null);
  assert.equal(suggestCertificateAssessment({text:"정보보안기사 자격증 보유"},"정보보안기사",[]),null);
  assert.equal(suggestCertificateAssessment({text:"정보보안기사 자격증 보유"},"정보보안산업기사",catalog),null);
});
test("원래 EDR 구축 경력과 Threat Hunting 지식은 보유 자격증으로 자동 충족되지 않음",()=>{
  for(const text of [
    "엔드포인트 보안솔루션 구축 및 유지관리 경험 보유자",
    "동종 경력 7년이상(과장급), 3년이상(대리급)",
    "악성코드 분석 및 위협 탐지(Threat Hunting) 관련 보안 지식 보유자 우대"
  ])assert.equal(suggestCertificateAssessment({text},"정보처리기사, 정보보안기사",catalog),null,text);
});
