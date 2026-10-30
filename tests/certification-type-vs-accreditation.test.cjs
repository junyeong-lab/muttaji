"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const db=require("../data/certifications.json");
const byName=s=>db.certifications.find(x=>x.name===s);
test("유형 구분과 국제 인정 확인 상태 분리",()=>{
 assert.equal(db.count,74);
 const classified=db.certifications.filter(x=>x.classification_source);
 assert.equal(classified.length,40);
 const counts=Object.fromEntries([...new Set(classified.map(x=>x.classification_status))].map(k=>[k,classified.filter(x=>x.classification_status===k).length]));
 assert.equal(counts["공식자료 확인"],14);
 assert.equal(counts["유형 분류됨"],23);
 assert.equal(counts["세부 자격 확인 필요"],3);
 assert.ok(!counts["국가공인 여부 확인 필요"]);
 for(const name of ["Cisco CCNP","LPIC-1","AWS Certified Developer - Associate","무선설비기사","사회조사분석사 2급"]){
   const c=byName(name);
   assert.equal(c.classification_status,"유형 분류됨",name);
 }
 assert.equal(byName("Cisco CCNP").classification_ansi_iso17024,"확인 못함");
});
test("실제 미확인 상태만 별도로 안내",()=>{
 for(const name of ["ISO/IEC 27001 심사원","ISO/IEC 42001 심사원","OCA (Oracle Certified Associate) · 자격군"]){
  assert.equal(byName(name).classification_status,"세부 자격 확인 필요");
 }
 const c=byName("PCCP");
 assert.equal(c.type,"등록 민간자격");
 assert.equal(c.classification_status,"유형 분류됨");
 assert.match(c.classification_source_url,/^https:\/\/programmers\.co\.kr\//);
 assert.match(c.classification_note,/2022년 6월 13일/);
 assert.ok(!db.certifications.some(x=>x.classification_status==="추가 확인 필요"));
});
test("이전 공인 등급·인정 자료 및 기초 검증 상태 유지",()=>{
 for(const name of ["CISA","CISM","CIPP/E","CCSP","CEH"]){
  const x=byName(name);assert.equal(x.classification_status,"공식자료 확인");assert.match(x.classification_ansi_iso17024,/인정 확인/);
 }
 assert.equal(byName("정보시스템감리사").type,"국가공인 민간자격");
 assert.equal(byName("CSTS 일반등급 (Foundation Level)").type,"국가공인 민간자격");
 assert.equal(byName("정보처리기능사").name,"정보처리기능사");
 for(const name of ["OCPJP","OCWCD"])assert.ok(!db.certifications.some(x=>x.name.startsWith(name)));
});