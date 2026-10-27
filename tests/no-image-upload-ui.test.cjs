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
 for(const marker of ['id="job-text"','assets/job-url-ui.js','assets/agent-analysis-ui.js','assets/model-analysis-ui.js'])assert.ok(html.includes(marker),marker);
});
test("image-only link failures recommend screen text extraction instead of removed upload",async()=>{
 const {messages}=await import("../lib/job-url/errors.js");
 assert.match(messages.IMAGE_POSTING,/PowerToys/);
 assert.doesNotMatch(messages.IMAGE_POSTING,/이미지 업로드|이미지 글자 추출하기/);
});
