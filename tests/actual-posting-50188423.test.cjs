"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const load=require("./load-browser-module.cjs");
const {buildAnalysis}=load("../assets/experience-explanations.js");
const {certificateMatches,credentialSuggestion}=load("../assets/requirement-comparison.js");

// Regression for the six extracted requirements supplied by the tester from a
// real JobKorea posting (50188423). The text below is only the confirmed
// extracted subset, NOT the full original job advertisement.
const rows=[
  "웹방화벽 구축/설계/유지보수 경험 (유관업무 경력자)",
  "보안제품, NAC 경력자",
  "시큐아이, 지니언스, 소만사 제품 경력자",
  "IT정보 관련 분야 전문 지식 및 자격증 보유자",
  "전공: 정보통신공학과, 컴퓨터공학과, IT관련학과",
  "스스로 성장하고자 하는 의지와 능동적인 성향을 지니신분"
];
const posting="우대사항\n"+rows.map(row=>"· "+row).join("\n");
const requirements=rows.map((text,i)=>({id:"preferred-"+i,kind:"preferred",text,source:"· "+text,line:i+2,endLine:i+2}));
const profile={
  education:"국립목포해양대학교 기관·해양경찰학부 기관공학전공, 공학사 졸업",
  experience:"- 망 혼용 방지를 위한 보안교육 수행\n- 사이버보안 관련 기관평가 준비 및 대응\n- 정보자산, 보안정책 및 취약점 점검\n※ 군 사이버보안 분야 경력이며, 민간 정보보안 컨설턴트 경력과는 구분합니다.",
  skills:"- XDR 보안 탐지·대응 관련 프로젝트",
  certs:"정보처리기사\nSQLD\n네트워크관리사 2급"
};
const analyze=(p=profile)=>buildAnalysis({posting,requirements,profile:p,certificateMatcher:certificateMatches}).explanations;

test("WAF, NAC and named-vendor experience do not match training, other products, or general security assessment",()=>{
  const result=analyze();
  assert.deepEqual(result.slice(0,3).map(x=>x.topic),["web-application-firewall-work","nac-product-work","named-vendor-products"]);
  result.slice(0,3).forEach(x=>assert.equal(x.inputEvidence.length,0));
});
test("general IT certification requirement shows actual owned certificates as context, not an automatic verdict",()=>{
  const result=analyze();
  assert.equal(result[3].topic,"certificate");
  assert.deepEqual(result[3].inputEvidence.map(x=>x.quote),["정보처리기사","SQLD","네트워크관리사 2급"]);
  assert.equal(credentialSuggestion(requirements[3],profile.certs),null);
  assert.equal(Object.hasOwn(result[3],"status"),false);
});
test("named-vendor requirement never mislabels cybersecurity education as product experience",()=>{
  const result=analyze();
  assert.equal(result[2].inputEvidence.some(x=>x.quote.includes("망 혼용 방지")),false);
  assert.match(result[2].explanation,/직접 수행 경력을 입력에서 찾지 못했습니다/);
});
test("actual manufacturer/product operations can be shown without treating other brands as a match",()=>{
  const result=analyze({...profile,experience:"지니언스 Genian NAC 운영 및 장애 대응 수행"});
  assert.deepEqual(result[2].inputEvidence.map(x=>x.quote),["지니언스 Genian NAC 운영 및 장애 대응 수행"]);
  assert.deepEqual(result[1].inputEvidence.map(x=>x.quote),["지니언스 Genian NAC 운영 및 장애 대응 수행"]);
  assert.equal(result[0].inputEvidence.length,0);
});
test("planned, absent, educational, and unrelated vendor mentions never count as operating history",()=>{
  for(const value of ["지니언스 제품 경력 없음","지니언스 제품 구축 예정","지니언스 교육 이수","시큐아이 제품 검색만 진행"]){
    const result=analyze({...profile,experience:value});
    assert.equal(result[2].inputEvidence.length,0,value);
  }
});
test("education evidence is contextual: unrelated degree is not certified as matching a named-major preference",()=>{
  const result=analyze();
  assert.equal(result[4].topic,"education");
  assert.match(result[4].inputEvidence[0].quote,/기관공학전공/);
  assert.equal(Object.hasOwn(result[4],"status"),false);
});
