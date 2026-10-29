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


test("잡코리아 요약·상세 반복 직무명과 줄바꿈 근무지 주소를 정리한다",()=>{
 const input=[
  "기업명: ㈜에프원시큐리티", "",
  "모집 직무: 정보보호컨설턴트 인재채용", "",
  "근무지: 서울 금천구 벚꽃로 234 (가산동, 에이스하이엔드타워6차)",
  "1402호", "",
  "담당업무", "ㆍ정보보호 컨설팅", "",
  "정보보호컨설턴트 인재 채용"
 ].join("\n");
 const result=analyze(input);
 assert.deepEqual(result.role.map(row=>row.text),["정보보호컨설턴트 인재채용"]);
 assert.equal(result.role[0].line,3);
 const location=result.unresolved.find(row=>row.text.startsWith("근무지:"));
 assert.ok(location);
 assert.match(location.text,/1402호/);
 assert.equal(location.line,5);
 assert.equal(location.endLine,6);
 assert.equal(result.responsibilities.length,1);
});
test("근무지 표시는 앞의 필수·모집 직무 구분을 이어받지 않는다",()=>{
 const item=analyze("필수조건\n- 정보처리기사\n근무지: 서울 금천구\n우대사항\n- SQLD");
 assert.equal(item.required.length,1);
 assert.equal(item.unresolved.some(row=>row.text.startsWith("근무지:")),true);
 assert.equal(item.preferred.length,1);
 const roles=analyze("모집\n정보보호 컨설턴트(관리)\n정보보호 컨설턴트(기술)");
 assert.equal(roles.role.length,2);
});

test("잡코리아 스킬은 담당업무와 분리해 기타로 보존하고 이후 자격요건을 유지",()=>{
  const source=[
    "담당업무",
    "ㆍ보안 솔루션 구축 및 기술 지원",
    "스킬",
    "ㆍ정보처리기사 자격, 정보처리산업기사 자격, 정보통신공사수첩, 전기기사 자격",
    "자격요건",
    "ㆍ학력 : 학력무관",
    "ㆍ경력 : 신입·경력",
    "우대사항",
    "ㆍ문서 작성 가능자"
  ].join("\n");
  const o=analyze(source);
  assert.deepEqual(o.responsibilities.map(x=>x.text),["보안 솔루션 구축 및 기술 지원"]);
  assert.deepEqual(o.unresolved.map(x=>x.line),[4]);
  assert.match(o.unresolved[0].text,/정보처리기사 자격/);
  assert.match(o.unresolved[0].kindHint,/스킬 참고 정보/);
  assert.deepEqual(o.required.map(x=>x.line),[6,7]);
  assert.equal(o.preferred[0].line,9);
  assert.equal(o.totalItems,5);
});
test("스킬만 등장하면 필수·우대로 추측하지 않고 기타로 분류",()=>{
  for(const input of [
    "스킬\nㆍ정보처리기사 자격\nㆍ정보통신공사수첩",
    "기술 및 지식(원문)\nLinux, Python",
    "Skills: 자격증 보유\n필수조건\nㆍ학력무관",
    "담당업무\nㆍ기술지원\n기술 스택\nㆍJavaScript"
  ]){
    const result=analyze(input);
    assert.ok(result.unresolved.length>=1,input);
    assert.ok(result.unresolved.some(x=>/스킬 참고 정보/.test(x.kindHint)),input);
    assert.equal(result.responsibilities.some(x=>/정보처리기사|정보통신공사수첩|Linux|JavaScript/.test(x.text)),false,input);
    assert.equal(result.required.some(x=>/정보처리기사|정보통신공사수첩|Linux|JavaScript/.test(x.text)),false,input);
    assert.equal(result.preferred.length,0,input);
  }
});


const worxphereSource=require('node:fs').readFileSync(require('node:path').join(__dirname,'fixtures/job-text/worxphere-50176196.txt'),'utf8');
test('웍스피어 실제 추출 공고: 담당 10·필수 6·우대 7 및 원문 행/인용 보존',()=>{
 const out=analyze(worxphereSource),range=(start,n)=>Array.from({length:n},(_,i)=>start+i);
 assert.deepEqual(out.responsibilities.map(x=>x.line),range(27,10));
 assert.deepEqual(out.required.map(x=>x.line),range(39,6));
 assert.deepEqual(out.preferred.map(x=>x.line),range(52,7));
 assert.equal(out.company[0].text,'웍스피어(유)');assert.match(out.role[0].text,/보안 엔지니어/);
 const lines=worxphereSource.split('\n');
 for(const kind of ['company','role','responsibilities','required','preferred','unresolved'])for(const item of out[kind]){
  assert.equal(item.source,lines.slice(item.line-1,item.endLine).map(x=>x.trim()).join('\n'));
 }
 assert.ok(range(46,5).every(line=>out.unresolved.some(x=>x.line===line&&/스킬 참고 정보/.test(x.kindHint))));
 assert.equal('skills' in out,false);assert.ok(![...out.required,...out.preferred].some(x=>x.line<=25||x.line>=59));
 assert.ok(![...out.required,...out.preferred].some(x=>/실무 경험 및 보안 엔지니어링 역량|상세 기술 스택/.test(x.text)));
});
test('회사 소개에 붙은 제목은 같은 원문 행에서 분리하며 소개를 담당업무에 넣지 않음',()=>{
 const lines=worxphereSource.split('\n'),intro=lines[24];lines.splice(24,2,intro+lines[25]);const source=lines.join('\n'),out=analyze(source);
 assert.equal(out.responsibilities.length,10);assert.equal(out.required.length,6);assert.equal(out.preferred.length,7);
 assert.equal(out.responsibilities[0].line,26);assert.equal(out.required[0].line,38);assert.equal(out.preferred[0].line,51);
 const preserved=out.unresolved.find(x=>x.line===25);assert.equal(preserved.source,intro);assert.ok(source.includes(preserved.source));
 assert.ok(!out.responsibilities.some(x=>x.text.includes('만들어 갑니다')));
});
test('구어체 제목·번호 소제목·기술 스택·유의사항의 경계와 보통 문장 구분',()=>{
 const source='이런 업무를 하시게 돼요!\n- 로그 분석\n이런 경험을 가지신 분을 찾고 있어요!\n1. 실무 경험 및 보안 엔지니어링 역량\n- 보안 경력 3년\n2. 상세 기술 스택\n- WAF\n이런 경험이 있다면 더욱 좋아요!\n- 자격증 보유\n유의사항\n- 제출서류 확인';
 const out=analyze(source);assert.equal(out.responsibilities.length,1);assert.equal(out.required.length,1);assert.equal(out.preferred.length,1);
 assert.ok(out.unresolved.some(x=>x.text==='WAF'));assert.ok(out.unresolved.some(x=>x.text==='제출서류 확인'));
 const ordinary=analyze('회사 소개\n지원서에는 이런 업무를 하시게 돼요!라는 문장을 적지 마세요.\n필수조건\n- 문서 작성 가능');
 assert.equal(ordinary.responsibilities.length,0);assert.equal(ordinary.required.length,1);
});


test("가비아형 한국어 모집요강: 자격/업무/우대/전형 제목이 다른 조건으로 섞이지 않는다",()=>{
 const source=[
  "기업명: 예시 정보보호 회사",
  "■ 자격요건",
  "· 유관 경력 8년 이상",
  "■ 이런 일을 해요",
  "· 보안 정책 점검",
  "■ 이런 분을 찾아요",
  "· 개인정보보호 운영 경험",
  "■ 이런 분이라면 더욱 좋아요",
  "· CPPG 자격증 취득",
  "전형절차 및 유의사항",
  "서류전형",
  "면접전형"
 ].join("\n");
 const parsed=analyze(source);
 assert.deepEqual(parsed.required.map(x=>x.text),["유관 경력 8년 이상","개인정보보호 운영 경험"]);
 assert.deepEqual(parsed.responsibilities.map(x=>x.text),["보안 정책 점검"]);
 assert.deepEqual(parsed.preferred.map(x=>x.text),["CPPG 자격증 취득"]);
 assert.equal(parsed.preferred[0].line,9);
 assert.equal(parsed.required.some(x=>/전형|면접/.test(x.text)),false);
});
test("네비웍스형 한국어 모집요강: 기술과 근무조건은 우대조건으로 유출되지 않는다",()=>{
 const source=[
  "이런 업무를 해요",
  "- SW 설계 및 개발",
  "이런 분들을 찾고 있어요",
  "- 관련 경력 3년 이상",
  "이런 분이면 더 좋아요",
  "- 협업 경험",
  "이런 기술이 필요해요",
  "- C++ 활용",
  "이런 조건에서 근무할 예정이에요",
  "- 경기 안양시 사무실"
 ].join("\n");
 const parsed=analyze(source);
 assert.deepEqual(parsed.required.map(x=>x.text),["관련 경력 3년 이상"]);
 assert.deepEqual(parsed.preferred.map(x=>x.text),["협업 경험"]);
 assert.deepEqual(parsed.responsibilities.map(x=>x.text),["SW 설계 및 개발"]);
 assert.equal(parsed.unresolved.some(x=>x.text.includes("C++")),true);
 assert.equal(parsed.unresolved.some(x=>x.text.includes("경기 안양시")),true);
});


test("지니언스형 표 원문: 직무·인원 뒤 [지원 자격]과 명시적 우대 표현을 구분한다",()=>{
 const lines=[
  "기업명: 예시 보안기업",
  "분야 모집 인원 지원 자격 및 우대 요건",
  "보안솔루션 엔지니어 인턴 3명 [지원 자격] 서버, 네트워크 보안 지식 및 기술 보유자",
  "장애인 복지카드 소유자 우대",
  "영어 가능자 우대",
  "보안 솔루션 엔지니어에 지원하려면",
  "- 졸업예정자는 졸업요건 충족 필요"
 ];
 const result=analyze(lines.join("\n"));
 assert.equal(result.required.some(x=>/서버, 네트워크 보안 지식/.test(x.text)),true);
 assert.equal(result.preferred.some(x=>/장애인 복지카드 소유자 우대/.test(x.text)),true);
 assert.equal(result.preferred.some(x=>/영어 가능자 우대/.test(x.text)),true);
 assert.equal(result.required.some(x=>/인턴 3명/.test(x.text)),false);
 assert.equal(result.unresolved.some(x=>/인턴 3명/.test(x.text)),true);
 assert.equal(result.required.find(x=>/서버, 네트워크/.test(x.text)).line,3);
});


test("실공고 유형: 근무환경·출퇴근·교통 안내는 우대요건에 섞이지 않는다",()=>{
 const out=analyze(["모집분야","담당업무 / 자격조건 / 우대사항","운영 엔지니어","신입: 00명",
 "주요 업무","- 클라우드 인프라 운영","자격요건","- Linux 관리 경험","우대 사항","- AWS 구축 경험",
 "근무 환경","세부사항","근무일시","주 5일 (월~금)","근무시간","09:00 ~ 18:00","근 무 지","서울 구로구","오시는길","가산디지털단지역"].join("\n"));
 assert.deepEqual(out.required.map(x=>x.text),["Linux 관리 경험"]);
 assert.deepEqual(out.preferred.map(x=>x.text),["AWS 구축 경험"]);
 assert.equal(out.unresolved.some(x=>/09:00/.test(x.text)),true);
 assert.equal(out.preferred.some(x=>/운영 엔지니어|신입:|근무|지하철|디지털단지/.test(x.text)),false);
});
test("실공고 유형: 자격요건 중 명시된 가점·우대는 필수가 아닌 우대",()=>{
 const out=analyze(["자격요건","- 유관 경력 8년 이상","- 취업보호대상자는 채용 시 우대함","- 과천 거주자는 서류 전형 시 가점 부여",
 "이런 분을 찾아요","- 정보보호 관리체계 운영 경험","이런 분이라면 더욱 좋아요","- CPPG 자격증","※ 상세 공고는 공식 홈페이지에서 확인하세요","전형절차 및 유의사항","서류전형"].join("\n"));
 assert.deepEqual(out.required.map(x=>x.text),["유관 경력 8년 이상","정보보호 관리체계 운영 경험"]);
 assert.equal(out.preferred.some(x=>x.text.includes("우대함")),true);
 assert.equal(out.preferred.some(x=>x.text.includes("가점 부여")),true);
 assert.equal(out.preferred.some(x=>/서류전형|상세 공고는/.test(x.text)),false);
});
test("실공고 유형: 지원 대상 섹션은 필수이고 홍보 문구는 우대가 아니다",()=>{
 const out=analyze(["모집 분야 / 업무내용 / 모집인원","- 정보보호 컨설팅 / 보안점검 / 0명",
 "지원 대상","- 학사 학위를 취득하였거나 졸업 예정자","- 보안업무 경력 1-2년",
 "우대 사항","- 정보처리기사 자격","회사에 대해 더 알고 싶으시다면 홈페이지에서 확인하세요.","pieinc.co.kr"].join("\n"));
 assert.deepEqual(out.required.map(x=>x.text),["학사 학위를 취득하였거나 졸업 예정자","보안업무 경력 1-2년"]);
 assert.deepEqual(out.preferred.map(x=>x.text),["정보처리기사 자격"]);
});
test("실공고 유형: 우대사항 다음 복리후생·채용절차는 분류에서 제외",()=>{
 const out=analyze(["담당업무","- 보안 관리체계 운영","신입사원 성장 지원","- 신입 교육 제공","CELA만의 특별한 문화","- 탄력근무제",
 "풍부한 복리후생","- 퇴직금 제공","우대사항","- 보안 관련 자격증 취득자","채용 절차","서류전형","면접전형"].join("\n"));
 assert.deepEqual(out.required.map(x=>x.text),[]);
 assert.deepEqual(out.preferred.map(x=>x.text),["보안 관련 자격증 취득자"]);
 assert.equal(out.responsibilities.some(x=>/신입 교육|탄력근무제|퇴직금/.test(x.text)),false);
});
test("실공고 유형: 제출서류와 절차안내가 우대조건 뒤에 있어도 유출되지 않는다",()=>{
 const out=analyze(["자격요건","- Python 개발 경험","우대사항","- 클라우드 기반 서비스 구축",
 "제출서류","- 이력서","- 포트폴리오","절차안내","- 서류전형 > 면접 > 최종합격",
 "유의사항","- 서류 합격자 개별 연락"].join("\n"));
 assert.deepEqual(out.required.map(x=>x.text),["Python 개발 경험"]);
 assert.deepEqual(out.preferred.map(x=>x.text),["클라우드 기반 서비스 구축"]);
 assert.equal(out.unresolved.some(x=>/포트폴리오|서류전형/.test(x.text)),true);
});
test("실공고 유형: 지원자격/채용부문/복수 경력 표제는 구분",()=>{
 const out=analyze(["공통 자격요건","- 대졸 이상","채용부문","정보시스템 기술적 취약점 분석",
 "지원자격","- 신입/경력","우대사항","- 정보처리기사 자격","근무조건","- 정규직"].join("\n"));
 assert.deepEqual(out.required.map(x=>x.text),["대졸 이상","신입/경력"]);
 assert.deepEqual(out.preferred.map(x=>x.text),["정보처리기사 자격"]);
 assert.equal(out.required.some(x=>/분석$/.test(x.text)),false);
});

test("실공고 37352299: 줄바꿈 보안 보호조치와 관련 자격증은 개별 문장이 아닌 한 요건으로 보존",()=>{
 const posting=[
  "[지원 자격]",
  "- 정보보호 관련 법제도에 높은 이해를",
  "가지고 있는 분",
  "- 정보보호 관리체계 구축, 인증을 위한 실무",
  "경험을 보유한 분",
  "- PC/Mobile 웹/앱 등에 대한 기술적",
  "보호조치 검토 및 개선안 도출이 가능한 분",
  "- 정보보호 정책수립 담당자로서 최소 3년",
  "이상의 경험을 보유한 분",
  "[우대 사항]",
  "- 국내/외 정보보호 인증심사원 자격을",
  "보유한 분",
  "- CISA/CISSP/CPPG 등 정보보호 관련",
  "자격증을 보유한 분",
  "- 적극적이고 주도적인 성향을 가진 분",
  "- 조직내 커뮤니케이션이 원활한 분",
  "- 자기계발에 열정적인 분"
 ].join("\n");
 const out=analyze(posting);
 assert.equal(out.required.length,4);
 assert.equal(out.preferred.length,5,JSON.stringify(out.preferred.map(x=>({line:x.line,text:x.text}))));
 const tech=out.required.find(x=>x.text.startsWith("PC/Mobile"));
 assert.ok(tech);
 assert.match(tech.text,/기술적 보호조치 검토/);
 assert.equal(tech.line,6);
 assert.equal(tech.endLine,7);
 const cert=out.preferred.find(x=>x.text.startsWith("CISA/CISSP"));
 assert.ok(cert);
 assert.match(cert.text,/정보보호 관련 자격증을 보유한 분/);
 assert.equal(cert.line,13);
 assert.equal(cert.endLine,14);
});

test("실공고 50172985: 홍보용 '많은 지원 바랍니다' 문장을 필수요건으로 판단하지 않는다",()=>{
 const source=[
  "지원자격",
  "- SQL 및 RDBMS 실무 경험",
  "- 데이터 이행, DW/OLAP 구축 경험을 바탕으로 함께 성장할 분들의 많은 지원 바랍니다.",
  "우대사항",
  "- Power BI 활용 경험"
 ].join("\n");
 const out=analyze(source);
 assert.deepEqual(out.required.map(x=>x.text),["SQL 및 RDBMS 실무 경험"]);
 assert.deepEqual(out.preferred.map(x=>x.text),["Power BI 활용 경험"]);
 assert.equal(out.unresolved.some(x=>/많은 지원 바랍니다/.test(x.text)),true);
});
test("실공고 54832907: 사람인 원문 자모 'ㅇ' 표기를 조건에 섞지 않는다",()=>{
 const source=["자격요건","ㅇ'27년 1월 입사 가능자(석사 이하)","ㅇ Network에 대한 높은 관심","ㅇ 새로운 업무에 대한 도전과 열정"].join("\n");
 const out=analyze(source);
 assert.equal(out.required.length,3);
 assert.equal(out.required[0].text,"'27년 1월 입사 가능자(석사 이하)");
 assert.equal(out.required[1].text,"Network에 대한 높은 관심");
 assert.equal(out.required[2].text,"새로운 업무에 대한 도전과 열정");
 assert.equal(out.required[0].source,"ㅇ'27년 1월 입사 가능자(석사 이하)");
});
