"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const db=require("../data/certifications.json");
const byName=s=>db.certifications.find(x=>x.name===s);
test("업로드 엑셀의 40개 자격 유형 반영·종료된 두 항목 복원 금지",()=>{
 assert.equal(db.count,74);assert.equal(db.classification_review.applied_rows,40);
 assert.equal(db.certifications.filter(x=>x.classification_source).length,40);
 for(const removed of ["OCPJP","OCWCD"])assert.ok(!db.certifications.some(x=>x.name.startsWith(removed)));
 assert.equal(byName("정보시스템감리사").type,"국가공인 민간자격");
 assert.equal(byName("CSTS 일반등급 (Foundation Level)").type,"국가공인 민간자격");
 assert.equal(byName("컴퓨터활용능력 1급").type,"국가기술자격");
 assert.equal(byName("AI활용능력 서비스기획 전문가").type,"등록 민간자격");
 assert.equal(byName("AI활용능력 프롬프트엔지니어 1급").type,"등록 민간자격");
 assert.equal(byName("PCCP").type,"구분 미확인");
});
test("ISO17024 인정 확인은 한국의 국가공인과 구분하고 출처를 남김",()=>{
 for(const name of ["CISA","CISM","CIPP/E","CCSP","CEH"]){
  const item=byName(name);
  assert.match(item.classification_ansi_iso17024,/인정 확인/);
  assert.ok(item.classification_ansi_source_url.startsWith("https://"));
  assert.match(item.type,/국제/);
 }
 for(const name of ["Cisco CCNP","Cisco CCIE","LPIC-1"]){
  assert.equal(byName(name).classification_ansi_iso17024,"확인 못함");
  assert.equal(byName(name).classification_status,"추가 확인 필요");
 }
});
test("신뢰도 분리 및 2026 종목명 변경 사항 표시",()=>{
 assert.equal(byName("정보처리기능사").type,"국가기술자격");
 assert.match(byName("정보처리기능사").classification_note,/프로그래밍기능사/);
 assert.ok(db.certifications.every(x=>["verified","needs_official_review","needs_correction"].includes(x.verification_status)));
 assert.equal(byName("정보시스템감리사").classification_proposed,"국가자격(법정 전문자격)");
});
