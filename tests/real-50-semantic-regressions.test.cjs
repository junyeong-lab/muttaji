"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {analyze}=require("./load-browser-module.cjs")("../assets/job-text-analyzer.js");
const texts=(s,k)=>analyze(s).constructor===Object?analyze(s)[k].filter(x=>!x.sectionHeading).map(x=>x.text):[];
test("지원 대상: 학사와 경력은 필수, 우대사항과 사이트 안내는 우대에서 분리",()=>{
 const s=["채용 안내","지원 대상","- 학사 졸업자","- IT 경력 2년 이상","우대 사항","- SQLD 자격증","회사에 대해 더 알고 싶으시다면 홈페이지에서 확인하세요.","example.org"].join("\n");
 assert.deepEqual(texts(s,"required"),["학사 졸업자","IT 경력 2년 이상"]);
 assert.deepEqual(texts(s,"preferred"),["SQLD 자격증"]);
});
test("클라우드 우대사항 뒤 근무 환경은 전부 기타로 분리",()=>{
 const s=["자격요건","- Linux 사용 경험","우대 사항","- Docker 경험","근무 환경","세부사항","근무일시","월요일부터 금요일","근무형태","수습기간 후 정규직","근무시간","09:00~18:00","오시는길","지하철역 3번 출구"].join("\n");
 assert.deepEqual(texts(s,"required"),["Linux 사용 경험"]);
 assert.deepEqual(texts(s,"preferred"),["Docker 경험"]);
});
test("채용 절차와 제출서류는 우대조건으로 이어받지 않는다",()=>{
 const s=["우대사항","- Python 프로젝트","제출서류","- 이력서","절차안내","- 서류전형 > 면접 > 최종 합격","[제출서류]","- 포트폴리오","우대사항","- 정보처리기사"].join("\n");
 assert.deepEqual(texts(s,"preferred"),["Python 프로젝트","정보처리기사"]);
});
test("업무 항목 뒤 회사 문화 및 복지는 담당업무에서 제외",()=>{
 const s=["주요 업무","- ISMS-P 관리","신입사원 성장 지원","도서 지원","CELA만의 특별한 문화","프로팀 문화","풍부한 복리후생","연차 및 휴가 지원","우대사항","- 협업 경험","채용 절차","서류전형"].join("\n");
 assert.deepEqual(texts(s,"responsibilities"),["ISMS-P 관리"]);
 assert.deepEqual(texts(s,"preferred"),["협업 경험"]);
});
test("복합 자격/우대 제목과 직무명은 필수/우대로 오인하지 않는다",()=>{
 const s=["포지션 및 자격요건","네트워크 엔지니어","담당업무","- 네트워크 관리","자격요건","- CCNA 자격증","우대사항","- 문서 작성 능력"].join("\n");
 assert.deepEqual(texts(s,"required"),["CCNA 자격증"]);
 assert.deepEqual(texts(s,"preferred"),["문서 작성 능력"]);
});
test("원문 한 행의 [담당업무], [자격요건], [우대사항]은 서로 다른 구역",()=>{
 const s=["모집부문 자격요건 및 우대사항","네트워크 담당 1명 [담당업무] 서버 점검 [자격요건] Linux 활용 [우대사항] SQLD 자격"].join("\n");
 assert.deepEqual(texts(s,"required"),["Linux 활용"]);
 assert.deepEqual(texts(s,"preferred"),["SQLD 자격"]);
 assert.deepEqual(texts(s,"responsibilities"),["서버 점검"]);
});
test("우대함·가점 부여는 필수가 아니라 우대",()=>{
 const s=["자격요건","- 경력 3년","- 보훈대상자는 채용 시 우대함","- 특정 지역 거주자는 서류 전형 시 가점 부여"].join("\n");
 assert.deepEqual(texts(s,"required"),["경력 3년"]);
 assert.deepEqual(texts(s,"preferred"),["보훈대상자는 채용 시 우대함","특정 지역 거주자는 서류 전형 시 가점 부여"]);
});
test("공고 템플릿의 상세내용 입력 안내는 우대조건이 아니다",()=>{
 const s=["자격요건","- 학력무관","우대사항","- 상세내용을 입력하세요","- 정보보안기사"].join("\n");
 assert.deepEqual(texts(s,"required"),["학력무관"]);
 assert.deepEqual(texts(s,"preferred"),["정보보안기사"]);
});
