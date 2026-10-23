"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {build,explicitCertMatches,action}=require("../assets/roadmap-builder.js");

const catalog=[
  {id:1,name:"정보보안기사",aliases:"정보보안기사; SIS",field:"정보보안",official_url:"https://www.cq.or.kr/",verification_status:"needs_official_review"},
  {id:2,name:"정보처리기사",aliases:"정보처리기사; 정처기",field:"IT",official_url:"https://www.q-net.or.kr/",verification_status:"needs_official_review"},
  {id:7,name:"CPPG",aliases:"CPPG; 개인정보관리사",field:"개인정보보호",official_url:"https://www.cpptest.or.kr/",verification_status:"needs_official_review"},
  {id:20,name:"ISMS-P 인증심사원",aliases:"ISMS-P 인증심사원",field:"정보보호",official_url:"https://example.org",verification_status:"needs_official_review"},
  {id:30,name:"정보보안기술사",aliases:"정보보안기술사",verification_status:"verified"}
];
test("필수부터, 미충족·부분 충족·확인 필요 순으로 사용자 근거만 정렬",()=>{
  const items=[
    {kind:"preferred",status:"미충족",text:"CPPG 자격",explanation:"준비 중"},
    {kind:"required",status:"확인 필요",text:"경력 3년",line:7},
    {kind:"required",status:"미충족",text:"정보보안기사 필요",line:11,explanation:"취득하지 않음"},
    {kind:"required",status:"부분 충족",text:"로그 분석 실무",explanation:"실습만 해봄"},
    {kind:"required",status:"충족",text:"학사 학위",explanation:"학사 졸업"}
  ];
  const result=build(items,catalog,"정보처리기사, SQLD");
  assert.deepEqual(result.map(x=>x.status),["미충족","부분 충족","확인 필요","충족","미충족"]);
  assert.equal(result[0].requirement,"정보보안기사 필요");
  assert.equal(result[4].kind,"preferred");
  assert.equal(result[0].certificates[0].heldClaim,false);
});
test("공고에 명시된 검증 전 자격증만 연결하고 이름 유사성으로 다른 자격을 만들지 않는다",()=>{
  const result=explicitCertMatches("정보보안기사 또는 CPPG 자격증 우대",catalog,"정보처리기사");
  assert.deepEqual(result.map(x=>x.name),["정보보안기사","CPPG"]);
  assert.equal(result[0].heldClaim,false);
  assert.match(result[0].verification,/미검증/);
  assert.deepEqual(explicitCertMatches("보안 분야 지식 우대",catalog,""),[]);
});
test("보유 입력과 일치하더라도 실무경력 충족은 판정하지 않는다",()=>{
  const arr=explicitCertMatches("CPPG 보유자 우대",catalog,"CPPG");
  assert.equal(arr[0].heldClaim,true);
  assert.match(arr[0].verification,/원문/);
  assert.match(action({text:"EDR/AV 구축 실무 경력 3년 이상",status:"미충족"}),/실무 경력/);
});
test("모호한 인증심사원/검증 완료 아닌 분류는 자격증 추천에서 제외",()=>{
  assert.deepEqual(explicitCertMatches("ISMS-P 인증심사원 채용",catalog,""),[]);
  assert.deepEqual(explicitCertMatches("정보보안기술사",catalog,""),[]);
});
test("누락된 자격증 DB라도 안전하게 로드맵 생성",()=>{
  const result=build([{kind:"required",status:"확인 필요",text:"보안 점검 경력",line:2}],null,"");
  assert.equal(result.length,1);
  assert.equal(result[0].certificates.length,0);
  assert.equal(result[0].requiresValidation,true);
});
test("유효하지 않은 입력은 거부하고 규칙이 해석 불가한 항목은 제외",()=>{
  assert.throws(()=>build("not array",catalog,""),TypeError);
  assert.deepEqual(build([{kind:"unknown",status:"충족",text:"A"},{kind:"required",status:"false",text:"B"}],catalog,""),[]);
});

test("직무 요구역량은 DB의 실제 역량 태그가 일치할 때만 참고 후보로 연결한다",()=>{
  const related=require("../assets/roadmap-builder.js").relatedSkillCandidates;
  const source=[
    {id:5,name:"SQLD",aliases:"SQLD",skills:"SQL; 데이터베이스",field:"데이터",verification_status:"needs_official_review"},
    {id:7,name:"CPPG",aliases:"CPPG",skills:"개인정보보호; 개인정보보호법",field:"개인정보보호",verification_status:"needs_official_review"},
    {id:2,name:"정보처리기사",aliases:"정보처리기사",skills:"소프트웨어설계; 데이터베이스",field:"IT",verification_status:"needs_official_review"},
    {id:15,name:"컴퓨터활용능력 1급",aliases:"컴활1급",skills:"데이터베이스; 스프레드시트",field:"사무정보",verification_status:"needs_official_review"}
  ];
  assert.deepEqual(related("개인정보보호 업무",source,"",[]).map(c=>c.name),["CPPG"]);
  const sql=related("SQL과 데이터베이스 설계 지식",source,"",[]);
  assert.deepEqual(sql.map(c=>c.name),["SQLD","정보처리기사"]);
  assert.equal(sql[0].matchedPhrase.toLowerCase(),"sql");
  assert.equal(sql[0].skillEvidence,"SQL");
  assert.equal(sql.some(x=>x.name==="컴퓨터활용능력 1급"),false);
});
test("경력이나 심사원·전문인력 자체가 요구되면 다른 자격증으로 대체 추천하지 않는다",()=>{
  const related=require("../assets/roadmap-builder.js").relatedSkillCandidates;
  const candidates=[{id:7,name:"CPPG",aliases:"CPPG",skills:"개인정보보호",field:"개인정보보호",verification_status:"needs_official_review"}];
  for(const requirement of ["개인정보보호 분야 실무 경력 3년 이상","개인정보영향평가 전문인력","개인정보보호 인증심사원","개인정보보호 보안약점 진단원"]){
    assert.deepEqual(related(requirement,candidates,"",[]),[],requirement);
  }
});
test("영어 약어는 단어 경계를 지켜 다른 단어에 들어 있는 SIS를 오인하지 않는다",()=>{
  const list=[{id:1,name:"정보보안기사",aliases:"SIS; 정보보안기사",verification_status:"needs_official_review"}];
  assert.deepEqual(explicitCertMatches("analysis 및 위험평가",list,""),[]);
  assert.deepEqual(explicitCertMatches("SIS 우대",list,"").map(x=>x.name),["정보보안기사"]);
});
test("공고에 이름이 없으면 추천은 자격요건 충족으로 간주되지 않는다",()=>{
  const full=[{id:7,name:"CPPG",aliases:"CPPG",skills:"개인정보보호",field:"개인정보보호",verification_status:"needs_official_review"}];
  const result=build([{kind:"preferred",status:"미충족",text:"개인정보보호 업무 이해"}],full,"CPPG");
  assert.equal(result[0].status,"미충족");
  assert.equal(result[0].certificates.length,1);
  assert.equal(result[0].certificates[0].relation,"related_skill");
  assert.equal(result[0].certificates[0].heldClaim,true);
  assert.equal(result[0].requiresValidation,true);
});
