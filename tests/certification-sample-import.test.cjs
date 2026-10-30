"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),db=require("../data/certifications.json");
test("2026 IT 공고 표본 추가 항목: 기존 34개 보존 및 검토 상태 구분",()=>{
 assert.equal(db.count,74);
 assert.deepEqual(db.certifications.map(x=>x.id),Array.from({length:db.count},(_,i)=>i+1));
 assert.equal(new Set(db.certifications.map(x=>x.name.normalize("NFKC").toLowerCase().replace(/\s+/g,""))).size,db.count);
 assert.equal(db.certifications.slice(0,34).filter(x=>x.verification_status==="verified").length,34);
 assert.ok(db.certifications.slice(34).every(x=>x.verification_status==="needs_official_review"));
 assert.ok(db.certifications.slice(34).every(x=>x.source_url.startsWith("https://")));
 assert.ok(db.certifications.some(x=>x.name==="CISA"&&x.posting_sample_count===25));
 assert.ok(db.certifications.some(x=>x.name==="CISM"&&x.posting_sample_count===7));
 assert.ok(db.certifications.some(x=>x.name==="Cisco CCNP"&&x.type.includes("자격군")));
 assert.ok(db.certifications.some(x=>x.name==="AWS Certified CloudOps Engineer - Associate"&&x.posting_sample_count===0));
 assert.ok(!db.certifications.some(x=>x.name==="SIS 1급"||x.name==="전자계산기기사"||x.name==="정보보안기술사"));
 assert.equal(db.posting_sample.raw_distinct_labels,74);
});