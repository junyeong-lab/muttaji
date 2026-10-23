"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {build,planTasks,taskCounts,formatChecklist,taskCategories}=require("../assets/roadmap-builder.js");

test("학습과 프로젝트는 실제 기술 부족 항목에서만, 근거 문구를 유지하여 나온다",()=>{
  const steps=build([{kind:"required",status:"미충족",text:"정보보호 취약점 점검"}],[],"");
  const items=planTasks(steps);
  assert.deepEqual(items.map(x=>x.category),["학습","프로젝트"]);
  assert.ok(items.every(x=>x.priority===1&&x.requirement==="정보보호 취약점 점검"));
  assert.match(items[1].detail,/실무경력의 대체가 아닙니다/);
});
test("경력 연차 조건은 실습과 자격증으로 대체하지 않고 지원 준비만 안내",()=>{
  const items=planTasks(build([{kind:"required",status:"미충족",text:"엔드포인트 솔루션 유지관리 실무 경력 3년 이상"}],[],""));
  assert.deepEqual(items.map(x=>x.category),["지원 준비"]);
  assert.match(items[0].detail,/실습이나 자격증/);
});
test("확인 필요면 학습 강요 없이 먼저 채용요건 확인, 충족이면 증빙만 준비",()=>{
  const items=planTasks(build([
    {kind:"required",status:"확인 필요",text:"보안 점검"},
    {kind:"preferred",status:"충족",text:"SQL 데이터베이스 설계"}
  ],[],""));
  assert.deepEqual(items.map(x=>x.category),["지원 준비","지원 준비"]);
  assert.match(items[0].detail,/채용담당자/);
  assert.match(items[1].title,/증빙|근거/);
});
test("공고 명시 자격증과 단순 관련 자격증은 구분하여 검증 할 일로 제시",()=>{
  const catalog=[
    {id:1,name:"정보보안기사",aliases:"정보보안기사",verification_status:"needs_official_review"},
    {id:7,name:"CPPG",aliases:"CPPG",field:"개인정보보호",skills:"개인정보보호",verification_status:"needs_official_review"}
  ];
  const steps=build([
    {kind:"required",status:"미충족",text:"정보보안기사 취득"},
    {kind:"preferred",status:"부분 충족",text:"개인정보보호 업무 이해"}
  ],catalog,"");
  const items=planTasks(steps);
  assert.ok(items.some(t=>t.category==="자격증"&&t.title.includes("공고 명시 자격 확인: 정보보안기사")));
  assert.ok(items.some(t=>t.category==="자격증"&&t.title.includes("관련 자격 참고 검토: CPPG")));
  assert.ok(!items.some(t=>/정보보안기사/.test(t.title)&&t.title.includes("프로젝트")));
});
test("완료 체크는 사용자 진행 기록일 뿐, 상태를 바꾸지 않고 집계된다",()=>{
  const steps=build([{kind:"required",status:"미충족",text:"네트워크 보안 점검"}],[],"");
  const items=planTasks(steps);
  const set=new Set([items[0].id]);
  const stats=taskCounts(items,set);
  assert.equal(stats.total,2);
  assert.equal(stats.done,1);
  assert.equal(stats.byCategory["학습"].done,1);
  assert.equal(stats.byCategory["프로젝트"].total,1);
  assert.deepEqual(taskCategories,["학습","프로젝트","자격증","지원 준비"]);
  assert.equal(steps[0].status,"미충족");
});
test("복사 텍스트에 선택 상태, 공고 원문, 작업 내용이 포함되고 서버 저장 없음",()=>{
  const items=planTasks(build([{kind:"required",status:"부분 충족",text:"네트워크 보안 점검"}],[],""));
  const output=formatChecklist(items,new Set([items[0].id]));
  assert.ok(output.includes("- [x]"));
  assert.ok(output.includes("- [ ]"));
  assert.match(output,/네트워크 보안 점검/);
  assert.match(output,/공식 검증 전/);
  for(const cat of taskCategories)assert.ok(output.includes("["+cat+"]"));
});
test("자격증 취득만 요구하는 문장에는 프로젝트를 잘못 생성하지 않는다",()=>{
  const steps=build([{kind:"required",status:"미충족",text:"정보보안기사 자격증 취득"}],
    [{id:1,name:"정보보안기사",aliases:"정보보안기사",verification_status:"needs_official_review"}],"");
  const tasks=planTasks(steps);
  assert.deepEqual(tasks.map(x=>x.category),["자격증"]);
  assert.match(tasks[0].title,/정보보안기사/);
});
test("잘못된 작업 입력 거부, 빈 작업에도 카테고리는 유지",()=>{
  assert.throws(()=>planTasks(null),TypeError);
  const empty=taskCounts([],new Set());
  assert.equal(empty.total,0);
  assert.equal(empty.byCategory["지원 준비"].total,0);
});

test("정보처리기사 or 정보보안기사는 동시에 필요한 두 작업이 아니라 택1 작업",()=>{
  const catalog=[
    {id:1,name:"정보보안기사",aliases:"정보보안기사",verification_status:"needs_official_review"},
    {id:2,name:"정보처리기사",aliases:"정보처리기사",verification_status:"needs_official_review"}
  ];
  const text="학력 : 초대졸 이상 (정보통신 비전공자 및 초대졸의 경우, 정보처리기사 or 정보보안기사 자격증 보유 必)";
  const steps=build([{kind:"required",status:"확인 필요",text,line:13}],catalog,"정보처리기사");
  assert.deepEqual(steps[0].alternativeCertGroups,[["정보처리기사","정보보안기사"]]);
  assert.equal(steps[0].certificates.length,2);
  assert.equal(steps[0].certificates.find(x=>x.name==="정보처리기사").heldClaim,true);
  const certTasks=planTasks(steps).filter(x=>x.category==="자격증");
  assert.equal(certTasks.length,1);
  assert.match(certTasks[0].title,/\(택1\).*정보처리기사 또는 정보보안기사/);
  assert.match(certTasks[0].detail,/전공·학력/);
  const output=formatChecklist(planTasks(steps),new Set());
  assert.equal((output.match(/공고 명시 자격 확인/g)||[]).length,1);
});

test("공고에서 자격증 두 개를 쉼표로 나열하면 택1이라고 임의 판단하지 않는다",()=>{
  const catalog=[
    {id:1,name:"정보보안기사",aliases:"정보보안기사",verification_status:"needs_official_review"},
    {id:2,name:"정보처리기사",aliases:"정보처리기사",verification_status:"needs_official_review"}
  ];
  const steps=build([{kind:"preferred",status:"확인 필요",text:"정보처리기사, 정보보안기사 우대"}],catalog,"");
  assert.deepEqual(steps[0].alternativeCertGroups,[]);
  assert.equal(planTasks(steps).filter(x=>x.category==="자격증").length,2);
});

test("또는으로 연결된 대체 자격과 별도 요건의 자격은 구분한다",()=>{
  const catalog=[
    {id:1,name:"정보보안기사",aliases:"정보보안기사",verification_status:"needs_official_review"},
    {id:2,name:"정보처리기사",aliases:"정보처리기사",verification_status:"needs_official_review"}
  ];
  const steps=build([
    {kind:"required",status:"확인 필요",text:"정보처리기사 또는 정보보안기사 자격증 보유"},
    {kind:"preferred",status:"확인 필요",text:"정보보안기사 자격 보유자 우대"}
  ],catalog,"");
  const tasks=planTasks(steps).filter(x=>x.category==="자격증");
  assert.equal(tasks.length,2);
  assert.match(tasks[0].title,/택1/);
  assert.equal(tasks[1].title,"공고 명시 자격 확인: 정보보안기사");
});
