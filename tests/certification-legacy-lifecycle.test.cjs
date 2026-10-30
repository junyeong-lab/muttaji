"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const db=require("../data/certifications.json");
const {recommend}=require("./load-browser-module.cjs")("../assets/certification-recommendations.js");
const newItems=db.certifications.slice(67);
test("기존 67개 유지 · 새로운 9개 현행/검색용 등록",()=>{
 assert.equal(db.count,76);
 assert.equal(newItems.length,9);
 assert.deepEqual(newItems.map(x=>x.id),[68,69,70,71,72,73,74,75,76]);
 assert.ok(newItems.every(x=>x.verification_status==="needs_official_review"&&x.source_url.startsWith("https://")));
 assert.equal(newItems.filter(x=>x.recommendable===false).length,3);
});
test("여섯 검색어는 DB에서 검색 가능",()=>{
 for(const word of ["OCA","OCPJP","OCWCD","LPIC","SCAP","SCBP"]){
   const found=db.certifications.filter(x=>[x.name,x.aliases,x.description].join(" ").toLowerCase().includes(word.toLowerCase()));
   assert.ok(found.length,word);
 }
});
test("과거 시험·미특정 자격군은 공고에 직접 나오더라도 추천하지 않음",()=>{
 for(const legacy of ["OCA","OCPJP","OCWCD","Oracle Certified Web Component Developer"]){
  const results=recommend(db.certifications,{posting:"자격증 우대 "+legacy,preferred:[legacy]});
  assert.ok(results.every(x=>!["OCA (Oracle Certified Associate) · 자격군","OCPJP (Oracle Certified Professional Java Programmer) · 구 명칭","OCWCD (Oracle Certified Web Component Developer) · 종료 시험"].includes(x.name)),legacy);
 }
});
test("현행 SAS·LPIC·Java SE 25 시험은 직접 명시되면 추천 가능",()=>{
 for(const [input,target] of [["SCBP","SAS Certified Specialist: Base Programming Using SAS 9.4"],["SCAP","SAS Certified Professional: Advanced Programming Using SAS 9.4"],["LPIC-1","LPIC-1"],["Java SE 25 Developer Professional","Oracle Certified Professional: Java SE 25 Developer"]]){
  const results=recommend(db.certifications,{posting:"자격증 우대 "+input,preferred:[input]});
  assert.ok(results.some(x=>x.name===target&&x.explicit),input);
 }
});
