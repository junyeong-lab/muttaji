> **과거 개발·점검 기록 — 2026-10-30 현재 제출 범위와 구분합니다.**
> 현재 앱은 규칙 기반 공고 분류·수동 수정, 보유 자격증 입력, 74개 자격증 검색과 명시/연관 후보 안내에 집중합니다. AI 분석·자동 충족 판정·로드맵은 최종 사용자 화면에서 제외했습니다.
> 아래 기능·개수·테스트 결과·설정 상태는 작성 당시 기록이며, 현재 운영 상태나 전체 공고 검증 완료를 뜻하지 않습니다. 최신 정보는 [현재 상태](current-status.md)와 [README](../README.md)를 확인하세요.

# 뭐따지? 채용공고 URL 수집·분석 연결 개발 보고

작성일: 2026-10-27 (한국 시간)
작업 폴더: C:/Users/user/Documents/Codex/2026-10-23/ai-agent-1-github-ai-agent/work/muttaji-url
로컬 브랜치: feat/job-url-import
기준 main: 01d000c5d414009c3f34edbd4db2cdbf5c487f9c

## 1. 구현한 기능과 동작 흐름

**URL 입력 → 본문 가져오기 → 추출 결과 확인·수정 → 확인 체크 → 기존 입력창 적용 → 규칙 분류 → 역량 비교·34개 자격증 추천·로드맵**을 연결했습니다.

- 링크를 입력하거나 가상 예제 링크를 넣는 것만으로 서버 수집·AI 호출을 실행하지 않습니다.
- 별도 접근 코드와 본문 가져오기 클릭이 필요합니다. 요청 본문에는 URL 하나만 보냅니다. 사용자 프로필·자격증·판단 근거는 URL 수집 API로 보내지 않습니다.
- JSON-LD JobPosting을 우선 읽습니다. 기업명, 부서, 직무, 담당업무, 필수·우대, 근무지, 게시일·마감일, 기술, 기타 제공 정보를 원문 근거와 함께 반환합니다. 없는 정보는 비워 둡니다.
- 구조화 데이터가 없으면 main/article 또는 알려진 공고 본문 영역을 찾아 메뉴·광고·관련 공고·푸터·폼·스크립트 등을 제외한 텍스트를 사용합니다. 본문을 찾지 못하면 실패합니다. 목록의 여러 공고를 하나로 조합하지 않습니다.
- 일부 정보만 얻은 경우 partial로 표시하며 전체 본문 수집 성공으로 안내하지 않습니다. 짧은 메타정보만 있으면 PARTIAL_POSTING으로 실패합니다.
- 추출 본문은 편집할 수 있습니다. 편집하면 확인 체크를 다시 해야 합니다. 확인 전에는 기존 공고 입력창을 바꾸지 않습니다.
- 적용은 입력창 교체를 명시합니다. 기존 입력을 기억해 적용 취소로 되돌릴 수 있습니다. 사용자가 그 뒤 입력창을 수정한 경우 취소가 새 입력을 덮어쓰지 않습니다.
- 수집 당시 근거와 사용자가 수정한 본문을 구분합니다. 확인한 URL 출처가 비교·로드맵까지 연결되고, 원문 링크와 수정 여부를 표시합니다.
- 기존 텍스트 직접 입력·수동 분류 수정·OCR·브라우저 프로필 저장·자격증 일치·추천·로드맵을 유지했습니다.

**현재 로컬 미리보기는 가상 수집 예제만 허용합니다.** 실제 사이트를 가져오는 서버 모듈은 구현했지만 공개 API 활성화는 잠가 두었습니다. 운영용 공유 요청 제한 장치가 연결되지 않은 상태에서 live로 켜지지 않습니다. 실제 모델 API는 호출하지 않습니다.

## 2. 추가·수정 파일

| 구분 | 주요 파일 |
| --- | --- |
| URL API | api/job-url-import.js |
| URL·IP·DNS 검증 | lib/job-url/policy.js |
| DNS 고정 HTTPS 전송 | lib/job-url/network.js |
| robots 정책 | lib/job-url/robots.js |
| HTML·JSON-LD 추출 | lib/job-url/extract.js |
| 리다이렉트·시간 제한·수집 조합 | lib/job-url/service.js |
| 인증·요청 제한·입출력·오류 | lib/job-url/api.js, errors.js |
| URL 검토 UI | assets/job-url-ui.js, index.html |
| AI 입력 준비 | assets/agent-input.js |
| 제공자 공통 응답 검증 | lib/agent/provider-interface.js |
| 기존 기능 연결 | assets/requirement-comparison.js, assets/roadmap.js |
| 개발 미리보기·실사이트 점검 | scripts/preview-agent.mjs, scripts/check-job-urls.mjs |
| 테스트·예제 | tests/job-url*.test.cjs, tests/fixtures/job-url/*.html |
| 설정 | package.json, package-lock.json, vercel.json, .gitignore |

이전 로컬 개발의 Mock·연결 설명 모듈과 테스트도 이 브랜치에 보존했습니다. 최신 main의 새 파서·자격증 34개·추천·확장된 준비 단계를 이전 23개 버전으로 덮어쓰지 않았습니다.

새 의존성은 parse5 8.0.1과 ipaddr.js 2.5.0입니다. 설치 스크립트 실행 없이 잠금 파일을 생성했습니다. 새 프레임워크, 유료 수집 서비스, 브라우저 자동화 서버, 클라우드 저장소는 추가하지 않았습니다.

자격증 DB의 Git blob 해시는 main과 작업 폴더 모두 `26c5828ad76f74f684f7bbba86b221569ecd6817`로 동일합니다. 공식 검증에 관한 기존 사용자 확인 메타데이터도 변경하지 않았습니다.

## 3. API 입력·출력 JSON 예시

POST /api/job-url-import

헤더: Content-Type: application/json, x-job-import-token: <서버에서 지정한 접근 코드>

```json
{"url":"https://jobs.example.org/demo/security"}
```

성공 응답의 주요 구조(가상 예제):

```json
{
  "mode": "mock",
  "aiEnabled": false,
  "data": {
    "schemaVersion": 1,
    "sourceUrl": "https://jobs.example.org/demo/security",
    "method": "jsonld",
    "contentStatus": "body",
    "reviewRequired": true,
    "fields": {
      "company": [{"value":"가상 기업","evidence":{"quote":"가상 기업","locator":"jsonld[0]$.@graph[1].hiringOrganization.name","sourceUrl":"https://jobs.example.org/demo/security"}}]
    },
    "text": "기업명: 가상 기업\n\n모집 직무: 보안 엔지니어\n...",
    "analysisInput": {"schemaVersion":1,"postingText":"...","source":{"url":"https://jobs.example.org/demo/security","method":"jsonld","reviewed":false},"untrusted":true,"aiEnabled":false}
  }
}
```

필드 인용은 HTML을 텍스트로 정리한 값이며, locator와 출처 URL을 함께 보존합니다. HTML 원문 바이트와 동일한 문자열이라고 보장하는 방식은 아닙니다. 모델 응답 근거는 사용자가 최종 확인·수정한 공고 텍스트와 프로필에 실제 존재해야 합니다.

실제 생성한 전체 요청·응답 예시는 별도 `job-url-api-examples.json`에 있습니다. 예제 사이트는 합성 입력이며 실제 공개 채용사이트라고 주장하지 않습니다.

주요 실패 코드: INVALID_URL, UNSAFE_URL, UNSAFE_DNS, ROBOTS_DENIED, ROBOTS_UNAVAILABLE, LOGIN_REQUIRED, BOT_CHALLENGE, NO_POSTING, PARTIAL_POSTING, MULTIPLE_POSTINGS, TIMEOUT, TOO_LARGE, INVALID_CONTENT_TYPE, ACCESS_DENIED, RATE_LIMITED, SHARED_LIMITER_REQUIRED. 실패 시 직접 붙여넣기 안내를 제공합니다. 원격 오류 본문과 비밀값은 응답하지 않습니다.

## 4. 테스트 결과와 실패 항목

`node --test tests/*.test.cjs`: **129개 통과, 실패 0개**.

- 기존 분류·수정·OCR 검토·비교·34개 DB·자격증 일치·추천·로드맵 회귀 검사
- 실제 입력 연결 설명·Mock·비활성화 정책 검사
- 정상 형식의 공개 URL + 가짜 DNS/전송 계층으로 실제 추출기·기존 파서 연결 검증
- JSON-LD, @graph, HTML 본문, 기업·직무·필수·우대, 원문 근거, 누락 정보
- 로그인·CAPTCHA·JS 셸·다중 공고·부분 정보·복잡한 HTML 안전 실패
- URL/IP 우회·혼합 DNS 응답·DNS 변경·리다이렉트·HTTP 하향 이동·시간 제한·실제 바이트 제한
- 인증·Origin·요청 횟수 제한·공유 제한 장치 장애 시 차단
- 사용자 확인 전 적용 금지, 편집 후 재확인, 적용 취소, 늦은 응답 무효화, 출처 연결
- 가짜 AI 어댑터의 원문·프로필 인용, 추천 자격증 ID, revision·응답 형식 검사

테스트 결과 전문은 `job-url-test-results.tap`에 있습니다. 테스트는 실제 모델과 실제 채용사이트에 요청하지 않습니다.

기존 main의 테스트는 type:module 아래 브라우저 UMD를 require하는 로더 문제를 테스트 전용 로더로 보완했습니다. 기존 로드맵 테스트 하나는 실행 코드보다 오래된 문구를 기대하고 있어, 같은 의미의 현재 문구인 ‘실습을 실무 경력과 구분하세요’를 검사하도록 맞췄습니다. 경력을 과장하지 않는 동작 검사는 유지했습니다.

새 서버가 실행되는 메시지는 확인했지만, 도구 환경의 브라우저에서 새 localhost 포트 연결이 시간 초과되었습니다. 따라서 **이번 URL 화면의 실제 브라우저 시각 검증은 미완료**이며 DOM 모의 통합 테스트와 동일하다고 표현하지 않습니다. 기존 사용자의 50627 탭·프로필은 조작하거나 삭제하지 않았습니다.

## 5. 실제 채용사이트별 점검

개발 중 공개 링크 각 1건으로 수집 계층을 점검했습니다. 검색 도구가 읽은 결과를 앱 수집기의 성공으로 간주하지 않았습니다. 선택한 개별 공고는 마감·삭제·변경될 수 있습니다.

| 사이트·샘플 | 관측 결과 | 의미 |
| --- | --- | --- |
| 사람인 rec_idx=49554833 | NO_POSTING | 공개 HTML에서 사용 가능한 공고 본문을 찾지 못함. 마감·페이지 변경·렌더링 여부는 확정하지 않음 |
| 잡코리아 GI_Read/50032590 | JSON-LD 250자, 회사·직무·지역·날짜 일부 | 필수·우대·담당업무 0개로 전체 본문 성공 검증이 아님. 이런 짧은 구조화 정보는 최종 코드에서 partial 표시하도록 보완 |
| 원티드 wd/274843 | ROBOTS_UNAVAILABLE | robots 정책을 확인하지 못해 본문 수집 중단 |
| Canonical Python Engineer | TIMEOUT | 이 실행 환경에서 10초 내 처리되지 않음. 사이트가 항상 실패한다는 뜻은 아님 |

**실제 사이트에서 전체 본문을 정상 추출한 성공 사례는 아직 확보하지 못했습니다.** 긍정 경로는 공개 HTML 형태의 합성 예제로 검증했습니다. 실제 사이트 전체 호환·최종 브라우저·운영 배포 검증은 남아 있습니다. 로그인·CAPTCHA·차단을 우회하지 않았고 숨은 API나 외부 iframe을 추적하지 않았습니다.

샘플 URL:
- https://www.saramin.co.kr/zf_user/jobs/relay/view?rec_idx=49554833
- https://www.jobkorea.co.kr/Recruit/GI_Read/50032590
- https://www.wanted.co.kr/wd/274843
- https://canonical.com/careers/5143074/python-engineer-remote

## 6. 보안 검증 결과

- HTTPS·기본 443만 허용하고 인증정보·민감한 토큰 쿼리·IP 리터럴·내부 호스트 이름을 차단합니다.
- DNS의 모든 응답을 검사합니다. 사설·루프백·링크로컬·CGNAT·예약·멀티캐스트·문서용·IPv4 매핑/터널 주소와 플랫폼 메타데이터 목적지를 차단합니다.
- 검증한 공개 IP를 HTTPS lookup에 고정하고 TLS SNI·인증서 검증은 원래 호스트로 유지합니다. 실제 연결 상대 IP도 검사합니다.
- 자동 리다이렉트를 사용하지 않습니다. 최대 3회 이동마다 URL·DNS·새 출처의 robots 정책을 재검사합니다.
- 전체 DNS·정책·원격 요청은 10초, API 입력 본문은 2초, 함수 제안 설정은 15초입니다. 응답 HTML 1MiB, robots 64KB, API 입력 6KB를 스트리밍 중 검사합니다.
- 압축 응답은 요청하지 않으며 서버가 강제로 압축하면 실패합니다. HTML과 지원되는 문자 인코딩만 처리합니다.
- 파싱 전 태그 12,000개·대략적 중첩 300단계를 제한하고, DOM 노드 50,000개·JSON-LD 탐색 3,000개도 제한합니다. 비정상 구조는 수집 범위를 줄여 안전하게 실패합니다.
- HTML은 파서의 데이터로만 처리하며 스크립트·iframe·외부 리소스를 실행·로드하지 않습니다. 표시에는 textContent를 사용합니다.
- 프로필·쿠키·접근 토큰·제공자 키를 원격 채용사이트에 전달하지 않습니다. 로그에 본문·프로필·토큰·원격 오류를 남기지 않습니다. 응답은 no-store입니다.
- 로컬 Mock은 프로세스 내 분당 5회 제한을 사용합니다. 이것을 분산 제한이라고 주장하지 않습니다. **운영 live는 공유·원자적 요청 제한 구현을 주입해야만 활성화**되며, 장애 시 차단합니다.
- 원격 공고는 AI 지시가 아닌 데이터입니다. AI 인터페이스는 별도 동의·소유자 활성화·정확한 인용·응답 검사를 요구하고 상태 제안을 자동 적용하지 않습니다. 실제 모델의 인젝션 저항성과 의미 정확성은 미검증입니다.

방어 설계 참고: [OWASP SSRF Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html), [Node.js DNS API](https://github.com/nodejs/node/blob/main/doc/api/dns.md). 자동 테스트는 보안 감사를 대체하지 않습니다.

## 7. 남은 구현 과제

1. 실제 사이트별 추가 공개 공고 검증과 허용되는 범위의 추출기 보완
2. URL 화면의 실제 브라우저 검증과 사용자 흐름·모바일 확인
3. 운영용 공유 요청 제한 장치 연결 및 승인 후 URL 수집 활성화
4. 제공자 선택·데이터 처리 검토·비용 설정 후 실제 AI 어댑터 구현
5. 프로필까지 전송하는 별도의 동의 화면 및 AI 제안의 검토·채택 UI 연결
6. 승인 후 GitHub Push·Preview 배포·운영 반영 판단

기술·관리 직무 구분, 핵심 기술, 상태 제안, 부족한 역량, 추천 자격증·이유, 다음 행동은 제공자 공통 응답 계약에 포함했으며 가짜 응답으로 검사했습니다. **실제 모델이 이런 결과를 생성하는 기능을 완료했다고 보고하지 않습니다.**

## 8. 실제 AI·URL 활성화 설정과 예상 비용

이번 작업의 유료 AI 호출 0회, 유료 수집 서비스 0개, 추가 클라우드 리소스 0개입니다. 기존 키·환경변수·예산 설정은 변경하지 않았습니다.

URL API의 신규 설정 이름은 JOB_URL_IMPORT_ENABLED, JOB_URL_IMPORT_ACCESS_TOKEN, JOB_URL_IMPORT_OWNER_APPROVED입니다. 이번에는 설정하지 않았습니다. 이 값을 넣는 것만으로 켜지지 않으며 api/job-url-import.js에 실제 공유 limiter를 연결해야 합니다. 기존 저장소·플랫폼의 제한 장치를 사용할 수 있는지 우선 검토하고, 새 리소스가 필요하면 비용과 대안을 보고한 뒤 승인을 받아야 합니다.

AI는 모델 제공자·서버 키·공고와 프로필의 전송 동의 범위·보관 및 학습 이용 정책·요청/토큰 제한·전용 예산·재시도 정책을 결정해야 합니다. 공통 인터페이스는 enabled와 ownerApproved, 요청별 externalAi 동의가 모두 참이어야 내부 어댑터에 전달합니다. 현재 실제 제공자 어댑터·SDK·생성 요청 경로는 추가하지 않았습니다.

제공자와 모델이 정해지지 않아 금액을 확정할 수 없습니다. 예상 모델 비용은 `입력 토큰 수 × 입력 단가 + 출력 토큰 수 × 출력 단가`이며 모델 선택 후 최신 단가로 산정해야 합니다. URL 수집을 배포하면 기존 호스팅의 함수·네트워크 사용량도 발생할 수 있습니다. 이번에는 배포하지 않았습니다.

## 9. 브랜치·커밋 주소와 실행

로컬 개발 브랜치: feat/job-url-import. 기존 작업 폴더 work/muttaji와 원격 main을 보존했습니다.

[분석·개발 기준 main 커밋](https://github.com/junyeong-lab/muttaji/commit/01d000c5d414009c3f34edbd4db2cdbf5c487f9c)

새 변경은 미커밋·미Push 상태입니다. 따라서 새 GitHub 브랜치·커밋 주소는 아직 없습니다. 별도 Push 승인 없이 주소를 만들기 위해 원격에 반영하지 않았습니다. 검토용 전체 소스 ZIP과 main 기준 패치를 제공합니다.

현재 50627 미리보기는 이전 폴더의 앱입니다. 새 폴더에서 아래처럼 실행해야 URL 화면을 볼 수 있습니다.

```powershell
cd "C:\Users\user\Documents\Codex\2026-10-23\ai-agent-1-github-ai-agent\work\muttaji-url"
node scripts/preview-agent.mjs 0
```

출력된 주소를 열고 ‘가상 예제 링크 넣기’ → ‘본문 가져오기’ → 확인·수정 → 체크 → ‘확인한 본문을 입력창에 적용’ → ‘텍스트 1차 분석하기’를 사용합니다. 가상 예제는 외부 사이트를 요청하지 않으며 공개 예제 코드 local-demo-code는 실제 운영 비밀키가 아닙니다. 분당 요청 제한에 걸리면 1분 뒤 실행하세요.

소스 ZIP을 다른 폴더에서 푸는 경우 먼저 `npm.cmd ci --ignore-scripts --no-audit --no-fund`로 잠금 파일의 의존성을 설치하세요. `npm.ps1` 실행 정책을 바꿀 필요가 없습니다.

새 포트는 별도 브라우저 저장 공간을 사용합니다. 이전 포트의 프로필을 삭제하거나 자동으로 옮기지 않았습니다. 새로고침하면 기존 동작대로 공고·비교 상태·판단 근거는 사라지므로 필요한 내용은 먼저 복사해 두세요.

## 2026-10-27: 링크 가져오기 연결

잡코리아 공고 기본 페이지에서 별도로 제공되는 공개 상세 모집요강을 수집해 합칩니다. 고정된 동일 사이트 경로만 사용하며 DNS·robots·시간·크기 제한을 재사용합니다. 상세 페이지 리다이렉트는 따라가지 않고 실패 처리합니다.

로컬에서 실제 URL 수집 실행:

```powershell
cd "C:\Users\user\Documents\Codex\2026-10-23\ai-agent-1-github-ai-agent\work\muttaji-url"
node scripts/preview-agent.mjs 0 --live-url
```

표시된 로컬 주소에서 URL 입력 → 접근 코드 `local-demo-code` → 본문 가져오기 → 내용 확인·수정 → 확인 체크 → 입력창에 적용 → 기존 분석 순서로 사용합니다. 이 코드는 루프백 로컬 미리보기용입니다. 외부 AI는 호출하지 않습니다. 운영 API 활성화·환경변수 변경·배포는 하지 않았습니다.

사용자 제공 잡코리아 50216612 실제 링크에서 기본정보와 상세 본문 2679자 수집 성공. 세 모집분야·공통자격요건을 포함합니다. 모든 잡코리아 공고나 타 사이트의 성공을 보장하지 않습니다. 브라우저 UI 전체 흐름은 별도 확인이 필요합니다. 테스트 131개 통과.


## 사람인 공개 본문 연결 (2026-10-27)

`/zf_user/jobs/relay/view?rec_idx=...` 링크를 같은 공고가 공개한 canonical 경로 `/zf_user/jobs/view?rec_idx=...`로 정규화합니다. 숫자 공고 ID 하나만 허용하고 추적 매개변수는 전달하지 않습니다. 기존 DNS/IP·robots·프로토콜·크기·시간 검증을 그대로 적용합니다. 이모지가 붙은 제목을 인식하고 근무조건·전형절차가 자격요건으로 섞이지 않게 합니다.

실제 rec_idx=55336814에서 본문 440자 수집 성공. 이 링크는 한화생명 사무지원직(비서) 채용이며 정보보호직과 다릅니다. 모든 사람인 공고를 지원한다고 검증한 것은 아닙니다. 원문 확인 후 기존 입력창에 적용합니다. 변경 후 로컬 서버 재시작이 필요합니다. 전체 자동 테스트 133개 통과. 유료 AI·Push·배포 없음.
