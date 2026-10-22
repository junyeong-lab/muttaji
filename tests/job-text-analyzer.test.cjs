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
