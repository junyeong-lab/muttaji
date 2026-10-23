"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const html=fs.readFileSync(path.join(__dirname,"..","index.html"),"utf8");

test("앱에서 내장 이미지 업로드 폼과 OCR 실행 버튼을 제공하지 않는다",()=>{
  for(const marker of ['id="job-file"','id="ocr-button"','id="ocr-review"','id="ocr-mode"','id="job-preview"']){
    assert.equal(html.includes(marker),false,marker);
  }
  assert.equal(html.includes('type="file"'),false);
  assert.match(html,/id="job-text"/);
});
test("사용하지 않는 내장 OCR 라이브러리는 로딩하지 않는다",()=>{
  for(const script of ["assets/image-ocr.js","assets/ocr-image-preprocess.js","assets/ocr-column-review.js","tesseract.min.js"]){
    assert.equal(html.includes('<script src="./'+script+'">'),false,script);
  }
});
test("Windows PowerToys 별도 설치 및 기본 단축키와 캡처 도구의 차이를 명시한다",()=>{
  assert.match(html,/PowerToys란\?/);
  assert.match(html,/Text Extractor\(텍스트 추출기\)/);
  assert.match(html,/한 번 설치/);
  assert.match(html,/기본 설치된 기능은 아닙니다/);
  assert.match(html,/Win<\/kbd> \+ <kbd>Shift<\/kbd> \+ <kbd>T/);
  assert.match(html,/텍스트 작업/);
});
test("외부 비전 AI를 사용하더라도 원문 대조·개인정보 주의·판독 불가 안내를 유지",()=>{
  assert.match(html,/https:\/\/chatgpt.com\//);
  assert.match(html,/https:\/\/claude.ai\//);
  assert.match(html,/\[판독 불가\]/);
  assert.match(html,/개인정보/);
  assert.match(html,/원본과 대조/);
});
test("텍스트 분류 기능 스크립트가 남아 있고 삭제된 이미지 요소를 참조하지 않는다",()=>{
  const match=html.match(/<script>\s*([\s\S]*?)<\/script>/);
  assert.ok(match);
  assert.doesNotThrow(()=>new Function(match[1]));
  for(const bad of ["jobFile","hasImage","window.MuttajiOcrImage","job-preview","ocr-button"]){
    assert.equal(match[1].includes(bad),false,bad);
  }
  assert.match(html,/assets\/job-category-corrections.js/);
  assert.match(html,/assets\/requirement-comparison.js/);
  assert.match(html,/assets\/roadmap-builder.js/);
});
