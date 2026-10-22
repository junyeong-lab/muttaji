"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { analyze } = require("../assets/job-text-analyzer.js");

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
  assert.equal(result.unresolved.length, 1);
  assert.equal(result.responsibilities[0].text, "엔드포인트 보안솔루션(EDR/AV 등) 구축 및 유지보수");
  assert.equal(result.responsibilities[0].line, 4);
  assert.equal(result.responsibilities[0].endLine, 5);
  assert.equal(result.responsibilities[1].text, "엔드포인트 보안솔루션(EDR/AV 등) 장애/ 이슈 대응 및 기술지원");
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
