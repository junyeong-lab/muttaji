"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const html=fs.readFileSync(path.join(__dirname,"../index.html"),"utf8");
const form=html.match(/<form id="profile-form"[\s\S]*?<\/form>/)?.[0]||"";
test("save and certification recommendation are adjacent buttons in profile form",()=>{
 assert.match(form,/<div class="actions"[^>]*>\s*<button type="submit" class="primary">입력 내용 저장[\s\S]*?<\/button>\s*<button type="button" class="secondary" data-go="certifications">관련 자격증 추천 보기[\s\S]*?<\/button>\s*<\/div>/);
});
test("recommendation button uses existing navigation to the certification page without submitting form",()=>{
 assert.match(html,/var nodes=document\.querySelectorAll\("\[data-go\]"\)/);
 assert.match(html,/location\.hash=btn\.dataset\.go;route\(\)/);
 assert.match(html,/<section id="certifications" class="panel"/);
 assert.match(html,/\.actions\{display:flex;gap:11px;flex-wrap:wrap\}/);
});
test("posting result displays owned certificates before certificate suggestions",()=>{
 assert.match(html,/<div class="actions" style="margin-top:20px"><button type="button" class="outline" data-go="profile">보유 자격증 입력하기 →<\/button><button type="button" class="secondary" data-go="certifications">자격증 추천 보기 →<\/button><\/div>/);
});
