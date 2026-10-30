> **과거 개발·점검 기록 — 2026-10-30 현재 제출 범위와 구분합니다.**
> 현재 앱은 규칙 기반 공고 분류·수동 수정, 보유 자격증 입력, 74개 자격증 검색과 명시/연관 후보 안내에 집중합니다. AI 분석·자동 충족 판정·로드맵은 최종 사용자 화면에서 제외했습니다.
> 아래 기능·개수·테스트 결과·설정 상태는 작성 당시 기록이며, 현재 운영 상태나 전체 공고 검증 완료를 뜻하지 않습니다. 최신 정보는 [현재 상태](current-status.md)와 [README](../README.md)를 확인하세요.

# Vercel 배포 준비 결과

> 최신 결정: 사용자가 기존 Supabase 계정을 선택했습니다. Upstash는 생성하지 않았고 새 무료 Supabase muttaji 프로젝트를 준비했습니다. 현재 진행은 [Supabase 연결 현황](./supabase-setup.md)을 따릅니다. 아래 Redis 설정은 선택 대안이며 실행하지 않았습니다.

## 현재 상태

개발 브랜치 feat/job-url-import에서 준비한 코드입니다. main·원격 저장소·Vercel 환경변수는 변경하지 않았습니다. 리소스 생성, Push, 배포, 실제 OpenAI 호출은 이번 작업에 포함하지 않았습니다. 자동 테스트 170개 통과. 실제 Upstash와 Vercel에서의 통합 검증은 아직입니다.

## 변경한 경로

- api/model-analysis.js: 새 공개 모델 API
- api/session.js: 서명된 브라우저 세션 시작
- api/job-url-import.js: 같은 세션 및 공유 제한을 사용하는 공개 URL API
- lib/public/session.js: HttpOnly/Secure/SameSite 쿠키, CSRF, Vercel IP 기반 식별값
- lib/public/quota.js: Redis REST와 원자적 Lua 예산·횟수 예약
- lib/public/handler.js: 제한된 스트리밍 입력 읽기, 동의·세션·Origin 검증
- lib/public/runtime.js: 기본 비활성화, 서버 OpenAI 연결 및 실제 발신 본문 크기 제한
- assets/session-client.js: 두 기능이 세션 초기화 요청 하나를 공유
- assets/model-analysis-ui.js, assets/job-url-ui.js, index.html: 공개 모드에서는 접근 코드 칸을 숨기고 세션 사용
- api/analyze.js: 새 공개 모드 활성화 시 이전 Gateway 유료 경로 차단
- vercel.json: 새 함수 경로·실행 시간·자격증 DB 포함 설정

로컬 미리보기의 접근 코드 및 1회 테스트 방식은 유지합니다. 공개 API는 로컬 설정을 그대로 읽어 활성화하지 않습니다.

## 인증·한도 설계

로그인 계정 인증을 추가한 것은 아닙니다. 서명된 익명 브라우저 세션과 CSRF·동일 Origin 검사로 웹 요청을 보호하고, Vercel이 부여한 클라이언트 IP와 세션 각각에 일일 제한을 적용합니다. IP와 세션을 바꾸는 사용자를 완전히 식별하지는 못합니다. 회사·학교 등 같은 IP를 공유하는 사람들은 한도를 공유할 수 있습니다.

모델은 IP·세션별 하루 3회, URL 수집은 10회입니다. 모델 전체 요청 수는 서버 설정으로 최대 100회까지 제한하고 URL 수집은 전체 100회입니다. 예산·전체 횟수 키는 만료시키지 않으며 서버 재시작·배포가 한도를 초기화하지 않습니다. 일일 식별 카운터만 최대 2일 TTL을 둡니다. 공고·이력·모델 응답·API 키·원본 IP는 Redis에 보내지 않습니다. Redis에는 HMAC 처리한 IP 식별값, 무작위 세션 식별값 및 카운터를 보관합니다.

한 모델 요청 전에 $0.25(250000 microUSD)를 보수적으로 예약합니다. 성공·실패에 관계없이 자동 환급하지 않습니다. 실제 사용료와 같은 값은 아닙니다. 고정 모델 gpt-5.6-terra의 검토 가격(입력 $2/M, 출력 $12/M), 발신 JSON 최대 64KB, 출력 최대 4096토큰, 자동 재시도·도구 없음에 맞춘 방어적 예약입니다. 가격·모델·토큰 옵션을 변경하기 전에 상한을 다시 검토해야 하며 Vercel/Redis 비용이나 이 키의 다른 앱 사용료는 이 예산에 포함하지 않습니다.

예산·총 횟수·신원 제한 검사를 Redis Lua 한 명령으로 처리합니다. 허용된 요청만 예약 후 OpenAI를 호출합니다. 실패 시 로컬 메모리 제한으로 대체하지 않습니다. 초기화 표시·예산·전체 횟수 키가 없어져도 차단합니다.

## 무료 저장소 대안 및 다음 설정

공통 저장소가 없다고 사용자 확인을 받았습니다. Upstash Redis Free를 제안합니다. 공식 페이지 확인 시 $0, 250MB, 월 500K commands의 무료 옵션이 있습니다. 카드 등록 또는 유료 전환·자동 업그레이드를 선택하지 않습니다. 무료 한도 초과 또는 서비스 오류 시 코드가 AI 요청을 차단합니다. 장기 무료 제공·무중단을 보장하는 것은 아니며 실제 가입 화면의 요금제를 확인해야 합니다.

1. https://console.upstash.com/ 에서 로그인 또는 가입
2. Redis 데이터베이스 생성 화면에서 Free/$0 옵션 확인. 유료 플랜·결제 입력 요구 시 중단
3. 데이터베이스 이름 예: muttaji-usage. 이 문서 작성 중 계정·DB는 생성하지 않았음
4. REST URL과 쓰기 권한 REST token은 채팅·소스가 아닌 서버 환경변수에만 저장
5. no-eviction 설정 확인. 카운터의 임의 삭제·DB 초기화는 금지
6. 초기화는 아래 명령을 DB 콘솔에서 최초 1회만 실행. 기존 키가 있으면 중단하도록 작성됨

```lua
EVAL "if redis.call('EXISTS',KEYS[1],KEYS[2],KEYS[3],KEYS[4]) > 0 then return 'ALREADY_EXISTS_STOP' end; redis.call('MSET',KEYS[1],'ready-v1',KEYS[2],'0',KEYS[3],'0',KEYS[4],'0'); return 'INITIALIZED'" 4 muttaji:{release1}:ready muttaji:{release1}:reserved muttaji:{release1}:model:total muttaji:{release1}:url:total
```

키를 삭제하거나 namespace를 바꾸면 별도 원장으로 취급됩니다. 기존 한도 재개를 위해 임의로 초기화하지 마세요. 비상 중단은 ready 키를 paused로 변경하면 새 요청을 차단합니다. 이미 예약·진행 중인 호출까지 취소하는 것은 아닙니다.

## 활성화 시 필요한 서버 설정 (아직 미설정)

- OPENAI_API_KEY: 실제 OpenAI 서버 전용 키
- MUTTAJI_AI_MODEL: gpt-5.6-terra
- MUTTAJI_PUBLIC_ORIGIN: 정확한 HTTPS 사이트 origin(경로·마지막 / 없이)
- MUTTAJI_SESSION_SECRET: 32자 이상 무작위 서버 비밀값. 모든 함수에서 동일하게 유지
- MUTTAJI_QUOTA_REST_URL, MUTTAJI_QUOTA_REST_TOKEN: 무료 DB의 서버 자격증명
- MUTTAJI_QUOTA_NAMESPACE: release1 (기존 원장 보존)
- MUTTAJI_AI_BUDGET_MICROUSD: 예산 예약 상한. 예: 1000000은 $1. 아직 승인·적용한 운영 예산이 아님
- MUTTAJI_AI_TOTAL_REQUESTS: 전체 모델 요청 상한. 예: 4. 미승인 예시
- MUTTAJI_PUBLIC_ENABLED=true 및 MUTTAJI_PUBLIC_OWNER_APPROVED=true: 별도 공개 활성화 승인 후에만 설정
- MUTTAJI_PUBLIC_URL_ENABLED=true: URL 기능의 별도 활성화

숫자·서명·저장소 설정이 잘못되면 비활성화 또는 실패 처리합니다. Preview와 Production 모두 기본 비활성화합니다. 임의 Preview 도메인을 허용하지 않습니다.

## 검증 범위

기존 160개에 공개 모드 테스트 10개를 더해 총 170개 통과했습니다. 실제 Lua를 Fengari 테스트 VM에서 실행하여 동시 예약·IP/세션 한도·전체 한도·삭제된 상태 키 차단을 검증했습니다. 실제 AI SDK→OpenAI HTTP 경로는 가짜 fetch로 검증했습니다. 세션 위조·만료·CSRF/Origin·동의 누락·저장소 장애가 모델 호출을 막는지 확인했습니다. 공개 UI의 접근 코드 제거, 두 화면의 세션 초기화 공유, URL 오류 대체 경로를 검증했습니다.

실제 Upstash DB를 대상으로 한 EVAL/일관성·요금제 확인, Vercel 배포 빌드/실행, 공개 브라우저에서 전체 흐름, 실제 소액 호출 및 가격 재확인, 로그인/봇 대응 필요성 판단은 남아 있습니다. 따라서 현재 상태를 운영 검증 완료라고 표현하지 않습니다.

## 공식 참고 자료

- https://vercel.com/docs/functions/runtimes/node-js
- https://vercel.com/docs/headers/request-headers
- https://upstash.com/docs/redis/features/restapi
- https://upstash.com/pricing/redis
- https://developers.openai.com/api/docs/models/gpt-5.6-terra
