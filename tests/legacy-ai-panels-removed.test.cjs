"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const html=fs.readFileSync(path.join(__dirname,"../index.html"),"utf8");
test("old mock agent and Gateway semantic AI panels are no longer visible or loaded",()=>{
 for(const marker of ['id="agent-preview"','id="ai-analysis-panel"','id="ai-results"','id="agent-preview-run"','id="ai-run"','assets/agent-analysis-ui.js','assets/ai-analysis-ui.js'])assert.ok(!html.includes(marker),"obsolete panel still in page: "+marker);
 assert.doesNotMatch(html,/취업 분석 Agent · 가상 예제|AI로 공고의 의미 분석하기/);
});
test("production keeps posting and certificate tools and removes model controls",()=>{
 for(const marker of ['id="job-text"','id="job-url"','assets/job-url-ui.js','assets/certification-recommendations.js','data/certifications.json'])assert.ok(html.includes(marker),"required functionality missing: "+marker);
 for(const marker of ['id="model-run"','id="model-consent"','id="model-results"','id="model-analysis-title"','assets/model-analysis-ui.js','assets/agent-input.js'])assert.ok(!html.includes(marker),"retired AI functionality loaded: "+marker);
});
