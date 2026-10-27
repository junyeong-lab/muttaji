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
test("real OpenAI analysis plus URL, comparison, roadmap and certificates are retained",()=>{
 for(const marker of ['id="model-run"','id="model-consent"','id="model-results"','id="requirements-run"','id="job-text"','id="job-url"','assets/model-analysis-ui.js','assets/agent-input.js','assets/job-url-ui.js','assets/requirement-comparison.js','assets/roadmap.js','assets/certification-recommendations.js','data/certifications.json'])assert.ok(html.includes(marker),"required functionality missing: "+marker);
 assert.ok(html.includes('id="model-analysis-title"'));
 assert.ok(html.includes('https://learn.microsoft.com/ko-kr/windows/powertoys/install'));
 assert.doesNotMatch(html,/<input[^>]+type=["']file["']/i);
});
