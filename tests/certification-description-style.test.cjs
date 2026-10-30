"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const db=require("../data/certifications.json");
test("자격증 설명 74개가 간결한 명사형 문구로 표시",()=>{
 assert.equal(db.count,74);
 assert.equal(db.description_review.updated_count,40);
 for(const item of db.certifications){
  assert.doesNotMatch(item.description,/입니다|습니다|하세요|분야에 관련된 자격·인증|채용공고에서 명칭이 사용된 자격군/);
  assert.doesNotMatch(item.description,/[.!。]$/);
  assert.ok(!item.description.startsWith(item.name+": "));
 }
});
test("CIPP/E 표기와 역사적 인증의 제한 사항 유지",()=>{
 assert.equal(db.certifications.find(x=>x.name==="CIPP/E").description,"유럽 개인정보보호법과 GDPR, 개인정보 처리 및 국경 간 이전 규정에 대한 이해를 평가하는 IAPP의 국제 자격");
 for(const keyword of ["OCA"]){
  const cert=db.certifications.find(x=>x.name===keyword);
  assert.equal(cert.recommendable,false);
 }
});