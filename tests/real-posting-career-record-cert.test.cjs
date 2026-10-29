const test = require("node:test");
const assert = require("node:assert/strict");
const {credentialSuggestion} = require("./load-browser-module.cjs")("../assets/requirement-comparison.js");

test("certificate-only preference includes the career record book label without requiring work experience",()=>{
  const item={kind:"preferred",text:"자격증: 정보처리기사, 정보통신기사, 정보통신기술자 경력수첩"};
  const good=credentialSuggestion(item,"정보처리기사; SQLD");
  assert.equal(good?.status,"충족");
  assert.deepEqual(good?.names,["정보처리기사"]);
  assert.equal(credentialSuggestion(item,"SQLD"),null);
  assert.equal(credentialSuggestion({...item,text:item.text+" 및 실무경력 3년 이상"},"정보처리기사"),null);
});
