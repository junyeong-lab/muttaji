/* Actual-input explanations, evaluated only in this browser tab.
 * Deterministic text templates and topic matching, NOT model inference.
 * No network, storage, final verdicts or input instructions are executed.
 */
(function(root,factory){
  "use strict";
  const api=factory();
  if(typeof module==="object"&&module.exports)module.exports=api;
  if(root)root.MuttajiExperience=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(){
  "use strict";
  const fields=["goal-job","education","experience","certs","skills"];
  const labels={"goal-job":"목표 직무",education:"학력·전공",experience:"경력·프로젝트",certs:"보유 자격증",skills:"기술·지식"};
  const topics=[
    {id:"english-business-email",requirement:/(?:영어|영문|English).{0,80}(?:이메일|메일|e-?mail)|(?:이메일|e-?mail).{0,80}(?:영어|영문|English)/i,
      profile:/(?:영어|영문|English).{0,80}(?:이메일|메일|e-?mail)|(?:이메일|e-?mail).{0,80}(?:영어|영문|English)/i,fields:["experience","skills"],
      meaning:"해외 본사와 비즈니스 수준으로 영문 이메일을 작성·회신하는 능력에 관한 조건입니다.",
      connection:"영문 업무 이메일 작성·회신을 직접 언급한 사용자 입력을 연결했습니다. 일반 한국어 보고·협업 경험은 영문 이메일 능력의 직접 증빙이 아닙니다.",
      action:"영문 이메일 작성·회신 경험이 있다면 민감정보를 제외하고 역할·전달 내용·회신 결과를 정리하세요. 없다면 가상 취약점 조치 보고 영문 이메일을 연습하고 실습으로 구분하세요."},
    {id:"office-software",requirement:/(?:MS[\s-]*Office|Microsoft\s*Office|Excel|엑셀|PowerPoint|파워포인트|PPT)/i,
      profile:/(?:MS[\s-]*Office|Microsoft\s*Office|Excel|엑셀|PowerPoint|파워포인트|PPT)/i,fields:["experience","skills"],
      meaning:"Excel·PowerPoint와 같은 사무 프로그램을 실제로 활용하는 능력에 관한 조건입니다.",
      connection:"사무 프로그램명을 직접 명시한 입력을 연결했습니다. 일반 보고서 작성·협업 경험만으로 Excel·PowerPoint 사용 능력을 확정하지 않습니다.",
      action:"직접 만든 Excel 표·함수·차트와 PowerPoint 발표 자료가 있다면 사용한 기능과 작성 범위를 구분해 정리하세요."},
    {id:"mobility",requirement:/출장|상주|비상주|교대\s*근무/,profile:/출장|상주|비상주|교대\s*근무/,fields:["experience","skills"],
      meaning:"공고에 적힌 근무 방식과 출장 업무에 대응하는 조건입니다.",connection:"입력한 업무 수행 가능 여부를 이 조건에 대한 설명으로 연결했습니다.",
      action:"입력한 근무·출장 가능 여부를 지원서의 근무 조건 항목에 활용할 수 있습니다."},
    {id:"communication",requirement:/커뮤니케이션|소통|협업|고객\s*대응|의사소통/,profile:/커뮤니케이션|소통|협업|고객|보고|조율/,fields:["experience","skills"],
      meaning:"동료나 고객과 정보를 나누고 함께 업무를 진행하는 역량에 관한 조건입니다.",connection:"입력한 소통·협업 내용을 함께 일한 경험을 설명하는 데 연결했습니다.",
      action:"소통한 대상과 함께 진행한 업무를 중심으로 지원서에 소개할 수 있습니다."},
    {id:"masters",requirement:/석사/,profile:/석사/,fields:["education"],
      meaning:"석사 학위에 관한 조건입니다.",connection:"석사를 직접 언급한 학력 입력을 연결했습니다. 학위 취득 여부를 자동 확정하지 않습니다.",action:"석사 학위 관련 입력이 있다면 취득·재학·졸업예정 상태를 구분해 소개할 수 있습니다."},
    {id:"doctorate",requirement:/박사/,profile:/박사/,fields:["education"],
      meaning:"박사 학위에 관한 조건입니다.",connection:"박사를 직접 언급한 학력 입력을 연결했습니다. 학위 취득 여부를 자동 확정하지 않습니다.",action:"박사 학위 관련 입력이 있다면 취득·재학·졸업예정 상태를 구분해 소개할 수 있습니다."},
    {id:"documentation",requirement:/문서\s*작성|보고서|보고\s*역량/,profile:/문서|보고|분석\s*자료|작성|산출물/,fields:["experience","skills"],
      meaning:"문서·보고서 작성 역량과 관련된 조건입니다.",connection:"입력한 문서·보고자료 작성 경험을 연결했습니다. 작성 역량의 우수성을 자동 판정하지 않습니다.",action:"공개 가능한 범위에서 문서의 목적, 본인이 작성한 부분, 활용 결과를 소개할 수 있습니다."},
    {id:"related-work",requirement:/유관\s*업무|관련\s*업무/,profile:/업무|수행|담당|운영|점검|기관평가|위협|보안|보고|프로젝트/,fields:["experience"],
      meaning:"관련 업무를 수행한 경험에 관한 조건입니다.",connection:"입력한 관련 업무 경험을 연결했습니다.",action:"본인이 맡은 업무와 결과를 공고의 업무에 맞춰 소개할 수 있습니다. 회사의 경력 인정 여부는 별개입니다."},
    {id:"unrestricted-degree",requirement:/^(?:학력\s*[:：]\s*)?학력\s*무관\s*$/i,profile:/$^/,fields:[],
      meaning:"학력 제한이 없는 채용 조건입니다.",connection:"공고에 학력무관이 명시돼 있어 별도의 최저 학력 요건은 없습니다. 다른 지원 조건은 별도 확인이 필요합니다.",
      action:"학력 요건 때문에 지원이 제한되지는 않습니다. 경력·기술·자격증 등 다른 요건을 확인하세요."},
    {id:"degree",requirement:/학력|학사|대졸|졸업/,profile:/대학교|대학|학사|학위|졸업|재학|졸업예정/,fields:["education"],
      meaning:"졸업·졸업예정 여부와 학위 수준에 관한 조건입니다.",connection:"입력한 학력 정보를 연결했습니다. 학교·전공명만으로 졸업 여부나 학위를 확정하지 않습니다.",
      action:"지원서에 실제 졸업·재학·졸업예정 상태와 해당 학위를 구분해 기재할 수 있습니다."},
    {id:"education",requirement:/전공|학력|관련\s*학과|공학\s*계열|학사|석사|졸업/,profile:/전공|학과|공학|학사|석사|졸업|재학/,fields:["education"],
      meaning:"전공이나 학력 배경과 관련된 조건입니다.",connection:"입력한 학력·전공 배경을 이 조건 옆에 연결했습니다.",
      action:"전공에서 배운 내용 중 지원 직무와 이어지는 주제를 지원서에 활용할 수 있습니다."},
    {id:"certificate",requirement:/자격증|기사|산업기사|심사원|SQLD|SQLP|CPPG|CISSP|CCNA|certif/i,profile:/기사|자격|심사원|관리사|마스터|SQLD|SQLP|CPPG|CISSP|CCNA|certif/i,fields:["certs"],
      meaning:"공고에서 명시한 자격증 또는 관련 자격 보유에 관한 조건입니다.",connection:"입력한 자격증을 공고의 자격 관련 조건과 연결해 보여드립니다.",
      action:"보유한 자격증명은 지원서의 자격 사항에 활용할 수 있습니다. 추가 취득을 준비한다면 공식 시행기관 자료를 기준으로 계획하세요."},
    {id:"motivation",requirement:/커리어|성장|시작하고|관심|열정|의지/,profile:/커리어|성장|시작|관심|배우|공부|싶|지원/,fields:["goal-job","experience","skills"],
      meaning:"해당 분야에서 일하고 성장하려는 방향과 의지를 묻는 조건입니다.",connection:"입력한 진로 방향이나 학습 의지를 지원 동기를 설명하는 데 연결했습니다.",
      action:"이 분야에 관심을 갖게 된 계기와 현재 하고 있는 준비를 지원 동기에 활용할 수 있습니다."},
    {id:"linux",requirement:/linux|리눅스/i,profile:/linux|리눅스/i,fields:["experience","skills"],
      meaning:"Linux 환경을 다루는 지식이나 경험에 관한 조건입니다.",connection:"Linux 관련 입력을 공고에서 요구한 환경과 연결했습니다.",
      action:"Linux 환경에서 다룬 계정·권한·서비스·로그 작업을 정리하거나 실습 기록으로 남길 수 있습니다."},
    {id:"ai-usage",requirement:/\bAI\b|인공지능|생성형\s*AI|LLM|머신러닝/i,profile:/\bAI\b|인공지능|ALEPH|LLM|OpenAI|GPT|AI\s*Agent|에이전트|프롬프트/i,fields:["experience","skills"],
      meaning:"업무나 프로젝트에서 AI를 활용할 수 있는 역량에 관한 조건입니다.",connection:"입력한 AI 교육·프로젝트 관련 문구를 연결했습니다. 교육 이력만으로 실제 활용 능력과 결과를 확정하지 않습니다.",
      action:"사용한 AI 도구, 직접 수행한 분석·자동화 작업, 결과와 본인 기여를 구체적으로 정리하세요."},
    {id:"programming",requirement:/프로그래밍|코딩|코드\s*작성|프로그래밍\s*언어/i,profile:/프로그래밍|코딩|코드|JavaScript|TypeScript|Python|\bJava\b|C\+\+|C#|웹\s*(?:앱|서비스)\s*(?:개발|구현)|(?:앱|웹앱|서비스)\s*(?:개발|구현)|개발\s*(?:프로젝트|경험)|GitHub/i,fields:["experience","skills"],
      meaning:"프로그램을 직접 작성·수정·구현하는 역량에 관한 우대조건입니다.",connection:"입력한 개발·코딩 관련 경험을 연결했습니다. 작성 언어와 실제 구현 범위는 추가 확인이 필요합니다.",
      action:"사용한 언어·도구와 직접 구현한 기능, 코드 작성·수정 범위를 포트폴리오에 정리하세요."},
    {id:"logs",requirement:/(?<![프블])로그|위협\s*탐지|threat\s*hunting|SIEM|관제/i,profile:/(?<![프블])로그|위협\s*탐지|threat\s*hunting|SIEM|관제/i,fields:["experience","skills"],
      meaning:"기록과 이벤트를 살펴 이상 징후를 분석하는 업무와 관련된 조건입니다.",connection:"입력한 로그·탐지 관련 내용을 공고의 분석 업무와 연결했습니다.",
      action:"분석한 자료, 사용 도구, 본인의 역할과 결과를 프로젝트 소개에 활용할 수 있습니다."},
    {id:"project",requirement:/프로젝트|인턴|스터디|동아리|대외활동/,profile:/프로젝트|인턴|스터디|동아리|대외활동|학습|공부|구축|개발|실습/,fields:["experience"],
      meaning:"직접 참여한 활동에서 쌓은 경험을 소개할 수 있는 조건입니다.",connection:"입력한 프로젝트·학습 활동을 경험을 소개하는 자료로 연결했습니다.",
      action:"현재 진행한 작업은 결과물과 본인 역할로 정리하고, 계획은 다음 실행 단계로 이어갈 수 있습니다."},
    {id:"security",requirement:/보안|컨설팅|취약점|정보보호|ISMS|ISO\s*27001/i,profile:/보안|컨설팅|취약점|정보보호|점검|사이버|기관평가|감사|IPS|IDS|WAF|방화벽/i,fields:["experience","skills"],
      meaning:"보안 업무에 필요한 이해나 관련 경험을 다루는 조건입니다.",connection:"입력한 보안 점검·학습·구축 관련 내용을 공고의 보안 업무와 연결했습니다.",
      action:"직접 다룬 대상, 적용한 기준, 본인의 역할을 중심으로 보안 경험을 소개할 수 있습니다."},
    {id:"experience",requirement:/경력|실무|\d+\s*년/,profile:/경력|실무|근무|수행|담당|운영|개월|\d+\s*년/,fields:["experience"],
      meaning:"관련 업무의 종류나 수행 기간에 관한 조건입니다.",connection:"입력한 업무 경험을 공고와 함께 살펴볼 수 있도록 연결했습니다. 경력 기간을 새로 계산하거나 추정하지 않습니다.",
      action:"이미 입력한 업무와 수행 기간을 경력 소개에 활용할 수 있습니다."}
  ];
  // Specific technology/standard requirements take precedence over generic
  // "security" words. A related input is evidence for discussion, never proof
  // that the named technology was operated or the qualification was met.
  const focusedTopics=[
    {id:"named-vendor-products",requirement:/시큐아이|지니언스|소만사|\bSECUI\b|\bGENIANS\b|\bSOMANSA\b/i,
      profile:/시큐아이|지니언스|소만사|\bSECUI\b|\bGENIANS\b|\bSOMANSA\b|\bGenian\b/i,
      fields:["experience","skills"],
      meaning:"공고에 명시된 제조사의 보안 제품을 직접 다룬 경력에 관한 우대조건입니다.",
      connection:"공고에 명시된 제조사 제품을 다룬 업무 입력을 연결했습니다. 제품명 일치만으로 실제 수행 내용과 경력 인정 여부가 검증되지는 않습니다.",
      action:"실제 다룬 제조사·제품명, 구축·운영·유지보수 역할과 수행 기간을 확인하세요. 해당 경험이 없다면 일반 보안교육이나 점검으로 대신할 수 없습니다."},
    {id:"nac-product-work",requirement:/\bNAC\b|네트워크\s*접근\s*제어/i,
      profile:/\bNAC\b|네트워크\s*접근\s*제어/i,
      fields:["experience","skills"],
      meaning:"NAC(네트워크 접근제어) 제품의 구축·운영 경험을 요구하는 조건입니다.",
      connection:"NAC 제품과 직접 관련된 수행 업무를 입력한 경우에만 근거를 연결했습니다. 일반 보안점검이나 교육은 NAC 운영 경력이 아닙니다.",
      action:"다룬 NAC 제품명, 정책 설정·운영·장애 대응 범위 및 수행 기간을 확인하세요."},
    {id:"web-application-firewall-work",requirement:/웹\s*방화벽|\bWAF\b/i,
      profile:/웹\s*방화벽|\bWAF\b/i,
      fields:["experience","skills"],
      meaning:"웹방화벽(WAF) 제품의 구축·설계·운영·유지보수 경험에 관한 우대조건입니다.",
      connection:"웹방화벽에 대한 직접 수행 업무만 연결했습니다. XDR 프로젝트·일반 방화벽·보안교육은 웹방화벽 운영 경력과 다릅니다.",
      action:"직접 다룬 WAF 제품명과 구축·설계·운영·유지보수 역할 및 수행 기간을 확인하세요."},
    {id:"security-operations",requirement:/보안\s*정책\s*변경|운영\s*절차\s*(?:수립|개선)/i,
      profile:/보안\s*정책\s*(?:변경|수립|개선|설정)|(?:보안\s*)?장애\s*(?:대응|처리|복구)|운영\s*절차\s*(?:수립|개선)|보안\s*프로세스\s*(?:수립|개선)/i,
      related:/보안\s*정책|운영\s*절차/i,
      fields:["experience","skills"],
      meaning:"보안정책 변경, 장애 대응, 운영 절차 수립·개선 등 실제로 수행한 조치를 요구하는 조건입니다.",
      connection:"정책 점검과 정책 변경은 다른 활동입니다. 연결된 문구만으로 장애 대응이나 절차 수립·개선까지 수행했다고 판단하지 않습니다.",
      action:"실제로 변경한 정책, 해결한 장애, 수립하거나 개선한 운영 절차가 있다면 각각 역할과 결과를 구분해 기록하세요."},
    {id:"collaboration-documentation",requirement:/유관\s*부서[\s\S]{0,100}(?:문서화|문서|보고서|기록)/i,
      profile:/협업|협의|조율|부서\s*간|유관\s*부서|문서화|보고용|보고서|(?:분석|보고)\s*자료\s*작성/i,
      fields:["experience","skills"],
      meaning:"보안 이슈를 유관 부서와 함께 해결하는 역량과 운영 내용을 문서로 남기는 역량을 함께 요구하는 조건입니다.",
      connection:"협업과 보고·문서 작성 근거를 각각 연결했습니다. 별개의 경험이 있다고 해서 동일한 보안 이슈를 공동 해결하고 운영 내용을 문서화했다는 뜻은 아닙니다.",
      action:"공동 해결한 보안 이슈가 있다면 협업 대상과 본인 역할을, 문서화한 내용이 있다면 자료의 용도와 작성 범위를 별도로 정리하세요."},
    {id:"aws",requirement:/\bAWS\b|Amazon\s+Web\s+Services|아마존\s*웹\s*서비스/i,
      profile:/\bAWS\b|Amazon\s+Web\s+Services|아마존\s*웹\s*서비스/i,
      fields:["experience","skills"],
      meaning:"AWS 환경 또는 AWS 보안 서비스에 관한 조건입니다.",
      connection:"AWS를 명시한 사용자 입력만 연결했습니다. 단순 언급·교육·실습과 실제 운영 경험은 다르며, 수행 범위는 별도 확인이 필요합니다.",
      action:"AWS에서 실제로 다룬 서비스, 설정·운영 내용과 본인 역할을 구분해 작성하세요."},
    {id:"isms-compliance",requirement:/ISMS(?:\s*-\s*P)?|보안\s*컴플라이언스|정보보호\s*관리\s*체계|인증\s*심사/i,
      profile:/ISMS(?:\s*-\s*P)?|정보보호\s*관리\s*체계|보안\s*컴플라이언스|인증\s*심사/i,
      related:/기관\s*평가|보안\s*감사|ISO\s*27001|심사\s*대응/i,
      fields:["experience","skills"],
      meaning:"보안 관리체계 및 인증·심사 대응 경험에 관한 조건입니다.",
      connection:"관리체계·인증심사 관련 입력 또는 기관평가 등 유사 경험을 연결했습니다. 기관평가와 ISMS-P 인증심사는 동일한 수행 경험으로 간주하지 않습니다.",
      action:"실제 수행한 평가·심사의 종류, 적용 기준과 본인 역할을 구분해 기술하세요. ISMS-P 참여 여부는 별도 확인해야 합니다."},
    {id:"security-tools",requirement:/\b(?:WAF|IPS|IDS|EDR|EPP|XDR|DLP)\b|방화벽|서버\s*접근제어|보안\s*(?:장비|솔루션)(?:을|를)?\s*(?:운영|구축|유지보수|관리)/i,
      profile:/\b(?:WAF|IPS|IDS|EDR|EPP|XDR|DLP)\b|방화벽|서버\s*접근제어|(?:보안\s*)?(?:솔루션|장비)(?:을|를)?\s*(?:운영|구축|유지보수|설정|관리)/i,
      related:/보안\s*장비\s*점검|네트워크\s*보안\s*장비/i,
      fields:["experience","skills"],
      meaning:"구체적인 보안 제품·장비의 구축 또는 운영 경험을 요구하는 조건입니다.",
      connection:"보안 제품명 또는 구체적 장비 운영·구축 관련 입력만 연결했습니다. 요구 제품과 다른 기술의 프로젝트는 유사 경험으로만 표시하며, 일반 보안점검 이력은 제품 운영 경력으로 보지 않습니다.",
      action:"실제 취급한 솔루션명과 구축·운영·장애 대응 범위, 실습과 실무의 차이를 구분해 정리하세요."},
    {id:"network-protocols",requirement:/TCP\s*\/\s*IP|HTTP(?:S|\/HTTPS)?|SSL\s*\/\s*TLS|주요\s*프로토콜|네트워크.{0,30}서버.{0,30}웹/i,
      profile:/TCP\s*\/\s*IP|HTTP(?:S|\/HTTPS)?|SSL\s*\/\s*TLS/i,
      related:/\b(?:GNS3|VLAN|OSPF|BGP)\b|라우팅|네트워크\s*(?:설계|구축|운영)|서버\s*(?:구축|운영)/i,
      fields:["experience","skills"],
      meaning:"네트워크·서버 환경과 프로토콜 이해에 관한 조건입니다.",
      connection:"명시된 프로토콜 입력 또는 네트워크·서버 구축 관련 입력을 구분해 연결했습니다. 주변 기술 경험만으로 모든 프로토콜 이해를 확정하지 않습니다.",
      action:"TCP/IP·HTTP/HTTPS·TLS 중 실제 이해하거나 실습한 내용을 구분해 확인하고 설명 자료를 준비하세요."},
    {id:"incident-response",requirement:/제로\s*데이|제로데이|\bL7\b|침해\s*사고\s*대응|침해사고\s*대응|\bIR\b.*(?:실무|경험)/i,
      profile:/제로\s*데이|제로데이|\bL7\b|침해\s*사고|침해사고|\bIR\b/i,
      related:/(?:사이버\s*)?위협\s*분석|취약점\s*분석|침입\s*탐지/i,
      fields:["experience","skills"],
      meaning:"특정 위협 분석 또는 침해사고 대응 경험에 관한 조건입니다.",
      connection:"침해사고 대응을 명시한 입력 또는 위협·취약점 분석 등 유사 경험을 구분해 연결했습니다. 분석 업무만으로 사고 대응 경험을 확정하지 않습니다.",
      action:"취약점 분석, 위협 분석, 실제 침해사고 대응 중 수행한 업무와 결과를 각각 구분해 기록하세요."}
  ];
  const learningEvidence=/교육(?:\s*(?:과정|수강|이수))?|실습|수강|스터디|학습|훈련/;
  // Different security products are not interchangeable. Listing XDR in a
  // profile is related context for an EDR/WAF vacancy, not evidence of
  // operating the named products or troubleshooting a deployed solution.
  const namedSecurityTools=[
    {name:"WAF",pattern:/\bWAF\b/i},{name:"IPS",pattern:/\bIPS\b/i},
    {name:"IDS",pattern:/\bIDS\b/i},{name:"EDR",pattern:/\bEDR\b/i},
    {name:"EPP",pattern:/\bEPP\b/i},{name:"XDR",pattern:/\bXDR\b/i},
    {name:"DLP",pattern:/\bDLP\b/i},{name:"방화벽",pattern:/방화벽/},
    {name:"서버접근제어",pattern:/서버\s*접근제어/}
  ];
  function profileLinkKind(topic,quote,requirementText=""){
    // Manufacturer/product experience requires the same named technology and
    // explicit hands-on work; cybersecurity-related vocabulary is not evidence.
    if(["named-vendor-products","nac-product-work","web-application-firewall-work"].includes(topic.id)){
      let sameName;
      if(topic.id==="named-vendor-products"){
        const vendors=[/시큐아이|\bSECUI\b/i,/지니언스|\bGENIANS\b|\bGenian\b/i,/소만사|\bSOMANSA\b/i];
        sameName=vendors.some(pattern=>pattern.test(requirementText)&&pattern.test(quote));
      }else sameName=topic.profile.test(quote);
      if(!sameName||learningEvidence.test(quote)||planned.test(quote)||absent.test(quote))return null;
      if(!/(?:경력|실무|구축|설계|운영|유지\s*보수|설정|관리|담당|기술\s*지원|장애\s*대응|적용|배포)/i.test(quote))return null;
      return "요구 제품·제조사 및 직접 수행 업무 입력(실제 수행·기간 확인 필요)";
    }
    if(!topic.focused){
      if(learningEvidence.test(quote))return "교육·실습 입력";
      return null;
    }
    if(topic.id==="security-operations"){
      if(topic.profile.test(quote))return "조치 관련 입력(정책 변경·장애 대응·절차 개선은 별도 확인)";
      if(topic.related?.test(quote))return "유사·연관 경험(정책 점검과 정책 변경은 다름)";
      return null;
    }
    if(topic.id==="collaboration-documentation"){
      const cooperation=/협업|협의|조율|부서\s*간|유관\s*부서/i.test(quote);
      const documentation=/문서화|보고용|보고서|(?:분석|보고)\s*자료\s*작성/i.test(quote);
      if(cooperation&&documentation)return "협업·문서 관련 입력(보안 이슈 해결 여부 미확인)";
      if(cooperation)return "협업 관련 입력(보안 이슈 해결 여부 미확인)";
      if(documentation)return "보고·문서 작성 관련 입력(운영 내용 문서화 여부 미확인)";
      return null;
    }
    if(topic.id==="security-tools"){
      const required=namedSecurityTools.filter(tool=>tool.pattern.test(requirementText)).map(tool=>tool.name);
      const mentioned=namedSecurityTools.filter(tool=>tool.pattern.test(quote)).map(tool=>tool.name);
      if(required.length){
        if(mentioned.some(name=>required.includes(name)))
          return "요구 제품명 일치(실제 운영 여부 미확인)";
        if(mentioned.length)
          return "유사·연관 프로젝트(공고 요구 제품과 다름)";
        if(topic.profile.test(quote)||topic.related?.test(quote))
          return "유사·연관 경험(공고 요구 제품 미확인)";
        return null;
      }
      if(topic.profile.test(quote)){
        // A security product name or project alone does not establish hands-on
        // solution deployment, operations or incident troubleshooting.
        if(/구축|운영|장애|트러블슈팅|유지보수/.test(requirementText)&&
            !/구축|운영|장애|트러블슈팅|유지보수|설정|관리/.test(quote))
          return "유사·연관 프로젝트(구축·운영 여부 미확인)";
        return "관련 기술·업무 명시(실제 수행 확인 필요)";
      }
      if(topic.related?.test(quote))return "유사·연관 경험(동일 경험 아님)";
      return null;
    }
    if(topic.profile.test(quote))return "관련 기술·표준 명시";
    if(topic.related?.test(quote))return "유사·연관 경험(동일 경험 아님)";
    return null;
  }
  const fallback={id:"general",meaning:"공고에 적힌 내용을 사용자 입력과 함께 살펴보는 항목입니다.",connection:"이 조건에 직접 입력한 내용을 설명의 근거로 함께 보여드립니다.",action:"입력한 경험 중 이 조건과 연결해 소개하고 싶은 내용을 지원 준비에 활용할 수 있습니다."};
  const planned=/예정|계획|준비\s*중|목표로|할\s*생각|구축할|개발할/;
  const absent=/없(?:음|습니다|어요|다)|미경험|미보유|하지\s*않|하지\s*못|아직.*(?:않|못)/;
  function sentences(text,source,field){
    const parts=[];const pattern=/[^\r\n.!?。]+[.!?。]?/g;let match;
    while((match=pattern.exec(text))){
      const value=match[0],leading=value.length-value.trimStart().length,quote=value.trim();
      if(quote)parts.push({source,field,label:labels[field]||"이 조건에 직접 입력한 근거",start:match.index+leading,end:match.index+leading+quote.length,quote});
    }
    return parts;
  }
  function readString(value,max){
    if(value===undefined||value===null)return "";
    if(typeof value!=="string"||value.length>max)throw new RangeError("입력 길이를 확인해 주세요.");
    return value;
  }
  function buildAnalysis({posting,requirements,profile={},assessments=[],certificateMatcher}){
    const text=readString(posting,20000);
    if(text.split(/\r\n|\r|\n/).length>400||!Array.isArray(requirements)||requirements.length>400||!Array.isArray(assessments))throw new RangeError("공고 요건을 확인해 주세요.");
    const sourceProfile=Object.fromEntries(fields.map(field=>[field,readString(profile[field],12000)]));
    const fragments=Object.fromEntries(fields.map(field=>[field,sentences(sourceProfile[field],"profile",field)]));
    const byId=new Map(assessments.map(item=>[item.id,item]));
    const explanations=requirements.map(item=>{
      if(!item||typeof item.id!=="string"||typeof item.text!=="string"||!["required","preferred"].includes(item.kind))throw new TypeError("유효한 공고 요건이 필요합니다.");
      // A category edit can move a line, but cannot invent a quote or location.
      const lines=text.split(/\r\n|\r|\n/),line=item.line,endLine=item.endLine||line;
      if(!Number.isInteger(line)||!Number.isInteger(endLine)||line<1||endLine<line||endLine>lines.length)throw new TypeError("공고 근거 위치가 필요합니다.");
      const source=lines.slice(line-1,endLine).join("\n");
      const fromItem=typeof item.source==="string"?item.source:source;
      // Parser joins wrapped lines; compare normalized whitespace only to bind
      // the requirement to these lines, then display the unchanged source quote.
      const normalized=value=>value.normalize("NFKC").replace(/\s+/g," ").trim();
      if(!normalized(source).includes(normalized(fromItem)) && !normalized(source).includes(normalized(item.text)))throw new TypeError("공고 원문과 요건이 일치하지 않습니다.");
      const focused=focusedTopics.find(entry=>entry.requirement.test(item.text)&&
        !(entry.id==="security-tools"&&/정보보호\s*또는\s*보안\s*솔루션/i.test(item.text)));
      const topic=focused?{...focused,focused:true}:(topics.find(entry=>entry.requirement.test(item.text))||fallback);
      // A broad "related certificate holder" condition can show self-reported
      // credentials as context, but does not imply the employer accepts them.
      // Named credentials must still be exact-matched against the posting.
      const genericCertificate=topic.id==="certificate"&&(
        /^(?:(?:IT|보안|정보보안)\s*)?(?:관련\s*)?자격증\s*(?:보유자|소지자|보유|소지|우대)$/i
          .test(item.text.replace(/^[·ㆍ•*\-\s]+/,"").trim()) ||
        /^(?:(?:IT|정보|보안|정보보안)\s*){1,3}관련\s*분야\s*전문\s*지식\s*및\s*자격증\s*(?:보유자|소지자|보유|소지)$/i
          .test(item.text.replace(/^[·ㆍ•*\-\s]+/,"").trim())
      );
      // Mixed named examples + "etc." can show RELATED credentials as evidence,
      // never as automatically employer-recognized qualifications.
      const broaderSecurityExamples=topic.id==="certificate"&&
        /(?:CISSP|CISA)[^\n]{0,70}등[^\n]{0,70}(?:IT\s*)?보안\s*관련\s*자격증/i.test(item.text);
      const assessment=byId.get(item.id);
      const manual=readString(assessment?.explanation,12000);
      const evidence=manual.trim()?[{source:"assessment",field:item.id,label:"이 조건에 직접 입력한 근거",start:0,end:manual.length,quote:manual}]:[];
      if(topic.fields)for(const field of topic.fields){
        for(const ref of fragments[field]){
          const relatedSecurityCertificate=broaderSecurityExamples&&
            /(?:정보보안(?:산업)?기사|CompTIA\s*Security\+)/i.test(ref.quote)&&
            !planned.test(ref.quote)&&!absent.test(ref.quote);
          const directCertificate=topic.id==="certificate"&&
            (typeof certificateMatcher==="function"?certificateMatcher(item.text,ref.quote)
              :ref.quote.split(/[,;\n]/).some(name=>{const n=name.trim();return n.length>=2&&item.text.toLowerCase().includes(n.toLowerCase());}));
          const matches=topic.id==="certificate"
            ? (genericCertificate
              ? topic.profile.test(ref.quote)&&!/미보유|미취득|준비\s*중|취득\s*예정|보유하지\s*않|취득하지\s*않|없습니다/.test(ref.quote)
              : directCertificate||relatedSecurityCertificate)
            : topic.focused?!!profileLinkKind(topic,ref.quote,item.text):topic.profile.test(ref.quote);
          if(matches&&!evidence.some(existing=>existing.quote.includes(ref.quote))){
            const relatedOnly=relatedSecurityCertificate&&!directCertificate;
            const linkKind=profileLinkKind(topic,ref.quote,item.text);
            const note=planned.test(ref.quote)?"계획·준비 입력":absent.test(ref.quote)?"미경험·미보유 입력":(topic.id==="collaboration-documentation"&&/협업|협의|조율|부서\s*간/i.test(ref.quote))?linkKind:learningEvidence.test(ref.quote)?"교육·실습 입력":linkKind;
            evidence.push({...ref,label:relatedOnly?ref.label+" · 관련 보안 자격증(채용사 인정 미확인)":note?ref.label+" · "+note:ref.label,
              relatedOnly});
          }
          if(evidence.length>=3)break;
        }
        if(evidence.length>=3)break;
      }
      const hasPlan=evidence.some(ref=>planned.test(ref.quote));
      const hasAbsence=evidence.some(ref=>absent.test(ref.quote));
      let explanation=evidence.length?topic.connection:"현재 입력에서 이 조건에 연결할 문구를 찾지 못했습니다. 선택한 상태는 그대로 유지합니다.";
      if(topic.id==="security"&&/\d+\s*년|경력|실무/.test(item.text)&&evidence.length)
        explanation+=" 관련 보안 업무 입력을 연결했을 뿐, 요구한 실무경력 기간이나 보안 솔루션 운영 경력을 확인·산정한 것은 아닙니다.";
      if(["named-vendor-products","nac-product-work","web-application-firewall-work"].includes(topic.id)&&!evidence.length)
        explanation="공고에 명시된 제품·제조사에 관한 직접 수행 경력을 입력에서 찾지 못했습니다. 일반 보안교육, 보안점검, 다른 솔루션 경험을 해당 제품 경력으로 연결하지 않습니다.";
      if(topic.focused&&evidence.length){
        if(evidence.some(ref=>ref.source==="profile"&&ref.label.includes("교육·실습 입력")))
          explanation+=" 연결된 교육·실습 이력은 업무 실적이나 실제 운영 경력의 증빙이 아닙니다.";
        if(evidence.some(ref=>ref.source==="profile"&&ref.label.includes("유사·연관")))
          explanation+=" 유사한 분야의 경험은 공고의 동일 기술·인증·업무를 수행했다는 뜻이 아닙니다.";
      }
      if(topic.id==="ai-usage"&&evidence.some(ref=>ref.source==="profile"&&learningEvidence.test(ref.quote)))
        explanation+=" 교육 이력은 실제 AI 자동화 수행 경험을 증명하지 않습니다.";
      if(topic.id==="english-business-email"&&!evidence.length)
        explanation="입력에서 비즈니스 영문 업무 이메일 경험을 직접 확인하지 못했습니다. 일반 한국어 보고·협업 경험만으로 영어 이메일 능력을 판단하지 않습니다.";
      if(topic.id==="office-software"&&!evidence.length)
        explanation="입력에서 Excel·PowerPoint 등 사무 프로그램을 직접 사용한 근거를 확인하지 못했습니다. 일반 문서 작성 경험만으로 사용 능력을 단정하지 않습니다.";
      if(genericCertificate&&evidence.length)
        explanation="자격증 입력란의 보유 자격증을 참고 근거로 연결했습니다. 해당 자격이 공고에서 말하는 '관련 자격증'에 해당하는지는 채용사의 인정 기준을 확인해야 합니다.";
      if(broaderSecurityExamples&&evidence.some(ref=>ref.relatedOnly))
        explanation="보유 입력에 있는 보안 관련 자격증을 참고 근거로 연결했습니다. 공고에 직접 명시된 CISSP·CISA와는 구분하며, 채용사의 인정 여부를 확인해야 합니다. 관련성만으로 우대조건을 자동 충족 처리하지 않습니다.";
      if(topic.id==="related-work"&&/인턴|알바/.test(item.text)&&evidence.length)explanation+=" 인턴·알바 표기만으로 다른 고용 형태의 경험을 배제하지 않습니다.";
      if(hasAbsence)explanation+=" 경험이 없다고 적은 내용도 입력 그대로 함께 보여드립니다.";
      if(hasPlan)explanation+=" 예정·계획은 앞으로 준비할 내용으로 소개할 수 있습니다.";
      let nextAction=evidence.length?topic.action:"이 항목은 선택한 상태대로 로드맵에 남겨두고, 필요할 때 관련 경험을 더할 수 있습니다.";
      if(["named-vendor-products","nac-product-work","web-application-firewall-work"].includes(topic.id))nextAction=topic.action;
      if(genericCertificate&&evidence.length)
        nextAction="자격증의 정확한 이름과 취득 사실을 확인하고, 지원 직무 관련성과 채용사 인정 여부를 원문 또는 채용 담당자에게 확인하세요.";
      if((topic.id==="english-business-email"||topic.id==="office-software")&&!evidence.length)
        nextAction=topic.action;
      if(broaderSecurityExamples&&evidence.some(ref=>ref.relatedOnly))
        nextAction="보유 자격증명과 취득 사실을 확인하고, 공고에 직접 예시되지 않은 보안 자격증을 우대로 인정하는지 채용 담당자에게 확인하세요.";
      if(topic.id==="unrestricted-degree"){
        explanation=topic.connection;
        nextAction=topic.action;
      }
      if(assessment?.status==="미충족"||assessment?.status==="부분 충족")nextAction+=" 보완하고 싶은 부분은 작은 학습·실습 과제로 나누어 시작할 수 있습니다.";
      // A degree is explicitly reported only when the education field states
      // completion. "졸업예정", attendance, or a school name alone never does.
      // This adjusts the explanation, not the user's self-assessment status.
      if(topic.id==="degree"&&evidence.some(ref=>ref.source==="profile"&&ref.field==="education")){
        const education=sourceProfile.education.normalize("NFKC").replace(/\s+/g," ");
        const college=/(?:대학교|대학(?!원)|학부|학사|석사|박사|대졸)/.test(education);
        const pending=/(?:졸업\s*예정|학위\s*취득\s*예정|재학|휴학|수료|중퇴|제적|미\s*졸업|비\s*졸업|졸업\s*하지\s*않|졸업\s*못|학위\s*미\s*취득)/.test(education);
        const completed=college&&/(?:졸업|학위\s*(?:취득|수여))/.test(education)&&!pending;
        if(completed){
          explanation="학력 입력란에 대학 졸업 또는 학위 취득이 명시되어 있어 대졸 이상 요건을 검토할 근거가 있습니다. 다만 입력 내용의 증빙과 채용사의 인정 여부는 별도 확인이 필요합니다.";
          nextAction="이력서에 졸업 학교, 전공, 학위와 졸업 연월을 실제 증빙에 맞게 기재하세요.";
        }else if(pending){
          explanation="학력 입력란에 재학·졸업예정 또는 미취득 상태가 표시되어 있습니다. 대졸 이상 조건의 적용 기준일과 졸업예정자 인정 여부는 공고 또는 채용사에 확인해야 합니다.";
          nextAction="재학·졸업예정·중퇴 등 실제 학적 상태를 정확히 기재하고 지원 가능 여부를 확인하세요.";
        }
      }
      return {schemaVersion:1,mode:"local-rules",requirementId:item.id,topic:topic.id,interpretation:topic.meaning,explanation,nextAction,
        postingEvidence:{source:"posting",line,endLine,quote:source},inputEvidence:evidence,
        basis:manual.trim()?"direct-input":evidence.length?"topic-match":"not-linked"};
    });
    return {schemaVersion:1,mode:"local-rules",label:"입력 기반 연결 설명 · AI 의미 분석 아님",explanations};
  }
  function renderExplanation(doc,container,value){
    container.replaceChildren();
    if(!value||value.mode!=="local-rules")return;
    const node=(tag,cls,text)=>{const element=doc.createElement(tag);if(cls)element.className=cls;if(text!==undefined)element.textContent=String(text);return element;};
    container.appendChild(node("h5","experience-heading","공고와 경험을 연결하면"));
    container.appendChild(node("p","experience-copy",value.interpretation));
    container.appendChild(node("p","experience-copy",value.explanation));
    const details=node("details","experience-evidence");
    details.appendChild(node("summary","","설명에 사용한 문구 보기"));
    details.appendChild(node("small","subtext","공고 원문 "+value.postingEvidence.line+"행"));
    details.appendChild(node("blockquote","experience-quote",value.postingEvidence.quote));
    for(const ref of value.inputEvidence){details.appendChild(node("small","subtext",ref.label));details.appendChild(node("blockquote","experience-quote",ref.quote));}
    if(!value.inputEvidence.length)details.appendChild(node("p","experience-copy","연결한 사용자 입력 없음"));
    container.appendChild(details);
    container.appendChild(node("h5","experience-heading","지원 준비에 활용하기"));
    container.appendChild(node("p","experience-copy",value.nextAction));
  }
  return {buildAnalysis,renderExplanation};
});