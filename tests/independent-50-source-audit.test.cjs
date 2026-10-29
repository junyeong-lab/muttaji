const test=require("node:test");
const assert=require("node:assert/strict");
const {readFileSync}=require("node:fs");
const {resolve}=require("node:path");
const fixture=JSON.parse(readFileSync(resolve(__dirname,"fixtures/semantic-postings-50.json"),"utf8"));
const urls=JSON.parse(readFileSync(resolve(__dirname,"fixtures/real-postings-smoke.json"),"utf8"));
const byId=new Map(fixture.records.map(row=>[String(row.id),row]));
const quoted=(id,quote)=>fixture.records.find(row=>String(row.id)===id)?.posting.includes(quote);

test("independent audit ledger: all 50 URLs unique and backed by matching stored source",()=>{
 assert.equal(urls.length,50);assert.equal(fixture.records.length,50);
 assert.equal(new Set(urls.map(row=>row.url)).size,50);
 assert.equal(byId.size,50);
 for(const row of urls){const id=(row.url.match(/(?:GI_Read\/|rec_idx=)(\d+)/)||[])[1];
  assert.ok(id, row.url);assert.ok(byId.has(id),id);
  assert.equal(byId.get(id).url,row.url,id);
  assert.ok(byId.get(id).posting.length>100,id);
 }
});

test("5th and 4th manually reviewed postings are separate from the historical 50 corpus",()=>{
 assert.equal(byId.has("50162090"),false);
});

test("54452855 raw duties contain an explicit preferred-experience sentence requiring separate review",()=>{
 const lines=byId.get("54452855").posting.split("\n");
 const duty=lines.findIndex(line=>line.includes("주요업무"));
 const eligibility=lines.findIndex(line=>line.includes("자격요건"));
 assert.ok(duty>=0&&eligibility>duty);
 assert.ok(lines.slice(duty+1,eligibility).some(line=>/정보통신 공사 관련 현장 업무 경력자 우대/.test(line)));
});

test("53693158 raw duties contain priority hiring and preferred-skills text duplicated later",()=>{
 const text=byId.get("53693158").posting;
 assert.equal((text.match(/React 를 사용한 프론트엔드 애플리케이션 개발 \(우대\)/g)||[]).length,2);
 assert.ok(text.includes("MES s/w 개발 유경험자 우선 채용"));
});

test("52030033 contains both open-to-beginners and 2-3-year experience statements",()=>{
 assert.equal(quoted("52030033","경력 무관 (신입 지원 가능)"),true);
 assert.equal(quoted("52030033","정보보호/보안 인프라 관련 2~3년 경력"),true);
});

test("54699487 has two distinct job tracks with different experience thresholds",()=>{
 assert.equal(quoted("54699487","관리진단 컨설팅(경력 6년 이상)"),true);
 assert.equal(quoted("54699487","기술진단 컨설팅(신입 및 경력 1년 이상)"),true);
});

test("50186173 source retains three separate category markers on one physical line",()=>{
 assert.ok(byId.get("50186173").posting.split("\n").some(line=>line.includes("[담당업무]")&&line.includes("[자격요건]")&&line.includes("[우대사항]")));
});

test("50190160 explicitly states SQL experience is not mandatory",()=>{
 assert.equal(quoted("50190160","SQL 활용 경험, 오프라인 공간 데이터나 머신러닝 모델 운영 경험은 필수가 아닙니다."),true);
});
