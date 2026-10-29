"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {requirements,assessment,tally,credentialSuggestion,ownedCertificates}=
  require("./load-browser-module.cjs")("../assets/requirement-comparison.js");
const {analyze}=require("./load-browser-module.cjs")("../assets/job-text-analyzer.js");

const owned="정보처리기사\nSQLD\n네트워크관리사 2급";
function suggestion(text,certs=owned){return credentialSuggestion({text},certs);}

test("필수 택1 자격증 중 하나를 보유하면 근거와 함께 충족",()=>{
  const posting="필수 자격요건\nㆍ 정보처리기사 또는 정보보안기사";
  const item=requirements(posting,{analyze})[0];
  const proposal=credentialSuggestion(item,owned);
  assert.equal(proposal.status,"충족");
  assert.deepEqual(proposal.names,["정보처리기사"]);
  assert.match(proposal.reason,/본인 입력 기준/);
  assert.deepEqual(tally([assessment(item,proposal.status,proposal.reason)]),
    {"충족":1,"부분 충족":0,"미충족":0,"확인 필요":0});
});
test("사용자가 보유한 명시 자격증명만 일치",()=>{
  for(const text of ["정보처리기사","필수 자격증: 정보처리기사 보유자","SQLD","네트워크관리사 2급"]){
    assert.equal(suggestion(text)?.status,"충족",text);
  }
  assert.equal(suggestion("정보처리기사","정처기")?.status,"충족");
  assert.deepEqual(ownedCertificates("정보처리기사, SQLD; 네트워크관리사 2급"),
    ["정보처리기사","SQLD","네트워크관리사 2급"]);
});
test("AND 자격증은 모두 보유한 경우에만 자동 충족",()=>{
  assert.equal(suggestion("정보처리기사 및 정보보안기사"),null);
  assert.equal(suggestion("정보처리기사 및 정보보안기사","정보처리기사\n정보보안기사")?.status,"충족");
});
test("학력, 경력, 기술이 결합된 조건은 자격증이 있어도 자동 충족하지 않음",()=>{
  for(const text of [
    "정보처리기사 및 경력 3년 이상",
    "정보처리기사 또는 정보보안기사 및 경력 3년 이상",
    "정보처리기사 보유 및 네트워크 이해",
    "정보보안 관련 자격증 우대",
    "학력: 대졸 이상",
    "경력 3년 이상"
  ])assert.equal(suggestion(text),null,text);
});
test("다른 자격증이나 겹치는 영문 약어는 일치시키지 않음",()=>{
  assert.equal(suggestion("정보보안기사"),null);
  assert.equal(suggestion("SQLDP","SQLD"),null);
  assert.equal(suggestion("SQLD","SQLDP"),null);
  assert.equal(suggestion("정보처리기사","SQLD"),null);
});
test("자동 제안은 수동 확정 함수를 우회하지 않고 확인 필요 선택도 유지",()=>{
  const item={kind:"required",text:"정보처리기사"};
  assert.equal(assessment(item,"확인 필요","").status,"확인 필요");
  assert.equal(assessment(item,"충족","").status,"확인 필요");
  const auto=suggestion(item.text);
  assert.equal(assessment(item,auto.status,auto.reason).status,"충족");
});

test("실제 컨설턴트 공고의 다중 우대 자격증 예시에서 보유 정보처리기사 자동 충족",()=>{
  const posting=[
    "모집","정보보안 컨설턴트(신입)",
    "이런 경험이 있으면 더 좋아요!",
    "• IT/ 정보보안 자격증 소지자",
    "정보보안(산업)기사, 정보처리기사, ISMS-P/ISO27001 심사원, CPPG 등"
  ].join("\n");
  const [item]=requirements(posting,{analyze});
  assert.equal(item.kind,"preferred");
  assert.equal(item.line,4);
  assert.equal(item.endLine,5);
  const proposed=credentialSuggestion(item,owned);
  assert.equal(proposed?.status,"충족");
  assert.deepEqual(proposed.names,["정보처리기사"]);
  assert.match(proposed.reason,/보유 자격증 입력과 일치/);
  assert.match(proposed.reason,/우대조건만/);
  const confirmed=assessment(item,proposed.status,proposed.reason);
  assert.equal(confirmed.status,"충족");
  assert.equal(tally([confirmed])["충족"],1);
});
test("자격증 예시만 보유한 경우에 한해 자동 일치하고 증빙은 별도",()=>{
  const item={kind:"preferred",text:"IT/정보보안 자격증 소지자 정보보안(산업)기사, 정보처리기사, CPPG 등"};
  assert.equal(credentialSuggestion(item,"정보처리기사")?.status,"충족");
  assert.equal(credentialSuggestion(item,"CPPG")?.status,"충족");
  assert.equal(credentialSuggestion(item,"SQLD"),null);
  assert.equal(credentialSuggestion(item,"네트워크관리사 2급"),null);
});
test("다른 경력·학력·기술 조건이나 모두 보유 조건까지 자동 충족하지 않음",()=>{
  const unsafe=[
    "정보처리기사, CPPG 등 자격증 및 경력 3년 이상",
    "정보처리기사, CPPG 등 자격증 및 네트워크 이해",
    "정보처리기사, CPPG 등 자격증과 학사 학위",
    "정보처리기사, CPPG 등 자격증 모두 소지",
    "정보처리기사, CPPG 모두 취득",
    "정보처리기사, CPPG",
    "정보보안 관련 자격증 우대"
  ];
  for(const text of unsafe){
    assert.equal(suggestion(text),null,text);
  }
  assert.equal(suggestion("정보처리기사 및 정보보안기사"),null);
  assert.equal(suggestion("정보처리기사 또는 정보보안기사")?.status,"충족");
  assert.equal(suggestion("SQLDP","SQLD"),null);
});

test("우대 자격증 나열 중 보유한 정보처리기사를 본인 입력 기준으로 충족",()=>{
  const item={kind:"preferred",text:"자격증 : 정보처리기사, 정보처리산업기사, 전기기사"};
  const proposal=credentialSuggestion(item,"정보처리기사\nSQLD\n네트워크관리사 2급");
  assert.equal(proposal?.status,"충족");
  assert.deepEqual(proposal.names,["정보처리기사"]);
  assert.match(proposal.reason,/회사 인정 여부는 별도 확인/);
  assert.equal(assessment(item,proposal.status,proposal.reason).status,"충족");
});
test("필수 나열·모두 요구·경력 결합·다른 자격증은 자동 충족하지 않음",()=>{
  const entries=[
    {kind:"required",text:"자격증 : 정보처리기사, 정보처리산업기사, 전기기사"},
    {kind:"preferred",text:"자격증 : 정보처리기사, 정보처리산업기사 및 전기기사"},
    {kind:"preferred",text:"자격증 : 정보처리기사, 정보처리산업기사, 전기기사 모두"},
    {kind:"preferred",text:"자격증 : 정보처리기사, 정보처리산업기사, 전기기사 및 경력 3년"},
    {kind:"preferred",text:"자격증 : 정보처리산업기사, 전기기사"},
    {kind:"preferred",text:"자격증 : 정보처리기사, 전기기사, 관련 실무 경력"}
  ];
  entries.forEach(item=>assert.equal(credentialSuggestion(item,"정보처리기사"),null,item.text));
});

test("CISSP·CISA 등 IT 보안관련 자격증: 직접 명시한 자격만 자동 충족",()=>{
  const item={kind:"preferred",text:"CISSP, CISA 등 IT 보안관련 자격증 자격증 소지자 우대"};
  for(const named of ["CISSP","CISA"]){
    const result=credentialSuggestion(item,named);
    assert.equal(result?.status,"충족",named);
    assert.deepEqual(result.names,[named]);
    assert.match(result.reason,/직접 명시된/);
  }
  for(const related of ["정보보안기사","정보보안산업기사","CompTIA Security+","SQLD","정보처리기사"]){
    assert.equal(credentialSuggestion(item,related),null,related+" should stay review-only");
  }
  assert.equal(credentialSuggestion({...item,text:item.text+" 및 경력 3년"},"CISSP"),null);
});
