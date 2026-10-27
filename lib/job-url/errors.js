export class ImportError extends Error {
  constructor(code,status=422){super(code);this.code=code;this.status=status;}
}
export const messages={
 INVALID_URL:"https://로 시작하는 공개 채용공고 URL을 입력해 주세요.",
 UNSAFE_URL:"내부 주소, IP 주소 또는 민감한 인증정보가 포함된 URL은 가져올 수 없습니다.",
 UNSAFE_DNS:"대상 주소가 공개 인터넷 주소로 확인되지 않아 차단했습니다.",
 DNS_FAILED:"사이트 주소를 확인하지 못했습니다.", TIMEOUT:"제한 시간 안에 본문을 받지 못했습니다.",
 TOO_LARGE:"본문이 수집 크기 제한을 초과했습니다.", INVALID_CONTENT_TYPE:"HTML 채용공고 페이지가 아닙니다.",
 UNSUPPORTED_ENCODING:"지원하지 않는 응답 압축·문자 형식입니다.", TOO_MANY_REDIRECTS:"이동 횟수가 제한을 초과했습니다.",
 REMOTE_BLOCKED:"사이트가 접근을 거부했습니다. 로그인·봇 차단 여부는 원문에서 확인해 주세요.",
 LOGIN_REQUIRED:"로그인이 필요한 페이지로 연결되었습니다.", BOT_CHALLENGE:"CAPTCHA 또는 자동 접근 확인 화면입니다.",
 REMOTE_ERROR:"원격 사이트가 본문을 정상적으로 반환하지 않았습니다.", FETCH_FAILED:"사이트에서 본문을 받지 못했습니다.",
 ROBOTS_DENIED:"사이트의 robots.txt 정책에 따라 자동 수집하지 않았습니다.",
 ROBOTS_UNAVAILABLE:"사이트의 수집 정책을 확인하지 못해 요청을 중단했습니다.",
 IMAGE_POSTING:"상세 모집요강이 이미지로 제공되어 링크에서 글자를 추출할 수 없습니다. 원문에서 공고 이미지를 저장하거나 캡처한 뒤, 이미지 업로드 → 이미지 글자 추출하기를 사용해 주세요.",
 NO_POSTING:"공개 HTML에서 채용공고 본문을 찾지 못했습니다. JavaScript 렌더링이 필요할 수 있습니다.",
 PARTIAL_POSTING:"기업명·직무 등 일부 정보만 확인되고 공고 본문은 찾지 못했습니다. 이미지·iframe·JavaScript 본문은 직접 붙여넣어 주세요.",
 MULTIPLE_POSTINGS:"여러 공고가 포함된 목록입니다. 개별 공고 URL을 사용해 주세요.",
 EXTRACT_TOO_LONG:"추출 결과가 기존 입력창의 20,000자·400줄 제한을 초과했습니다.",
 IMPORT_DISABLED:"URL 수집 API는 아직 서버에서 활성화하지 않았습니다.",
 ACCESS_DENIED:"URL 수집 접근 코드가 올바르지 않습니다.", RATE_LIMITED:"요청 횟수 제한에 도달했습니다. 잠시 후 다시 시도해 주세요.",
 SHARED_LIMITER_REQUIRED:"운영용 요청 제한 저장소가 준비되지 않아 실제 URL 수집은 비활성화 상태입니다.",
 INVALID_REQUEST:"요청 형식을 확인해 주세요.", ORIGIN_DENIED:"허용하지 않는 출처의 요청입니다."
};