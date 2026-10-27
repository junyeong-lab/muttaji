"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { analyze } = require("./load-browser-module.cjs")("../assets/job-text-analyzer.js");

test("명시된 공고 제목별로 분류하고 근거 행을 남긴다", () => {
  const result = analyze(
    "회사명: 예시회사\n모집 직무: 보안 운영\n담당업무\n- 로그 분석\n필수 자격요건\n- 네트워크 이해\n우대사항\n- 정보보안기사\n근무조건\n- 서울"
  );
  assert.equal(result.company[0].text, "예시회사");
  assert.equal(result.role[0].text, "보안 운영");
  assert.equal(result.responsibilities[0].line, 4);
  assert.equal(result.required[0].text, "네트워크 이해");
  assert.equal(result.preferred[0].text, "정보보안기사");
  assert.equal(result.unresolved[0].text, "서울");
  assert.equal(result.method, "rule-based");
});

test("제목 없는 자격증 나열은 필수/우대라고 추측하지 않는다", () => {
  const result = analyze("정보보안기사\n네트워크관리사 2급");
  assert.equal(result.required.length, 0);
  assert.equal(result.preferred.length, 0);
  assert.equal(result.unresolved.length, 2);
});

test("필수/우대 혼합 표현은 확인 필요로 분류한다", () => {
  const result = analyze("필수 및 우대사항: 보안 관련 자격");
  assert.equal(result.required.length, 0);
  assert.equal(result.preferred.length, 0);
  assert.equal(result.unresolved.length, 1);
});

test("콜론 사용, 빈 줄, CRLF, 불릿을 처리한다", () => {
  const result = analyze("필수: Linux\r\n\r\n우대: CPPG\r\n담당업무:\r\n- 로그 분석");
  assert.equal(result.required.length, 1);
  assert.equal(result.preferred.length, 1);
  assert.equal(result.responsibilities[0].text, "로그 분석");
  assert.equal(result.responsibilities[0].line, 5);
});

test("최대 글자 수 및 줄 수를 초과하면 중단한다", () => {
  assert.throws(() => analyze("a".repeat(20001)), RangeError);
  assert.throws(() => analyze(("a\n").repeat(401)), RangeError);
  assert.throws(() => analyze(null), TypeError);
});

test("HTML 코드가 입력되어도 결과를 텍스트로만 유지한다", () => {
  const result = analyze("필수:\n<script>alert(1)</script>");
  assert.equal(result.required[0].text, "<script>alert(1)</script>");
  assert.equal(result.required[0].line, 2);
});

test("실제 EDR/AV 공고 줄바꿈을 하나의 불릿으로 합쳐 2·2·2개로 분류한다", () => {
  const source = [
    "ES기술부", "",
    "담당업무",
    "ㆍ 엔드포인트 보안솔루션(EDR/AV 등) 구축 및",
    "유지보수", "",
    "ㆍ 엔드포인트 보안솔루션(EDR/AV 등) 장애/",
    "이슈 대응 및 기술지원", "",
    "[자격 요건]",
    "ㆍ 엔드포인트 보안솔루션 구축 및 유지관리 경험 보유자",
    "ㆍ 동종 경력 7년이상(과장급), 3년이상(대리급)", "",
    "[우대 사항]",
    "ㆍ 악성코드 분석 및 위협 탐지(Threat Hunting) 관련 보안",
    "지식 보유자 우대", "",
    "ㆍ Presales(제품소개, PoC/BMT, 제안 등) 경험자 우대"
  ].join("\n");
  const result = analyze(source);
  assert.equal(result.company.length, 0);
  assert.equal(result.responsibilities.length, 2);
  assert.equal(result.required.length, 2);
  assert.equal(result.preferred.length, 2);
  assert.equal(result.role.length, 1);
  assert.equal(result.role[0].text, "ES기술부");
  assert.equal(result.role[0].kindHint, "부서명 후보 · 직무명인지 확인 필요");
  assert.equal(result.unresolved.length, 0);
  assert.equal(result.responsibilities[0].text, "엔드포인트 보안솔루션(EDR/AV 등) 구축 및 유지보수");
  assert.equal(result.responsibilities[0].line, 4);
  assert.equal(result.responsibilities[0].endLine, 5);
  assert.equal(result.responsibilities[1].text, "엔드포인트 보안솔루션(EDR/AV 등) 장애/이슈 대응 및 기술지원");
  assert.equal(result.preferred[0].text, "악성코드 분석 및 위협 탐지(Threat Hunting) 관련 보안 지식 보유자 우대");
  assert.equal(result.preferred[0].line, 15);
  assert.equal(result.preferred[0].endLine, 16);
});

test("빈 줄·새 불릿·새 제목은 이어 붙이지 않는다", () => {
  const result = analyze("담당업무\nㆍ 첫 업무\n줄바꿈\nㆍ 둘째 업무\n\n뒤 문장\n[우대 사항]\nㆍ 우대 1");
  assert.equal(result.responsibilities.length, 3);
  assert.equal(result.responsibilities[0].text, "첫 업무 줄바꿈");
  assert.equal(result.responsibilities[1].text, "둘째 업무");
  assert.equal(result.responsibilities[2].text, "뒤 문장");
  assert.equal(result.preferred.length, 1);
});

test("첫 줄 부서 후보는 구체적 직무로 확정하지 않고 검토 표시한다", () => {
  const result=analyze("ES기술부\n\n담당업무\n- 보안 점검");
  assert.equal(result.company.length,0);
  assert.equal(result.role.length,1);
  assert.equal(result.role[0].text,"ES기술부");
  assert.match(result.role[0].kindHint,/부서명 후보/);
});
test("명시적인 모집 부서 제목도 인식하지만 직무명으로 단정하지 않는다",()=>{
  const result=analyze("모집 부서: ES기술부\n담당업무\n- 기술지원");
  assert.equal(result.role.length,1);
  assert.equal(result.role[0].kindHint,"모집 부서");
});
test("경력/자격증/회사명 등은 부서 후보로 잘못 분류하지 않는다",()=>{
  for(const value of ["정보보안기사","대리~과장","ES기술부 솔루션 구축","ES기술부: 경력 3년 이상"]){
    const result=analyze(value);
    assert.equal(result.role.length,0);
  }
  const company=analyze("회사명: ES기술부\n담당업무\n- 기술지원");
  assert.equal(company.company.length,1);
  assert.equal(company.role.length,0);
});

test("컨설팅 채용공고 복합 제목·가나다 업무 항목을 실제 업무와 자격요건으로 분류", () => {
  const source=[
    "포지션 상세",
    "정보보호 컨설턴트 주요업무",
    "정보보호 컨설턴트(관리/기술) 가. 정보보호 관리체계 점검 및 수립",
    "주요정보통신기반시설/전자금융기반시설 관리적 부분 취약점 점검",
    "ISMS, ISO27001 등 정보보호 인증 컨설팅",
    "정책지침 수립, 정보보호 감사 지원",
    "라. 인프라 취약점 점검",
    "서버/네트워크/보안장비/DBMS 등 정보시스템 보안설정 점검",
    "취약점 점검을 위한 운영체제 스크립트 작성",
    "다. 웹/모바일앱 취약점 점검",
    "웹사이트 취약점 점검",
    "모바일 앱/CS/HTS 취약점 점검",
    "라. 개인정보 컨설팅",
    "개인정보영향평가 수행 및 안전성 확보 조치 점검",
    "ISMS-P 인증의 개인정보 영역 점검",
    "개인정보 수준평가 및 수탁사 점검 지원",
    "포지션 상세",
    "[정보보호 컨설턴트] 자격요건",
    "학력 : 초대졸 이상",
    "경력 : 정보보호 컨설팅 2년 이상",
    "[우대사항]",
    "ㆍ 개인정보보호 관련 자격증 우대"
  ].join("\n");
  const result=analyze(source);
  assert.equal(result.role.length,1);
  assert.equal(result.role[0].text,"정보보호 컨설턴트");
  assert.equal(result.responsibilities.length,14);
  assert.equal(result.required.length,2);
  assert.equal(result.preferred.length,1);
  assert.equal(result.unresolved.length,0);
  assert.deepEqual(result.responsibilities.slice(6,8).map(x=>x.text),[
    "취약점 점검을 위한 운영체제 스크립트 작성",
    "웹/모바일앱 취약점 점검"
  ]);
});
test("회사 소개·공고 상세처럼 내용 없는 제목은 요건으로 세지 않는다",()=>{
  const result=analyze("포지션 상세\n정보보호 컨설턴트 주요업무\n취약점 점검\n공고 상세\n[자격요건]\n경력 1년 이상");
  assert.equal(result.responsibilities.length,1);
  assert.equal(result.required.length,1);
  assert.equal(result.unresolved.length,0);
});

test("실제 정보보안 컨설턴트 공고: 구어체 제목·모집 직무·기술/관리·우대 자격증 줄바꿈",()=>{
  const lines=[
    "모집","정보보안 컨설턴트(신입)","이런 업무를 하시게 될 거예요!",
    "■정보보안 컨설턴트(기술)","• 인프라 취약점 진단",
    "○ 서버, 네트워크, 보안장비 등 정보시스템 취약점 진단 및 스트립트 작성",
    "• 웹/모바일 취약점 진단","○ 웹/모바일(앱) 모의해킹 및 침투 테스트",
    "• 소스코드 진단 / 오픈소스 공급망보안","○ 시큐어코딩 기반 소스코드 점검",
    "○ 오픈소스 라이브러리 취약점 분석 및 SBOM 작성",
    "정보보안 컨설턴트(관리)","• 정보보호 관리체계",
    "o CSAP, ISMS, ISMS-P, ISO27001 등 보안인증심사 지원",
    "○ 국내외 컴플라이언스 분석 및 가이드","• 개인정보 컨설팅",
    "○ 개인정보 영향평가 수행 및 개인정보 업무 분석 안정성 확보 조치 점검",
    "○ ISMS-P 인증 개인정보 영역 점검",
    "○ 개인정보 수준평가 및 수탁사 점검 지원",
    "※기술 / 관리 중 적합한 포지션으로 채용을 진행합니다.",
    "이런 분을 원해요!","• 보안 컨설팅 분야에 대한 기초 이해가 있으신 분",
    "• 정보보안 분야에서 커리어를 시작하고 성장하고 싶으신 분",
    "• 상주/비상주/출장 업무 수행 가능하신 분",
    "• 협업 및 고객 대응을 위한 원활한 커뮤니케이션 능력을 갖추신 분",
    "이런 경험이 있으면 더 좋아요!","• 관련 학과 또는 공학 계열 전공자",
    "• IT/ 정보보안 자격증 소지자",
    "정보보안(산업)기사, 정보처리기사, ISMS-P/ISO27001 심사원, CPPG 등",
    "• 정보보안 관련 프로젝트·인턴·스터디·동아리·대외활동 경험자"
  ];
  const actual=analyze(lines.join("\n"));
  assert.equal(actual.role.length,1);
  assert.equal(actual.role[0].text,"정보보안 컨설턴트(신입)");
  assert.equal(actual.responsibilities.length,16); // 업무 14개 + 기술/관리 소제목 2개
  assert.equal(actual.responsibilities.filter(x=>x.sectionHeading).length,2);
  assert.equal(actual.responsibilities.find(x=>x.text==="인프라 취약점 진단").kindHint,"기술 분야 업무");
  assert.equal(actual.responsibilities.find(x=>x.text==="개인정보 컨설팅").kindHint,"관리 분야 업무");
  assert.equal(actual.required.length,4);
  assert.equal(actual.preferred.length,3);
  assert.match(actual.preferred[1].text,/정보보안\(산업\)기사/);
  assert.equal(actual.unresolved.length,1);
});
test("구어체 다른 제목도 인식하고 제목 없는 자격증은 미분류 유지",()=>{
  const input="모집\n보안 엔지니어\n함께 하실 업무\n• 보안 설정 점검\n이런 분이 필요해요!\n• 시스템 관리 경험\n이런 분이면 더 좋아요!\n• 자격증 보유";
  const actual=analyze(input);
  assert.equal(actual.role.length,1);
  assert.equal(actual.responsibilities.length,1);
  assert.equal(actual.required.length,1);
  assert.equal(actual.preferred.length,1);
  const unheaded=analyze("정보보안기사\n네트워크관리사 2급");
  assert.equal(unheaded.required.length,0);
  assert.equal(unheaded.preferred.length,0);
  assert.equal(unheaded.unresolved.length,2);
});
