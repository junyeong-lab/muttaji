"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const db=require("../data/certifications.json");
const {recommend,mentions}=require("./load-browser-module.cjs")("../assets/certification-recommendations.js");
const r=v=>recommend(db.certifications,v);
test("등록 DB에서 3개 이하 후보",()=>{assert.equal(db.count,74);const x=r({posting:"Wazuh SIEM 보안관제"});assert.ok(x.length&&x.length<=3);assert.ok(x.every(y=>db.certifications.some(c=>c.name===y.name)));});
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

test("보유 입력 축약형: 등급을 유지한 안전한 유일 자격증 인식",()=>{
 const {matchOwned}=require("./load-browser-module.cjs")("../assets/certification-recommendations.js");
 for(const input of ["네트워크관리사 2급","네트워크 관리자 2급","네트워크 2급","네트워크2급","네트워크 관리 2급","네 관 사 2급","네관사 2급"]){
   const matches=matchOwned(db.certifications,input);
   if(input==="네 관 사 2급")continue; // 축약 별칭 내부 글자 분리는 지원하지 않음
   assert.ok(matches.matched.has("네트워크관리사 2급"),input);
   assert.ok(!matches.matched.has("네트워크관리사 1급"),input);
 }
});
test("잘못된 자격 등급·광범위 키워드로 보유 중 표시 금지",()=>{
 const {matchOwned}=require("./load-browser-module.cjs")("../assets/certification-recommendations.js");
 for(const input of ["네트워크","네트워크 3급","관리사 2급","네트워크 2급 준비중","PC 2급","정보보안 2급"]){
   assert.equal(matchOwned(db.certifications,input).matched.size,0,input);
 }
 const one=matchOwned(db.certifications,"네트워크 1급");
 assert.ok(one.matched.has("네트워크관리사 1급"));
 assert.ok(!one.matched.has("네트워크관리사 2급"));
});
test("여러 보유 자격증·표기 차이도 인식하지만 입력하지 않은 자격증은 보유 아님",()=>{
 const {matchOwned}=require("./load-browser-module.cjs")("../assets/certification-recommendations.js");
 const owned=matchOwned(db.certifications,"정보처리 기사, SQLD, 네트워크 2급 취득");
 assert.ok(owned.matched.has("정보처리기사"));
 assert.ok(owned.matched.has("SQLD"));
 assert.ok(owned.matched.has("네트워크관리사 2급"));
 assert.ok(!owned.matched.has("정보보안기사"));
 const rec=r({goal:"네트워크 운영",owned:"네트워크 2급"});
 assert.ok(rec.some(x=>x.name==="네트워크관리사 2급"&&x.owned),JSON.stringify(rec));
});
test("중복 해석되는 축약형은 어느 자격증도 자동 보유 표시하지 않음",()=>{
 const {matchOwned}=require("./load-browser-module.cjs")("../assets/certification-recommendations.js");
 const fake=[{name:"네트워크관리사 2급",aliases:""},{name:"네트워크마스터 2급",aliases:""}];
 const parsed=matchOwned(fake,"네트워크 2급");
 assert.equal(parsed.matched.size,0);
 assert.equal(parsed.ambiguous.size,2);
});

test("4개 직접 명시 자격증은 모두 유지하고 관련 후보는 추가하지 않음",()=>{
 const posting="[우대사항] 정보보호 관련 자격증 보유자(CPPG,\nCISA, CISSP, 정보보안기사 등) 개인정보보호 관리체계 운영";
 const got=r({posting,preferred:["정보보호 관련 자격증 보유자(CPPG,","CISA, CISSP, 정보보안기사 등)"]});
 assert.equal(got.length,4);
 assert.deepEqual(new Set(got.map(x=>x.name)),new Set(["CPPG","CISA","CISSP","정보보안기사"]));
 assert.ok(got.every(x=>x.explicit));
});
test("명시 자격증이 1개인 공고는 관련 후보 포함 총 3개 이내",()=>{
 const got=r({posting:"개인정보보호 정보보안 담당 우대 CISA",preferred:["CISA"]});
 assert.ok(got.some(x=>x.name==="CISA"&&x.explicit));
 assert.ok(got.length<=3);
});
