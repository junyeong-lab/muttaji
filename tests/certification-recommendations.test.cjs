"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const db=require("../data/certifications.json");
const {recommend,mentions}=require("./load-browser-module.cjs")("../assets/certification-recommendations.js");
const r=v=>recommend(db.certifications,v);
test("등록 DB에서 3개 이하 후보",()=>{assert.equal(db.count,67);const x=r({posting:"Wazuh SIEM 보안관제"});assert.ok(x.length&&x.length<=3);assert.ok(x.every(y=>db.certifications.some(c=>c.name===y.name)));});
test("명시된 보유 자격증 우선",()=>{const x=r({posting:"필수 정보보안기사",required:["정보보안기사"],owned:"정보보안기사"});assert.equal(x[0].name,"정보보안기사");assert.equal(x[0].owned,true);assert.equal(x[0].explicit,true);});
test("Azure에 AWS 전용 자격증 후보 없음",()=>{const x=r({posting:"Azure RBAC 운영"});assert.ok(x.some(y=>y.name.includes("Azure Fundamentals")));assert.ok(x.every(y=>!y.name.startsWith("AWS")));});
test("개인정보보호 직무 CPPG, SQLD 직접 명시",()=>{assert.ok(r({goal:"개인정보보호 담당자"}).some(y=>y.name==="CPPG"));assert.ok(r({posting:"SQLD 보유",preferred:["SQLD"]}).some(y=>y.name==="SQLD"&&y.explicit));});
test("빈 조건과 잘못된 약어는 대응하지 않음",()=>{assert.deepEqual(r({}),[]);assert.equal(mentions("SQLDP","SQLD"),false);assert.equal(mentions("AWS IAM","AWS"),true);});

test("개인정보보호 문구로 일반 정보보안 자격이 과대 연결되지 않음",()=>{const a=r({goal:"개인정보보호 담당자"});assert.equal(a[0].name,"CPPG");const b=r({posting:"개인정보보호 담당",goal:"정보보안 담당자"});assert.equal(b[0].name,"CPPG");});

test("명시되지 않은 정보보안 기사·산업기사 동일 계열은 한 개만 노출",()=>{
  const got=r({posting:"Wazuh SIEM 보안관제, 정보보안 운영 및 네트워크 보안"});
  const family=got.filter(x=>["정보보안기사","정보보안산업기사"].includes(x.name));
  assert.equal(family.length,1);
  assert.ok(got.length>=2&&got.length<=3);
  assert.equal(new Set(got.map(x=>x.name)).size,got.length);
});
test("두 자격증이 모두 직접 명시된 경우에는 생략하지 않음",()=>{
  const got=r({
    posting:"필수 정보보안기사 또는 정보보안산업기사",
    required:["정보보안기사 또는 정보보안산업기사"],
    owned:"정보보안기사"
  });
  assert.ok(got.some(x=>x.name==="정보보안기사"&&x.explicit&&x.owned));
  assert.ok(got.some(x=>x.name==="정보보안산업기사"&&x.explicit&&!x.owned));
});
test("추천 이유에 출처·실제 DB 학습 내용이 있으며 공고 명시와 연관 후보를 구분",()=>{
  const job=r({posting:"Wazuh SIEM 보안관제"});
  assert.ok(job[0].reason.includes("채용공고"));
  assert.ok(job[0].reason.includes("DB 수록 학습 내용"));
  assert.ok(job[0].reason.includes("취득을 요구했다는 뜻은 아닙니다"));
  assert.match(job[0].possessionLabel,/추가 검토/);
  const direct=r({posting:"필수 정보처리기사",required:["정보처리기사"],owned:"정보처리기사"});
  assert.equal(direct[0].name,"정보처리기사");
  assert.match(direct[0].reason,/직접 찾았습니다/);
  assert.match(direct[0].possessionLabel,/보유 입력됨/);
});
test("보유 입력 여부는 판정과 무관하고 본인이 직접 입력한 경우에만 표현",()=>{
  const input="네트워크관리사 2급";
  const a=r({posting:"필수 "+input,required:[input],owned:""});
  const b=r({posting:"필수 "+input,required:[input],owned:input});
  assert.equal(a[0].owned,false);
  assert.match(a[0].possessionLabel,/미확인/);
  assert.equal(b[0].owned,true);
  assert.match(b[0].possessionLabel,/증빙 별도/);
});
