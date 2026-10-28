# Supabase 연결 현황 및 남은 설정

## 완료

사용자가 junyeong-lab's Org를 선택해 새 프로젝트 muttaji 생성. 견적 월 $0, 조직 Free 요금제, 서울 ap-northeast-2. 프로젝트 ref는 crhhmqwarkqcrhanzjbu이며 공개 API URL은 https://crhhmqwarkqcrhanzjbu.supabase.co 입니다. 기존 중지 프로젝트 두 개는 변경하지 않았습니다.

대시보드: https://supabase.com/dashboard/project/crhhmqwarkqcrhanzjbu

Supabase 플러그인으로 새 전용 DB에 muttaji_private.quota_state, muttaji_private.quota_daily와 public.muttaji_reserve_quota 함수를 추가했습니다. 모든 테이블은 RLS를 켰고 service_role 전용 정책 및 권한만 부여했습니다. 함수는 SECURITY INVOKER, 빈 search_path 및 완전한 테이블 이름을 사용합니다. anon/authenticated의 함수 실행권한과 private 스키마 접근은 차단됨을 실제 DB에서 확인했습니다.

원본 공고, 개인 이력, AI 응답, API 키와 원본 IP는 저장하지 않습니다. 카운터에는 HMAC IP 식별값·무작위 세션 ID만 사용합니다. 만료된 일일 식별 카운터는 다음 예약 RPC 때 정리합니다. 유휴 기간에도 엄격히 2일 뒤 삭제하는 스케줄러는 아직 구성하지 않았습니다.

실제 DB에서 트랜잭션 테스트를 실행해 예산 초과·일일 제한·비활성 상태 차단을 확인했습니다. 테스트 쓰기는 모두 ROLLBACK했습니다. release1은 enabled=false, 예약액·모델 횟수·URL 횟수 모두 0이며 모델 예산과 전체 모델 한도도 0입니다. AI 운영 예산을 승인하거나 활성화하지 않았습니다.

## 앱 연결 코드

lib/public/supabase-quota.js가 서버에서 고정 RPC만 호출합니다. 서버용 sb_secret 키 또는 legacy service_role JWT만 허용하며 publishable/anon 키는 거부합니다. 공통 제한 모듈 인터페이스(scope:shared)를 유지해 나머지 모델 API·쿠키·CSRF 로직을 재사용합니다. 신규 운영 기본 저장소는 Supabase이며 Redis는 명시적으로 선택하는 대안으로 남겼습니다.

로컬 전체 테스트 173개 통과. 실제 DB 함수 검증과 로컬 서버 어댑터 테스트를 완료했으나, 실제 HTTP RPC를 앱 서버의 비밀 키로 인증하는 확인은 아직입니다. 연결된 Supabase 도구는 브라우저용 공개 키 조회만 제공하므로 서버용 Secret key는 사용자 컴퓨터나 Vercel 환경에서 별도로 설정해야 합니다.

## 남은 서버 전용 설정

- MUTTAJI_QUOTA_PROVIDER=supabase (미설정 시 기본값)
- MUTTAJI_SUPABASE_URL=https://crhhmqwarkqcrhanzjbu.supabase.co
- MUTTAJI_SUPABASE_SECRET_KEY: 대시보드의 서버 전용 Secret key. 브라우저·채팅·소스·로그에 넣지 않음
- MUTTAJI_QUOTA_NAMESPACE=release1

위 환경변수는 아직 생성·수정하지 않았습니다. 기존 OpenAI 키·Vercel 환경변수도 변경하지 않았습니다. 로컬 preview의 process 횟수 제한은 기존 테스트 방식이며 운영 공유 제한은 배포용 public runtime에서 사용됩니다.

대시보드 Settings → API Keys에서 Secret key를 확인한 뒤, 사용자 컴퓨터 PowerShell의 숨김 입력으로만 설정할 수 있습니다:

```powershell
$env:MUTTAJI_SUPABASE_URL = "https://crhhmqwarkqcrhanzjbu.supabase.co"
$secret = Read-Host "Supabase 서버 Secret key" -AsSecureString
$env:MUTTAJI_SUPABASE_SECRET_KEY = [System.Net.NetworkCredential]::new("", $secret).Password.Trim()
Remove-Variable secret
node scripts/check-supabase-quota.mjs
```

검사 스크립트는 초기화하지 않은 connection-check namespace를 호출해 서버 권한만 확인합니다. 예산·횟수를 예약하지 않고 AI도 호출하지 않습니다. 성공 시 SUPABASE_RPC_CONNECTED가 출력됩니다. 실제 프로젝트에는 connection-check 원장을 생성하지 마세요.

## 운영 활성화는 별도 승인

Supabase DB의 release1 예산·전체 횟수와 enabled 값을 검토 후 설정해야 합니다. 이 값들은 서버 요청이 올릴 수 있는 매개변수가 아니며 DB 관리자가 설정합니다. enabled=false는 비상 중단 기능으로 사용할 수 있습니다. 원장을 삭제하거나 namespace를 변경해 한도를 초기화하지 마세요.

그 뒤 서버 비밀값·정확한 사이트 Origin을 Vercel에 설정하고 Preview 통합 테스트 후 Push·배포 승인을 받습니다. Upstash 가입이나 새 유료 리소스는 필요하지 않습니다. 무료 Supabase는 비활성 일시중지·용량 제한 등의 영향을 받을 수 있으며 저장소 장애 때는 AI 호출을 차단합니다.

## 검증 보안 원칙

서비스용 키는 서버에서만 사용합니다. SECURITY DEFINER를 사용하지 않았고 함수 실행은 service_role에만 허용됩니다. 테이블은 비공개 스키마에 있으며 RLS도 활성화했습니다. 전역 namespace 행을 FOR UPDATE로 잠근 트랜잭션 내에서 예산·전체 횟수·신원별 횟수를 함께 확인·차감합니다. DB 장애 시 메모리 제한으로 대체하지 않습니다. 기존 자격증 DB와 사용자의 브라우저 프로필은 변경하지 않았습니다.

SQL 재현 원본: db/supabase-quota.sql. 새 빈 프로젝트 초기화용이므로 이미 만든 이 프로젝트에 다시 실행하지 않습니다. 이번 실제 프로젝트 DDL은 원격 migration muttaji_usage_quota 및 muttaji_quota_service_policies로 기록했습니다.


## 운영 제한값 승인 후 설정

사용자가 전체 $1 예약 상한, 총 모델 4회, IP·브라우저 세션별 하루 3회 제한을 승인했습니다. release1의 budget_micros=1000000, max_model_requests=4, model_daily_limit=3으로 저장하고 조회로 확인했습니다. enabled=false를 유지하며 예약·사용 횟수는 0입니다. 원장을 초기화하거나 사용량을 삭제하지 않았습니다.

Vercel project-muttaji의 Production 환경에 새 비밀값 이외 설정 8개와 별도 무작위 세션 서명 비밀값(MUTTAJI_SESSION_SECRET, Sensitive)을 추가했습니다. 공개 활성화 플래그 3개는 false입니다. 기존 AI Gateway 변수 4개는 수정하지 않았습니다. 값 복호화도 하지 않았습니다.

아직 Production에 없는 사용자 비밀값은 OPENAI_API_KEY와 MUTTAJI_SUPABASE_SECRET_KEY입니다. 이 값들은 사용자 PowerShell 프로세스에만 있어 도구에서 가져오지 않았습니다. Vercel의 project-muttaji → Settings → Environment Variables에서 Sensitive·Production으로 사용자가 직접 등록해야 합니다. 채팅·소스·로그에 키를 남기지 않습니다. 기존 MUTTAJI_SESSION_SECRET은 덮어쓰지 않습니다.

배포 승인 전이므로 Supabase 예약 및 공개 기능을 켜지 않았고 Push·배포·유료 호출도 하지 않았습니다. 승인 후에는 예산 원장의 enabled와 Vercel 공개 활성화 설정, Preview용 정확한 Origin 등을 검토하여 적용합니다. Production 외 환경은 아직 설정하지 않았습니다.

## 2026-10-28 · URL 수집 일일·누적 앱 제한 해제

URL 수집은 일일/누적 앱 횟수 한도를 적용하지 않습니다. 대신 동일 IP 또는 익명 서명 세션의 분당 20회 초과 연속 요청을 일시 제한합니다. 이는 플랫폼 남용을 막기 위한 단기 보호 장치이지 일별 이용 한도가 아닙니다. Supabase `quota_state`의 URL 누적 카운터는 기록만 계속되며 기존 통계는 보존합니다. 모델 사용 예산·일일·누적 제한, 공개 활성화/비상중단 스위치, SSRF 및 robots 검증은 그대로 유지합니다.

요금제나 유료 기능은 변경하지 않았습니다. 클라우드 운영사 기본 제공량은 유한하므로 서비스 중단 또는 기존 유료 플랜의 초과 사용 요금 가능성은 남습니다. 코드상 횟수 제한 해제가 클라우드 자원 무제한을 의미하지 않습니다.

적용 마이그레이션: `db/migrations/20261028_unlimited_url_with_burst_guard.sql`. 기존 DB에 임의 재실행하거나 카운터를 초기화하지 마세요.
