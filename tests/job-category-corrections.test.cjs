"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {analyze}=require("./load-browser-module.cjs")("../assets/job-text-analyzer.js");
const {headingType,reclassify}=require("./load-browser-module.cjs")("../assets/job-category-corrections.js");
const {requirements}=require("./load-browser-module.cjs")("../assets/requirement-comparison.js");

test("숫자·로마숫자·가나다 번호가 붙은 우대사항은 제목으로 인식한다",()=>{
  for(const heading of ["우대사항","Ⅱ. 우대사항","2) 우대 사항","나. 우대사항","◆ 우대사항","[우대사항]"]){
    const result=analyze("[자격요건]\nㆍ 학력 초대졸 이상\n"+heading+"\nㆍ ISMS-P 심사원");
    assert.equal(result.required.length,1,heading);
    assert.equal(result.preferred.length,1,heading);
    assert.equal(result.preferred[0].text,"ISMS-P 심사원",heading);
    assert.equal(result.unresolved.length,0,heading);
  }
});

test("미인식 우대사항 제목을 수정하면 아래 항목 모두 이동하고 다시 원복된다",()=>{
  const posting=analyze("[자격요건]\nㆍ 학력 초대졸 이상\nㆍ 경력 3년\n우대사함\nㆍ ISMS-P 심사원\nㆍ 개인정보영향평가 전문인력\nㆍ 클라우드 운영 경험");
  // OCR error means 우대사함 is still a required-list item; verify the reviewer
  // can explicitly reclassify a region beginning at the nearest available row.
  const first=posting.required.find(x=>x.text==="우대사함");
  assert.ok(first);
  assert.equal(posting.required.length,6);
  const moved=reclassify(posting,first,"preferred","section");
  assert.equal(moved.scope,"section");
  assert.equal(posting.required.length,2);
  assert.equal(posting.preferred.length,4);
  assert.deepEqual(posting.preferred.map(x=>x.line),[4,5,6,7]);
  const reversed=reclassify(posting,first,"required","section");
  assert.equal(reversed.scope,"section");
  assert.equal(posting.required.length,6);
  assert.equal(posting.preferred.length,0);
  assert.deepEqual(posting.required.map(x=>x.line),[2,3,4,5,6,7]);
});

test("명시적 제목을 수정할 때 제목 자체는 비교 요건에 포함하지 않는다",()=>{
  const result=analyze("[자격요건]\nㆍ 경력 3년");
  const marker={text:"우대사항",line:3,endLine:3,source:"우대사항",sectionLine:1};
  result.required.push(marker);
  const preferred={text:"개인정보영향평가 전문인력",line:4,endLine:4,source:"ㆍ 개인정보영향평가 전문인력",sectionLine:1};
  result.required.push(preferred);
  assert.equal(headingType(marker.text),"preferred");
  const moved=reclassify(result,marker,"preferred","single");
  assert.equal(moved.scope,"section");
  assert.equal(result.preferred.length,2);
  assert.equal(requirements("test",{analyze:()=>result}).length,2); // original 경력 + preferred candidate
  reclassify(result,marker,"required","single");
  assert.equal(requirements("test",{analyze:()=>result}).length,2);
});
test("다음에 등장하는 명시적인 다른 구간은 대량 변경에서 보호한다",()=>{
  const posting=analyze("[자격요건]\nㆍ 자격 A\nㆍ 우대사함\nㆍ 심사원\n[담당업무]\nㆍ 서비스 운영\n[우대사항]\nㆍ 정보처리기사");
  const marker=posting.required.find(x=>x.text==="우대사함");
  reclassify(posting,marker,"preferred","section");
  assert.equal(posting.preferred.length,3);
  assert.equal(posting.responsibilities.length,1);
  assert.equal(posting.required.length,1);
  assert.equal(posting.preferred.find(x=>x.text==="정보처리기사").line,8);
});
test("일반 항목만 변경하면 구간 전체에 영향이 없다",()=>{
  const result=analyze("[자격요건]\nㆍ 실무경력\nㆍ ISMS-P 자격\nㆍ 개인정보 전공");
  const item=result.required[1];
  const moved=reclassify(result,item,"preferred","single");
  assert.equal(moved.moved,1);
  assert.equal(result.required.length,2);
  assert.equal(result.preferred.length,1);
});
