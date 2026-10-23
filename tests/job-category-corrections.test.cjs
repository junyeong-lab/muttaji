"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {analyze}=require("../assets/job-text-analyzer.js");
const {reclassify}=require("../assets/job-category-corrections.js");
const {requirements}=require("../assets/requirement-comparison.js");

test("숫자·로마숫자·가나다 번호가 붙은 우대사항은 기존 파서에서 그대로 인식",()=>{
  for(const heading of ["우대사항","Ⅱ. 우대사항","2) 우대 사항","나. 우대사항","◆ 우대사항","[우대사항]"]){
    const result=analyze("[자격요건]\nㆍ 학력 초대졸 이상\n"+heading+"\nㆍ ISMS-P 심사원");
    assert.equal(result.required.length,1,heading);
    assert.equal(result.preferred.length,1,heading);
    assert.equal(result.preferred[0].text,"ISMS-P 심사원",heading);
    assert.equal(result.unresolved.length,0,heading);
  }
});

test("한 항목을 바꾸면 바로 다음 같은 영역의 항목은 이동하지 않는다",()=>{
  const posting=analyze("[자격요건]\nㆍ 경력 3년\nㆍ ISMS-P 심사원\nㆍ 개인정보전문가");
  const target=posting.required[1];
  const adjacent=posting.required[2];
  const moved=reclassify(posting,target,"preferred");
  assert.deepEqual(moved,{moved:1,scope:"single"});
  assert.equal(posting.required.length,2);
  assert.equal(posting.preferred.length,1);
  assert.equal(posting.required[1],adjacent);
  assert.equal(posting.preferred[0],target);
  assert.equal(target.manualReviewed,true);
  assert.equal(adjacent.manualReviewed,undefined);
});

test("과거 구간 적용 인자를 실수로 넘겨도 일괄 이동은 실행되지 않는다",()=>{
  const posting=analyze("기타\nES기술부\n대리\n과장\nㆍ EDR/AV 구축\nㆍ EDR/AV 유지보수");
  const target=posting.unresolved.find(x=>x.text==="EDR/AV 구축");
  assert.ok(target);
  const sibling=posting.unresolved.find(x=>x.text==="EDR/AV 유지보수");
  const moved=reclassify(posting,target,"responsibilities","section");
  assert.deepEqual(moved,{moved:1,scope:"single"});
  assert.equal(posting.responsibilities.length,1);
  assert.ok(posting.unresolved.includes(sibling));
});

test("오인식 우대 제목도 해당 한 항목만 수정되고 아래 요건은 이동하지 않는다",()=>{
  const posting=analyze("[자격요건]\nㆍ 경력 3년\n우대사함\nㆍ 심사원\nㆍ 프로젝트 경험");
  const marker=posting.required.find(x=>x.text==="우대사함");
  assert.ok(marker);
  const before=posting.required.slice();
  const moved=reclassify(posting,marker,"preferred");
  assert.equal(moved.moved,1);
  assert.equal(posting.preferred.length,1);
  assert.equal(posting.required.length,before.length-1);
  assert.equal(posting.required[0].text,"경력 3년");
  assert.deepEqual(posting.required.map(x=>x.text),["경력 3년","심사원","프로젝트 경험"]);
});

test("분류를 되돌릴 때에도 선택 항목만 복귀하며 원래 순서가 유지된다",()=>{
  const result=analyze("담당업무\nㆍ 보안 로그 점검\nㆍ EDR/AV 운영\nㆍ 취약점 확인\n우대사항\nㆍ ISMS-P 교육");
  const target=result.responsibilities[1];
  reclassify(result,target,"preferred");
  assert.deepEqual(result.responsibilities.map(x=>x.text),["보안 로그 점검","취약점 확인"]);
  assert.equal(result.preferred.length,2);
  reclassify(result,target,"responsibilities");
  assert.deepEqual(result.responsibilities.map(x=>x.text),["보안 로그 점검","EDR/AV 운영","취약점 확인"]);
  assert.equal(result.preferred.length,1);
  assert.equal(requirements("test",{analyze:()=>result}).length,1);
});

test("같은 분류 선택 시 수정 표시를 새로 추가하지 않는다",()=>{
  const result=analyze("필수조건\nㆍ 경력 3년\nㆍ 정보보안기사");
  const unchanged=result.required[0];
  const move=reclassify(result,unchanged,"required");
  assert.deepEqual(move,{moved:0,scope:"single"});
  assert.equal(result.required.length,2);
  assert.equal(unchanged.manualReviewed,undefined);
});

test("잘못된 분류나 결과에 없는 항목은 거절하고 원본을 보존한다",()=>{
  const result=analyze("필수조건\nㆍ 경력 3년");
  const item=result.required[0];
  assert.throws(()=>reclassify(result,item,"unknown"),TypeError);
  assert.throws(()=>reclassify(result,{text:"없는 항목"},"preferred"),Error);
  assert.equal(result.required.length,1);
  assert.equal(result.preferred.length,0);
});
