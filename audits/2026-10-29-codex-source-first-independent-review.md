# Codex 원문 중심 AI Agent 변경 독립 검토 (2026-10-29)

검토 대상 커밋: [83cf5549c7a672982b45fa5ddc1150abad27a141](https://github.com/junyeong-lab/muttaji/commit/83cf5549c7a672982b45fa5ddc1150abad27a141)

## 확인된 사실

- Vercel Preview 별칭은 해당 커밋 `83cf554`의 READY 배포를 가리킴. 실제 배포 자바스크립트도 확인.
- GitHub Actions [40816941775](https://github.com/junyeong-lab/muttaji/actions/runs/40816941775) 로그: 321 tests/pass, 0 fail, 0 skipped.
- Preview `GET /api/model-analysis` 응답: `enabled:true,localOnly:false,mode:public`. 실제 모델 POST 분석을 실행하거나 정확도를 판정한 근거는 아님.
- 새 코드에서 원문 분류 경로가 규칙 목록·프로필 없이 `classify-posting`으로 요청되고, 승인 이후 비교에 인계하는 흐름을 확인.
- 기존 50건의 모의 검사는 각 공고의 **첫 비어 있지 않은 행을 unresolved 1개**, **나머지 대부분을 referenceRanges 하나**로 설정해 *구조적 인용·범위 검사*를 수행함. 50건 필수/우대 정답 판정으로 해석하면 안 됨.

## 반드시 수정/재검증할 문제

### ISSUE 1: 표 안에 있는 실제 필수조건이 서버에서 거부됨 (코드 실행 재현)

파일: [`lib/agent/posting-classifier.js`](https://github.com/junyeong-lab/muttaji/blob/83cf5549c7a672982b45fa5ddc1150abad27a141/lib/agent/posting-classifier.js)

원문 축약:
```text
모집분야
담당업무
자격요건
모집인원
보안 엔지니어
방화벽 운영
정보보안기사 필수
1명
```

모의 AI 결과: 7행 `정보보안기사 필수`를 `required`, `basisQuote="자격요건"`으로 정확 인용하고 나머지 행을 참고범위로 표시.

동일 `required` + `basisQuote="자격요건"` 분류는 독립 제목 `자격요건\n정보보안기사 필수`에서 통과하지만, 4열 제목 구간에 `모집분야/담당업무/자격요건/모집인원`이 존재하면 `isTableHeading` 조건으로 `INVALID_AGENT_OUTPUT: POSTING_OBLIGATION` 거부됨.

원인: `isTableHeading(lines,item.basisQuote)`를 요구사항 전체가 아니라 **표 제목 자체가 명시적 필수 증거로 충분하지 않은 경우**에만 적용해야 하는데, 현재는 표에 진짜 명시된 필수 문구도 무조건 차단함. 단순 삭제하면 원래 업무 오분류가 재발할 수 있으니 표 셀의 적용 범위·독립된 필수 표현·의무 근거를 함께 검증하는 방식 필요.

### ISSUE 2: 승인 후 수정 시 이전 비교 결과가 화면에 남음 (실제 UI JS 동작 재현)

파일: [`assets/posting-analysis-ui.js`](https://github.com/junyeong-lab/muttaji/blob/83cf5549c7a672982b45fa5ddc1150abad27a141/assets/posting-analysis-ui.js)

재현: AI 분류 초안 승인 → 사용자가 기존 내 역량 비교 실행하여 비교 패널 표시 → 이미 승인했던 분류 항목을 `unresolved`로 수정.

스크립트 실행 결과:
- `MuttajiPostingReviewGate.status`: `approved` → `draft` (정상).
- 기존 `#requirements-check` 패널 `hidden=false`로 계속 표시.
- 수정 시 `muttaji:comparison-changed`의 `items:null` 이벤트 **0건**.
- `window.MuttajiReviewedPosting.provenance`는 이전 `ai-user-approved` 값을 계속 유지함.

권장 수정: 초안 변경을 시작할 때 승인 이전 비교·로드맵 화면의 **유효성만 취소**하고 기존 사용자 입력/판정 자료는 보존. 이전 승인 객체가 새 수정안의 승인으로 오인되지 않게 변경. 기존 실패가 이전 확정 결과를 유지하는 정책과 구분해 테스트 추가.

### ISSUE 3: 별도 감사 브랜치의 자격증 매칭 수정 2건 미통합

브랜치: [`audit/independent-50-20261029`](https://github.com/junyeong-lab/muttaji/tree/audit/independent-50-20261029)

- [54452855](https://www.saramin.co.kr/zf_user/jobs/view?rec_idx=54452855): `정보통신기술자 경력수첩` 때문에 `정보처리기사` 보유자의 우대 자격증 목록이 자동 확인되지 않던 오류.
- [53259715](https://www.saramin.co.kr/zf_user/jobs/view?rec_idx=53259715): 운전면허가 우대 자격 목록에 함께 있어 `정보처리기사` 자동 매칭이 누락되던 오류.
- 독립 감사 브랜치에서 두 오류를 수정해 코드 실행으로 전후 비교했으나, Codex 브랜치 `83cf554`의 비교 규칙에는 해당 코드 변경 없음. 통합 시 AI Agent 경로와 결합해 회귀 테스트 필요.
- `main`은 병합하지 않음.

## 미검증 사항

- 실제 OpenAI 모델 분류: 이 검토에서 유료 POST 호출하지 않음; Codex 보고상 0/50.
- 실제 Chrome 두 공고 시험: Codex의 보고·테스트 코드는 확인했으나 독립된 Chrome GUI 재실행까지 이 검토에서 수행한 것은 아님.
- 모든 50개 원문의 필수·우대 의미 정답률과 로드맵 사람의 개별 내용 승인: 미완료.
- 현재 Preview의 배포 READY는 동작 정확성에 대한 승인으로 간주하지 않음.

**검토 판정: 코드 구현·배포·CI 확인, 원문 의미 정확성 및 완전한 사용자 검토 흐름은 보류.**
