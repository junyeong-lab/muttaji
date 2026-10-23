"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {requirements,assessment,tally,credentialSuggestion,ownedCertificates}=
  require("../assets/requirement-comparison.js");
const {analyze}=require("../assets/job-text-analyzer.js");

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
