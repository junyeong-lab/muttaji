"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
test("image upload and OCR UI stay removed while link and agent integrations remain",()=>{
 const html=fs.readFileSync(path.join(__dirname,"../index.html"),"utf8");
 assert.doesNotMatch(html,/<input[^>]+type=["']file["']/i);
 for(const marker of ['id="job-file"','id="ocr-button"','id="ocr-review"','assets/image-ocr.js','assets/ocr-image-preprocess.js','assets/ocr-column-review.js'])assert.ok(!html.includes(marker),marker);
 assert.match(html,/PowerToys/);
 assert.match(html,/Win\s*\+\s*Shift\s*\+\s*T/);
 assert.ok(html.includes("https://learn.microsoft.com/ko-kr/windows/powertoys/install"));
 assert.match(html,/Microsoft Store에서/);
 assert.doesNotMatch(html,/자격증 추천은 아직 연결되지 않았습니다/);
 assert.doesNotMatch(html,/공식 DB 검증 예정/);
 assert.match(html,/자격증 추천과 로드맵을 이용할 수 있습니다/);
 assert.match(html,/각 화면에 표시되는 서버 활성화 상태/);
 assert.match(html,/AI 분석에 동의하고 실행하면 공고와 내 역량이 서버 및 OpenAI로 전송됩니다/);
 assert.doesNotMatch(html,/서버로 전송되지 않습니다/);
 assert.match(html,/target="_blank" rel="noopener noreferrer"/);
 for(const marker of ['id="job-text"','assets/job-url-ui.js','assets/agent-analysis-ui.js','assets/model-analysis-ui.js'])assert.ok(html.includes(marker),marker);
});
test("image-only link failures recommend screen text extraction instead of removed upload",async()=>{
 const {messages}=await import("../lib/job-url/errors.js");
 assert.match(messages.IMAGE_POSTING,/PowerToys/);
 assert.doesNotMatch(messages.IMAGE_POSTING,/이미지 업로드|이미지 글자 추출하기/);
});
