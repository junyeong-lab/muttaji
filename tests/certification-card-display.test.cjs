"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const db=require("../data/certifications.json");
const html=fs.readFileSync(path.join(__dirname,"../index.html"),"utf8");
test("OCA의 표시명은 짧게, 종류는 국제 벤더 인증으로 분리",()=>{
 const cert=db.certifications.find(x=>x.name==="OCA");
 assert.ok(cert);
 assert.equal(cert.type,"국제·벤더 자격");
 assert.equal(cert.id,73);
 assert.match(cert.aliases,/Oracle Certified Associate/);
 assert.match(cert.classification_source_url,/oracle\.com/);
 assert.equal(cert.recommendable,false); // 등급을 특정 시험으로 오판해 추천하지 않음
 assert.equal(db.count,74);
 assert.ok(!db.certifications.some(x=>x.name.includes("· 자격군")));
});
test("ISO 심사원·OCA 세부 인증 경고 배지는 미노출, 설명은 유지",()=>{
 assert.ok(!html.includes('meta.appendChild(el("span","","세부 인증 확인 필요"))'));
 assert.ok(!html.includes('세부 시험 확인 필요 · 취득 추천 제외'));
 assert.ok(html.includes('item.classification_status==="세부 자격 확인 필요"?"cert-detail-note":""'));
 for(const name of ["ISO/IEC 27001 심사원","ISO/IEC 42001 심사원","OCA"]){
  const cert=db.certifications.find(x=>x.name===name);
  assert.ok(cert.classification_note);
  assert.equal(cert.classification_status,"세부 자격 확인 필요");
 }
});