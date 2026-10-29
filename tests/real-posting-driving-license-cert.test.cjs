const test=require("node:test");
const assert=require("node:assert/strict");
const {credentialSuggestion}=require("./load-browser-module.cjs")("../assets/requirement-comparison.js");

test("a named driver license in a preferred list must not block matching an owned certificate",()=>{
  const item={kind:"preferred",text:"자격증: 정보처리기사, 정보처리산업기사, 2종보통운전면허(오토)"};
  assert.deepEqual(credentialSuggestion(item,"정보처리기사")?.names,["정보처리기사"]);
  assert.equal(credentialSuggestion(item,"SQLD"),null);
  assert.equal(credentialSuggestion({...item,text:item.text+" 및 관련 경력 3년 이상"},"정보처리기사"),null);
});
