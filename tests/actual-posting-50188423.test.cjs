"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const load=require("./load-browser-module.cjs");
const {buildAnalysis}=load("../assets/experience-explanations.js");
const {certificateMatches,credentialSuggestion}=load("../assets/requirement-comparison.js");
const {buildRoadmap,preparationSteps,nextAction}=load("../assets/roadmap.js");

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

test("the six user-supplied preferences produce six separate three-step roadmap tasks, with no required condition invented",()=>{
  const assessed=requirements.map(item=>({...item,status:"확인 필요",explanation:""}));
  const plan=buildRoadmap(assessed);
  assert.equal(plan.total,6);
  assert.equal(plan.tasks.length,6);
  assert.equal(plan.requiredOpen,0);
  assert.equal(plan.totals["확인 필요"],6);
  assert.ok(plan.tasks.every(item=>item.kind==="preferred"&&item.steps.length===3));
  assert.deepEqual(plan.tasks.map(item=>item.text),rows);
});
test("WAF, NAC, and named-vendor roadmap instructions are distinct and do not substitute unrelated experience",()=>{
  const [waf,nac,vendor]=requirements.slice(0,3).map(item=>preparationSteps({...item,status:"확인 필요"}));
  assert.match(waf.join(" "),/웹방화벽|WAF/);
  assert.match(waf.join(" "),/XDR/);
  assert.match(nac.join(" "),/NAC|접근제어/);
  assert.match(nac.join(" "),/보안교육/);
  assert.match(vendor.join(" "),/시큐아이·지니언스·소만사/);
  assert.match(vendor.join(" "),/망 혼용 방지 교육/);
  assert.notEqual(waf[0],nac[0]);
  assert.notEqual(nac[0],vendor[0]);
});
test("broad IT credentials roadmap uses only user's actual evidence without hardcoded credential names",()=>{
  const cert=preparationSteps({...requirements[3],status:"확인 필요"});
  assert.match(cert.join(" "),/특정 자격증명을 지정하지 않습니다/);
  assert.match(cert.join(" "),/내 역량에 실제로 입력한/);
  assert.doesNotMatch(cert.join(" "),/정보처리기사·SQLD·네트워크관리사/);
  assert.doesNotMatch(cert.join(" "),/새로 취득하라고 권/);
});
test("major preference never equates engineering degree to automatically qualifying as IT major",()=>{
  const major=preparationSteps({...requirements[4],status:"확인 필요"});
  assert.match(major.join(" "),/전공|학과/);
  assert.match(major.join(" "),/자동 인정하지 않습니다/);
  assert.doesNotMatch(major.join(" "),/전공.*충족/);
});
test("growth attitude preference does not invent years of experience, credentials or lab assignments",()=>{
  const growth=preparationSteps({...requirements[5],status:"확인 필요"});
  assert.match(growth.join(" "),/본인 주도|스스로|행동/);
  assert.doesNotMatch(growth.join(" "),/업무별 수행 기간|경력증명|미보유 자격|검증 가능한 결과물을 확인하세요/);
  assert.match(nextAction({...requirements[5],status:"확인 필요"}),/스스로|주도적/);
});
test("roadmap state and task ordering retain user decisions after specialized guidance",()=>{
  const statuses=["부분 충족","확인 필요","충족","미충족","확인 필요","확인 필요"];
  const items=requirements.map((item,i)=>({...item,status:statuses[i],explanation:"사용자 입력 근거"}));
  const plan=buildRoadmap(items);
  assert.equal(plan.total,6);
  assert.equal(plan.tasks.length,5);
  assert.equal(plan.completed.length,1);
  assert.deepEqual(plan.groups.map(group=>group.status),["확인 필요","미충족","부분 충족","충족"]);
  assert.equal(plan.totals["충족"],1);
  assert.equal(plan.groups[0].items.length,3);
});

test("six actual posting categories remain tailored when states are changed by the user",()=>{
  const lineNumbers=[21,23,24,25,26,27];
  const words=[/WAF|웹방화벽/,/NAC/,/시큐아이|지니언스|소만사/,/IT|자격증/,/전공|학과/,/성장|능동|주도/];
  for(const status of ["확인 필요","미충족","부분 충족"]){
    const plan=buildRoadmap(requirements.map((req,i)=>({...req,line:lineNumbers[i],status})));
    assert.equal(plan.total,6);
    assert.equal(plan.requiredOpen,0);
    assert.equal(plan.totals[status],6);
    plan.tasks.forEach((task,i)=>{
      assert.equal(task.kind,"preferred");
      assert.equal(task.status,status);
      assert.equal(task.line,lineNumbers[i]);
      assert.equal(task.steps.length,3);
      assert.match(task.action,words[i]);
      assert.match(task.steps.join(" "),words[i]);
    });
  }
});
test("certificate evidence is bound only to the current user's profile",()=>{
  for(const [certs,expected] of [
    ["",[]],
    ["CCNA\n리눅스마스터 2급",["CCNA","리눅스마스터 2급"]],
    ["SQLD",["SQLD"]],
    ["정보처리기사\nSQLD\n네트워크관리사 2급",["정보처리기사","SQLD","네트워크관리사 2급"]]
  ]){
    const result=analyze({...profile,certs});
    assert.deepEqual(result[3].inputEvidence.map(item=>item.quote),expected);
    assert.equal(Object.hasOwn(result[3],"status"),false);
    assert.equal(result[0].inputEvidence.length,0);
    assert.equal(result[2].inputEvidence.length,0);
    const guide=preparationSteps({...requirements[3],status:"확인 필요"}).join(" ");
    assert.doesNotMatch(guide,/정보처리기사|SQLD|네트워크관리사 2급|CCNA|리눅스마스터 2급/);
  }
});
test("Pages index references the refreshed roadmap asset URL",()=>{
  const fs=require("node:fs");
  const path=require("node:path");
  const html=fs.readFileSync(path.join(__dirname,"../index.html"),"utf8");
  assert.ok(html.includes("assets/roadmap.js?v=20261029-posting50188423-roadmap2"));
});
