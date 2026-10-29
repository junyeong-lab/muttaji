/* 뭐따지? · 공고 요건과 본인 자체 점검 결과를 연결한 로컬 준비 순서.
 * AI 호출, 서버 전송, 영구 저장, 임의 기간/합격 확률 산출 없음.
 */
(function(root,factory){
  "use strict";
  const api=factory();
  if(typeof module==="object"&&module.exports)module.exports=api;
  if(root)root.MuttajiRoadmap=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(){
  "use strict";
  // Keep all four states visible in user-requested order.
  const states=["확인 필요","미충족","부분 충족","충족"];
  const order={"확인 필요":0,"미충족":1,"부분 충족":2,"충족":3};
  // Purely explicit unconditional eligibility statements. Do not treat mixed
  // work-experience conditions as unrestricted.
  function noExperienceThreshold(input){
    const value=String(input||"").normalize("NFKC").replace(/\s+/g," ").trim();
    return /^(?:경력\s*[:：]?\s*)?(?:경력\s*)?무관(?:\s*\(\s*신입\s*지원\s*가능\s*\))?$/.test(value)||
      /^신입\s*[/·]\s*경력\s*\(\s*연수\s*무관\s*\)$/.test(value)||
      /^(?:신입|신입\s*지원\s*가능)$/.test(value);
  }
  function noDegreeThreshold(input){
    return /^(?:최종\s*)?학력\s*[:：]?\s*(?:학력\s*)?무관$/.test(
      String(input||"").normalize("NFKC").replace(/\s+/g," ").trim());
  }
  function nextAction(item){
    const text=String(item.text||"");
    // Tailored guidance must follow the requirement, not the selected state.
    if(item.status!=="충족"){
      if(/시큐아이|지니언스|소만사|\bSECUI\b|\bGENIANS\b|\bSOMANSA\b/i.test(text))
        return "시큐아이·지니언스·소만사 중 실제로 다룬 제품 및 담당 업무를 확인하세요. 보안교육이나 일반 점검은 제품 경력의 근거가 아닙니다.";
      if(/\bNAC\b|네트워크\s*접근\s*제어/i.test(text))
        return "NAC 제품의 직접 구축·설정·운영 경력이 있는지 확인하세요. 일반 보안업무와 구분합니다.";
      if(/웹\s*방화벽|\bWAF\b/i.test(text))
        return "웹방화벽(WAF)의 구축·설계·유지보수 직접 경험이 있는지 확인하세요. XDR 경험은 WAF 경력이 아닙니다.";
      if(/성장.{0,20}의지|성장하고자|능동적|자기\s*주도/i.test(text))
        return "본인이 주도적으로 배우거나 개선한 실제 사례를 찾아 정리하세요. 성향을 경력 기간이나 자격증으로 환산하지 않습니다.";
      if(/IT\s*정보\s*관련\s*분야.*자격증|관련\s*분야\s*전문\s*지식.*자격증/i.test(text))
        return "보유한 IT 관련 자격증과 전문 지식을 먼저 정리하세요. 해당 우대조건의 인정 범위는 회사에 따라 다를 수 있습니다.";
      if(/정보통신공학과|컴퓨터공학과|IT\s*관련\s*학과/i.test(text))
        return "공고에 나열된 전공과 본인의 전공을 별도로 비교하세요. 공학사라는 이유로 IT 관련 학과로 자동 인정하지 않습니다.";
    }
    if(item.status==="확인 필요")
      return "공고 원문과 본인의 실제 이력·증빙을 대조하고, 내 역량 화면에서 상태를 직접 확정하세요.";
    if(item.status==="부분 충족")
      return "이미 갖춘 부분과 부족한 조건을 구분하세요. 부족한 부분에 대한 학습·경험 또는 추가 확인 계획을 정리하세요.";
    if(noExperienceThreshold(text))return "공고에 경력 기간 제한이 없다는 뜻입니다. 경력을 새로 채워야 하는 필수요건으로 해석하지 말고 신입 지원 가능 여부와 별도 조건을 확인하세요.";
    if(noDegreeThreshold(text))return "공고에 학력 제한이 없다고 명시되어 있습니다. 다른 필수·우대조건은 별도로 확인하세요.";
    if(/경력|실무\s*경험|\d+\s*년\s*이상/.test(text))
      return "요구 경력의 종류·기간을 확인하세요. 부족한 실무 경력을 자격증이나 프로젝트로 대체할 수 있다고 단정하지 말고 채용 기준을 확인하세요.";
    if(/학력|전공|졸업|학사|석사/.test(text))
      return "공고의 학력·전공 기준과 실제 학력을 대조하고, 지원 가능한 조건인지 채용 담당자 또는 공식 안내에서 확인하세요.";
    if(/자격증|자격|기사|기능사|관리사|정비사|마스터|certified|certification|SQLD|ADsP|CPPG|CISSP|CCNA/i.test(text))
      return "공고에 명시된 자격증명을 확인하세요. 필요하면 공식 시행기관에서 취득 요건·일정을 확인해 준비 계획을 세우세요.";
    return "공고에서 요구한 역량의 구체적인 범위를 확인하고, 학습·실습·실무 경험 중 무엇을 보완해야 하는지 정리하세요.";
  }
  // Rule-based, evidence-first examples. Never infer skills, dates or job eligibility.
  function preparationSteps(item){
    if(!item||item.status==="충족")return [];
    const text=String(item.text||"").normalize("NFKC");
    let guide;
    // Explicitly open-to-beginners/any-degree listings are not missing experience or degrees.
    if(noExperienceThreshold(text)){
      guide={
        scope:"이 공고는 해당 항목에 경력 기간 제한을 두지 않았습니다. 신입 지원 가능 여부와 다른 직무별·기술별 조건을 분리해 확인하세요.",
        evidence:"경력증명서나 연차를 새로 만들어야 하는 조건이 아닙니다. 실제 지원 유형과 별도로 요구하는 자격증·기술 조건만 확인하세요.",
        prepare:"해당 조건만을 이유로 경력 연수를 채우라는 준비 과제를 만들지 마세요. 지원서의 실제 경력과 실습 이력을 구분해 기재하고 다른 조건을 점검하세요."
      };
    }else if(noDegreeThreshold(text)){
      guide={
        scope:"공고에 학력 제한이 없다고 명시되어 있습니다. 특정 학위를 별도로 취득해야 한다는 요건이 아닙니다.",
        evidence:"본인의 실제 학력을 그대로 기재하고 학력과 무관한 자격증·기술·경력 조건은 별도로 확인하세요.",
        prepare:"이 조건 때문에 학위를 취득하라고 권하지 말고, 공고의 다른 지원 자격과 필요 증빙을 확인하세요."
      };
    }else if(/시큐아이|지니언스|소만사|\bSECUI\b|\bGENIANS\b|\bSOMANSA\b/i.test(text)){
      guide={
        scope:"공고가 우대하는 시큐아이·지니언스·소만사 제품 중 본인이 직접 구축·운영·유지보수한 제품이 있는지 확인하세요.",
        evidence:"제조사·제품명·실제 수행 업무·기간을 확인하세요. 망 혼용 방지 교육, 일반 보안점검 및 다른 제조사 제품은 이 경력의 증빙이 아닙니다.",
        prepare:"해당 제품 경력이 없다면 미확인 상태로 두고 공식 제품 자료로 기능을 학습할 수 있습니다. 학습 내용은 교육·실습으로 별도 기록하고 실무경력으로 기재하지 마세요."
      };
    }else if(/\bNAC\b|네트워크\s*접근\s*제어/i.test(text)){
      guide={
        scope:"NAC(네트워크 접근제어) 솔루션의 장비·사용자 식별, 네트워크 접근정책 설정, 운영 경험 중 공고가 요구하는 범위를 확인하세요.",
        evidence:"본인이 실제 다룬 NAC 제품명과 설정·운영·장애 대응 업무를 확인하세요. 일반 보안점검이나 보안교육을 NAC 구축 경력으로 쓰지 마세요.",
        prepare:"허가된 실습에서 NAC 정책 적용 흐름이나 접근 허용·차단 시나리오를 학습하고 결과를 정리하세요. 실습은 실무경력으로 대체할 수 없습니다."
      };
    }else if(/웹\s*방화벽|\bWAF\b/i.test(text)){
      guide={
        scope:"웹방화벽(WAF)의 구축, 트래픽 정책 설계, 유지보수 중 공고에서 요구한 실제 업무를 구분하세요.",
        evidence:"실제로 다룬 WAF 제품명과 정책·구축·장애 대응 기록을 확인하세요. XDR 프로젝트, 일반 네트워크 방화벽, 보안교육을 WAF 경력으로 주장하지 마세요.",
        prepare:"허가된 실습 환경에서 WAF 탐지·차단 규칙과 정상·차단 요청 결과를 기록하세요. 실습 기록은 별도로 표시하고 실무경력 인정 여부를 임의 추정하지 마세요."
      };
    }else if(/성장.{0,20}의지|성장하고자|능동적|자기\s*주도/i.test(text)){
      guide={
        scope:"공고의 성장 의지와 능동성이 어떤 업무 태도를 뜻하는지 확인하고, 자신의 실제 주도적 행동 사례를 선정하세요.",
        evidence:"새 기술을 학습하거나 문제를 발견해 해결한 경험에서 본인 주도 행동과 그 결과를 구분해 정리하세요. 근거가 없으면 내용을 만들어내지 마세요.",
        prepare:"지원서나 면접을 위해 상황→스스로 판단한 행동→실제 결과를 짧게 정리하세요. 이 성향 조건에 경력 연수·제품 자격증·가상 실습을 필수 과제로 만들지 마세요."
      };
    }else if(/IT\s*정보\s*관련\s*분야.*자격증|관련\s*분야\s*전문\s*지식.*자격증/i.test(text)){
      guide={
        scope:"이 우대사항은 특정 자격증명을 지정하지 않습니다. 내 역량에 실제로 입력한 보유 자격증명과 전문 지식을 참고로 정리하세요.",
        evidence:"보유 자격증의 정확한 명칭과 취득 사실을 확인하고, 관련 지식은 실제 학습·업무와 구분해 설명하세요. 채용사 우대 인정은 미확정입니다.",
        prepare:"기존 자격증과 공고의 IT 관련성부터 대조하세요. 특정 추가 자격증 취득을 임의로 권하지 말고, 우대 범위가 중요하다면 채용 담당자에게 확인하세요."
      };
    }else if(/정보통신공학과|컴퓨터공학과|IT\s*관련\s*학과/i.test(text)){
      guide={
        scope:"공고에 적힌 정보통신공학·컴퓨터공학·IT 관련 학과와 본인의 실제 전공을 구분해 대조하세요.",
        evidence:"졸업증명서의 학교·학부·전공명을 그대로 확인하세요. 공학사 취득이나 보안 경력을 이유로 전공 일치를 자동 인정하지 않습니다.",
        prepare:"전공의 IT 관련성 인정 범위가 불확실하면 채용 담당자에게 확인하세요. 관련 교과목이나 프로젝트는 보충 설명으로만 제시하세요."
      };
    }else if(/L7|제로데이|제로\s*데이|\bIR\b/i.test(text)&&/분석|위협|사고|대응/.test(text)){
      guide={
        scope:"L7 위협 분석, 제로데이 취약점 정보 분석, 침해사고 대응(IR)을 별개의 수행 업무로 구분해 확인하세요.",
        evidence:"직접 분석한 위협 자료와 실제 사고 조사·대응에 참여한 기록을 구분하고 본인의 역할을 확인하세요.",
        prepare:"공개 보안 권고문과 비식별 예제 로그로 분석 요약 및 가상 사고 대응 절차를 기록하세요. 모의 활동을 IR 실무로 표시하지 마세요."
      };
    }else if(/ISMS-P|보안\s*컴플라이언스/i.test(text)&&/심사|체계|인증|대응/.test(text)){
      guide={
        scope:"ISMS-P 관리체계 구축, 인증심사 대응, 통제 항목 검토에서 공고가 요구하는 역할을 구분하세요.",
        evidence:"기관평가에서 적용한 기준·증빙과 본인 역할을 정리하되 ISMS-P 심사 참여 경력과 구분하세요.",
        prepare:"공개 관리체계 통제 항목으로 가상 조직의 정책·증빙·미흡사항·개선 계획을 대응표로 작성하세요."
      };
    }else if(/보안\s*정책\s*변경|운영\s*절차\s*(?:수립|개선)/.test(text)){
      guide={
        scope:"보안 정책 변경, 장애 원인 분석·복구, 운영 절차 수립·개선을 각각 구분해 확인하세요.",
        evidence:"실제로 변경한 정책과 승인·검증 자료, 대응한 장애, 작성한 운영 절차를 정리하세요. 정책 점검만으로 정책 변경을 주장하지 마세요.",
        prepare:"승인된 실습 환경에서 정책 변경 전후 테스트, 장애 원인·조치, 운영 절차 개선안을 기록하세요."
      };
    }else if(/유관\s*부서/.test(text)&&/협업|협의|협력/.test(text)&&/문서화|문서\s*작성/.test(text)){
      guide={
        scope:"유관 부서와 보안 이슈를 해결한 경험과 운영 내용을 문서화한 경험을 각각 확인하세요.",
        evidence:"협업 대상·이슈·본인 역할과 직접 작성한 보고·운영 문서를 구분하세요. 서로 다른 경험을 한 사건으로 합치지 마세요.",
        prepare:"가상 보안 이슈의 협업 요청→공동 확인→조치 결과 공유→운영 기록 예시를 작성하고 실제 실무와 구분하세요."
      };
    }else if(/망\s*분리/.test(text)&&/AI|인공지능/i.test(text)&&/보안|리스크/.test(text)){
      guide={
        scope:"망분리 환경에서 AI 입력·출력, 데이터 반출 위험, 안전한 업무 적용과 보안 프로세스 개선을 구분하세요.",
        evidence:"실제로 검토한 AI 활용 사례, 망 경계, 접근권한과 승인 절차를 교육·실습·실무로 나누어 확인하세요.",
        prepare:"실제 내부 자료 대신 가상 망분리 시나리오를 바탕으로 위험과 승인·차단 통제 방안을 점검표로 작성하세요."
      };
    }else if(/보안\s*이벤트|이상\s*징후|로그를\s*분석/.test(text)&&/로그|이벤트|침해사고/.test(text)){
      guide={
        scope:"보안 이벤트·로그 분석, 이상 징후 탐지, 원인 분석과 침해사고 대응의 범위를 각각 확인하세요.",
        evidence:"Wazuh 등에서 분석한 로그, 탐지 근거, 원인 판단과 실제 조치 기록을 실습·업무별로 구분해 정리하세요.",
        prepare:"비식별 예제 이벤트의 시간순 기록→이상 징후→원인 가설→대응 의견을 분석표로 남기고 모의 분석을 실무와 구분하세요."
      };
    }else if(/보안\s*솔루션/.test(text)&&/구축|장애|트러블슈팅|트러블\s*슈팅/.test(text)&&/인프라|솔루션/.test(text)){
      guide={
        scope:"보안 솔루션 구축, 운영 환경별 설정, 장애 분석·트러블슈팅을 각각 나누어 확인하세요.",
        evidence:"직접 구축한 제품명과 환경, 설정 및 장애 증상·원인·조치·검증 결과를 정리하세요. XDR 프로젝트를 다른 제품의 운영 경력으로 간주하지 마세요.",
        prepare:"승인된 실습에서 제품 설정·로그를 점검하고 모의 장애의 증상→원인→복구 확인을 문서화하세요. 실습을 실무와 구분하세요."
      };
    }else if(/(?:영어|영문|English)/i.test(text)&&/(?:이메일|e-?mail)/i.test(text)){
      guide={
        scope:"해외 본사와 주고받는 영문 이메일의 비즈니스 수준(요청·조치 현황·기한·회신)을 확인하세요. 일반적인 국내 협업이나 한국어 보고와 구분하세요.",
        evidence:"실제로 작성·회신한 영문 업무 이메일 또는 관련 능력을 확인할 수 있는 자료가 있는지 점검하세요. 민감정보를 제거하고 한국어 보고자료만으로 영어 이메일 역량을 단정하지 마세요.",
        prepare:"가상의 취약점 조치 현황을 해외 본사에 보고하는 영문 이메일을 작성하세요. 조치 상태·담당자·기한·추가 요청사항을 포함하고 표현을 교정한 내역을 남기세요. 모의 메일을 실제 업무 경력으로 기재하지 마세요."
      };
    }else if(/(?:MS[\s-]*Office|Microsoft\s*Office|Excel|엑셀|PowerPoint|파워포인트|PPT)/i.test(text)){
      guide={
        scope:"공고에 명시된 Excel·PowerPoint 등 사무 도구의 활용 범위를 확인하세요. 특정 고급 함수나 자격증을 명시하지 않았다면 필수로 가정하지 마세요.",
        evidence:"실제 Excel 표·함수·차트 및 PowerPoint 보고 슬라이드를 직접 만든 경험과 예시 자료를 구분해 확인하세요. 민감정보는 제거하세요.",
        prepare:"비식별 샘플 데이터로 Excel 표의 정렬·필터·간단한 수식·차트를 만들고, 결과를 PowerPoint 3장으로 요약해 보세요. 파일과 사용 기능을 함께 기록하세요."
      };
    }else if(/(?:CISSP\s*[,，]\s*CISA|CISA\s*[,，]\s*CISSP)\s*등\s*(?:IT\s*)?보안\s*관련\s*자격증/i.test(text)){
      guide={
        scope:"공고에 직접 예시된 CISSP·CISA와 '등 IT 보안관련 자격증'의 적용 범위를 구분하세요.",
        evidence:"보유 자격증명과 실제 취득 증빙을 확인하세요. 정보보안기사 등 다른 보안 자격증의 관련성은 안내할 수 있지만 채용사 인정 여부는 확인이 필요합니다.",
        prepare:"직접 예시되지 않은 보안 자격증도 우대하는지 채용 담당자에게 확인하세요. 인정 여부가 불명확하다는 이유만으로 CISSP·CISA를 새로 취득하라고 권하지 마세요."
      };
    }else if(/경력|실무\s*(?:경험|경력)|\d+\s*년\s*이상/.test(text)){
      guide={
        scope:"공고가 요구하는 실무 분야·담당업무와 경력 기간(명시된 경우)을 구분해 확인하세요. 기간이 적히지 않았다면 임의로 연수를 만들지 마세요.",
        evidence:"실제 업무별 수행 기간과 본인 역할을 정리하고 경력증명·업무 기록처럼 확인 가능한 근거가 있는지 점검하세요.",
        prepare:"관련 실습이나 프로젝트는 별도로 정리하되, 실습·자격증이 실무 경력을 대체한다고 가정하지 마세요. 인정 기준은 채용 담당자에게 확인하세요."
      };
    }else if(/학력|전공|졸업|학사|석사/.test(text)){
      guide={
        scope:"공고의 학위·전공·졸업 조건이 필수인지 우대인지 정확히 확인하세요.",
        evidence:"졸업 상태·학위·전공과 제출 가능한 증빙을 실제 이력과 대조하세요.",
        prepare:"해석이 애매하거나 기준에 차이가 있으면 채용 공고의 공식 안내나 담당자에게 인정 범위를 확인하세요."
      };
    }else if(/포트폴리오|GitHub|깃허브|작업물\s*제출|프로젝트\s*결과물\s*제출/i.test(text)){
      guide={
        scope:"포트폴리오에서 요구하는 형식·프로젝트 수·제출 링크 및 기한을 확인하세요.",
        evidence:"본인이 직접 맡은 역할, 사용 기술, 문제 해결 과정과 결과물을 구분해 정리하세요.",
        prepare:"공개 가능한 프로젝트 설명·실행 화면·README·검증 결과를 정리하고 링크 접근 여부와 개인정보·비밀키 노출을 확인하세요."
      };
    }else if(/교육\s*(?:이수|수료)|훈련\s*(?:이수|수료)|과정\s*수료/i.test(text)){
      guide={
        scope:"공고가 요구하는 교육 과정명·이수 시간·수료 기준을 확인하세요.",
        evidence:"실제 이수한 교육명, 기간과 수료증 등 증빙 가능 여부를 대조하세요.",
        prepare:"미이수라면 공식 교육 안내에서 과정·이수 조건을 확인하고, 이미 수료했다면 증빙 자료와 제출 방법을 정리하세요."
      };
    }else if(/자격증|자격\s*(?:보유|취득)|기사|기능사|관리사|정비사|마스터|certified|certification|SQLD|ADsP|CPPG|CISSP|CCNA/i.test(text)){
      guide={
        scope:"공고에 적힌 자격증의 정확한 명칭과 필수·우대 여부를 먼저 확인하세요.",
        evidence:"이미 취득했다면 증명서의 종목·취득일을 대조하고, 미보유라면 현재 상태를 구분하세요.",
        prepare:"미보유 자격은 공식 시행기관에서 시험과 응시 요건을 확인하고 준비 항목을 정리하세요. 앱의 자격증 DB는 공식 검증 전입니다."
      };
    }else if(/(?:\bAWS\b|아마존\s*웹\s*서비스)/i.test(text)&&/\bAzure\b|애저/i.test(text)){
      guide={
        scope:"공고에서 AWS와 Azure 중 각각 요구하는 IAM/RBAC 권한·감사 로그·네트워크 접근 정책의 범위를 확인하세요.",
        evidence:"두 클라우드의 실습·업무 경험과 정책·로그 점검 결과를 플랫폼별로 구분해 정리하세요.",
        prepare:"공개 예제 IAM/RBAC 정책을 비교해 과도한 권한과 외부 공개 위험을 점검하고 체크리스트를 작성하세요. 비용이 드는 리소스는 생성하지 마세요."
      };
    }else if(/\bAWS\b|아마존\s*웹\s*서비스/i.test(text)){
      guide={
        scope:"AWS 보안 운영 중 IAM 권한·CloudTrail 기록·보안 그룹 설정 등 공고가 요구한 범위를 확인하세요.",
        evidence:"본인이 직접 다룬 IAM 정책, 감사 로그, 네트워크 접근 설정과 점검 결과를 실습/실무로 구분해 정리하세요.",
        prepare:"공개 예제 정책·샘플 로그 또는 승인된 실습 환경에서 과도한 IAM 권한과 보안 그룹 노출 여부를 점검하고 점검표를 작성하세요. 비용 및 권한 변경에 주의하세요."
      };
    }else if(/Wazuh/i.test(text)){
      guide={
        scope:"Wazuh 에이전트 연결·로그 수집·경보 분석 중 공고가 요구하는 범위를 확인하세요.",
        evidence:"직접 수집한 로그와 분석·조치 사례를 실습·실무로 나눠 정리하세요.",
        prepare:"승인된 실습 환경에서 로그인 실패 로그 수집→경보 확인→원인 기록을 연습하세요. 실습을 실무 경력과 구분하세요."
      };
    }else if(/\bPython\b|파이썬/i.test(text)){
      guide={
        scope:"공고에 명시된 Python 활용 목적과 개발·분석·자동화 업무의 범위를 확인하세요.",
        evidence:"직접 작성한 Python 코드, 입출력 예시, 테스트 결과와 본인 역할을 정리하세요.",
        prepare:/(?:보안\s*로그|로그\s*(?:분석|수집|처리)|이벤트|데이터\s*분석|자동화)/i.test(text)
          ?"비식별 샘플 로그를 읽고 이벤트를 분류하는 Python 스크립트를 작성한 뒤 정상·오류 사례를 테스트하세요."
          :"공고에서 명시한 Python 활용 업무와 관련된 작은 예제 코드를 작성하고 정상·오류 사례를 테스트하세요."
      };
    }else if(/\bn8n\b|\bAI\b/i.test(text)&&/자동화/.test(text)&&/보안|분석|운영|보고/.test(text)){
      guide={
        scope:"n8n 또는 AI 기반 보안 운영·분석·보고 자동화에서 입력, 처리, 출력, 사람 검토 단계를 구분하세요.",
        evidence:"직접 구현한 흐름, 도구, 결과와 오류 처리 기록을 확인하세요. 교육 수강만으로 구현 경험을 단정하지 마세요.",
        prepare:"비식별 샘플 데이터를 이용해 수집→분류→보고 초안→사람 확인의 작업 흐름을 구성하고 테스트 결과를 기록하세요."
      };
    }else if(/스크립트|자동화|프로그래밍|코딩/i.test(text)){
      guide={
        scope:"공고에서 요구하는 프로그래밍 언어·도구와 작업 범위를 확인하세요. 명시되지 않은 언어를 필수라고 가정하지 마세요.",
        evidence:"직접 작성·수정한 코드, 사용 언어와 도구, 구현 기능 및 테스트 결과를 정리하세요.",
        prepare:"실제 사용해 본 언어로 작은 기능을 구현하거나 기존 프로젝트의 코드·테스트·본인 기여를 정리하세요."
      };
    }else if(/\bSIEM\b|보안\s*관제|로그\s*(?:분석|모니터링)/i.test(text)){
      guide={
        scope:"공고가 요구하는 로그 수집·탐지 규칙·경보 분석·사고 보고의 업무 범위를 확인하세요.",
        evidence:"사용한 로그 소스, 직접 분석한 이벤트, 작성한 탐지/분석 기록을 실습과 업무별로 구분하세요.",
        prepare:"예제 인증 로그에서 이상 징후를 찾아 탐지 조건과 오탐 가능성, 대응 의견을 한 장의 분석 기록으로 작성하세요."
      };
    }else if((text.match(/WAF|IPS|방화벽|EDR|EPP|서버\s*접근제어/gi)||[]).length>=2&&/솔루션|보안\s*장비|운영/.test(text)){
      guide={
        scope:"WAF·IPS·방화벽·EDR/EPP·서버 접근제어 가운데 공고가 요구한 장비별 정책·운영 범위를 구분하세요.",
        evidence:"직접 다뤄본 제품과 경보·차단 정책·장애 대응 기록을 유형별로 정리하세요. XDR 프로젝트를 다른 제품 운영 경력으로 간주하지 마세요.",
        prepare:"승인된 환경이나 공개 예제로 웹 차단 룰, 네트워크 접근 정책, 엔드포인트 경보의 차이와 조치·검증 절차를 정리하세요."
      };
    }else if(/\bEDR\b|엔드포인트\s*(?:탐지|보안|보호)/i.test(text)){
      guide={
        scope:"EDR 경보 모니터링·원인 분석·정책 운영 중 요구하는 업무를 구분하세요.",
        evidence:"다뤄본 솔루션의 알림 분석, 정책 변경, 사용자 지원 경험의 범위와 증빙을 정리하세요.",
        prepare:"공개된 예제 경보 또는 승인된 테스트 환경에서 프로세스·파일·시간 정보를 검토하고 경보 분류와 조치 의견을 기록하세요."
      };
    }else if(/취약점|보안\s*(?:점검|진단|감사)|정보보호\s*컨설팅|ISMS|ISO\s*27001|보안\s*정책/i.test(text)){
      guide={
        scope:"공고가 요구하는 보안 점검 대상, 평가 기준 및 산출물 범위를 확인하세요.",
        evidence:"직접 수행한 자산·설정·취약점 점검과 개선 조치 기록을 실습/실무로 구분해 정리하세요.",
        prepare:"허가된 실습 자산을 대상으로 점검 항목→발견 사항→원인→개선안→재확인 결과를 표로 만들어 보세요."
      };
    }else if(/개인정보|개인\s*정보|PIPA|PIA|프라이버시/i.test(text)){
      guide={
        scope:"개인정보 수집·이용·보관·파기, 접근권한 관리 중 공고가 요구하는 범위를 확인하세요.",
        evidence:"관련 교육·업무·프로젝트에서 본인이 실제 작성하거나 검토한 절차·문서를 구분하세요.",
        prepare:"가상 서비스의 개인정보 처리 흐름을 그리고 수집 항목·보관 기간·접근권한·파기 기준을 점검표로 작성하세요. 실제 개인정보는 사용하지 마세요."
      };
    }else if(/클라우드|Azure|GCP|IAM|Kubernetes|쿠버네티스/i.test(text)){
      guide={
        scope:"클라우드 계정 권한·네트워크 설정·감사 로그 중 요구하는 운영 범위를 확인하세요.",
        evidence:"실제로 설정한 계정·접근 정책·로그 검토 경험을 실습과 실무로 구분해 정리하세요.",
        prepare:"공개 예제 설정에서 과도한 권한과 외부 공개 여부를 점검하고, 근거 화면과 개선안을 정리하세요. 유료 리소스는 생성하지 마세요."
      };
    }else if(/Windows|윈도우/i.test(text)&&/서버|보안|운영|계정|로그/i.test(text)){
      guide={
        scope:"Windows 서버 계정·로그온 감사·서비스 상태·방화벽 정책 중 필요한 운영 범위를 확인하세요.",
        evidence:"직접 수행한 이벤트 뷰어 로그 확인, 로컬 정책 점검 또는 운영 이력을 실습·실무로 구분해 정리하세요.",
        prepare:"승인된 Windows 실습 환경에서 이벤트 뷰어의 로그온 성공·실패 기록을 확인하고 계정 및 방화벽 정책 점검표를 작성하세요."
      };
    }else if(/TCP\s*\/\s*IP|HTTP\s*\/\s*HTTPS|SSL\s*\/\s*TLS/i.test(text)&&/네트워크|서버|웹|프로토콜/.test(text)){
      guide={
        scope:"네트워크·서버·웹 서비스와 TCP/IP·HTTP/HTTPS·SSL/TLS 프로토콜의 역할과 연결 흐름을 구분해 확인하세요.",
        evidence:"GNS3·Linux 구성 경험과 실제 패킷·HTTP 요청·TLS 연결을 살펴본 기록을 구분하세요. 구축만으로 모든 프로토콜의 이해를 확정하지 마세요.",
        prepare:"허가된 테스트 웹 서버의 HTTP 상태 코드, HTTPS 인증서·TLS 협상과 연결 경로를 확인하고 요청·응답 흐름을 기록하세요."
      };
    }else if(/네트워크|방화벽|VLAN|\bACL\b|\bVPN\b|라우팅/i.test(text)){
      guide={
        scope:"공고의 네트워크 구성·장애 대응·접근통제 중 필요한 기술을 구분하세요.",
        evidence:"본인이 구성한 네트워크 토폴로지, 라우팅·ACL 설정 또는 장애 대응 기록을 정리하세요.",
        prepare:"격리된 가상망에서 VLAN/ACL 등 접근 정책을 구성하고 허용·차단 통신 결과를 표로 기록하세요."
      };
    }else if(/Linux|리눅스|Ubuntu|우분투|Rocky|서버\s*운영/i.test(text)){
      guide={
        scope:"서버 계정·권한·서비스·로그 관리 중 공고가 요구하는 항목을 확인하세요.",
        evidence:"직접 관리한 시스템과 설정·문제 해결 기록을 학습/실무로 구분해 정리하세요.",
        prepare:"로컬 가상머신에서 사용자 권한·서비스 상태·인증 로그를 점검하고 설정 전후 차이를 기록하세요."
      };
    }else if(/\bSQL\b|데이터\s*(?:분석|베이스)|DBMS/i.test(text)){
      guide={
        scope:"SQL 조회·데이터 가공·DB 권한 관리 중 요구하는 범위를 확인하세요.",
        evidence:"작성한 쿼리·분석 결과·프로젝트 역할을 실제 수행 내용 위주로 정리하세요.",
        prepare:"예제 데이터베이스에서 SELECT/JOIN 쿼리를 작성하고 결과 검증 과정과 접근권한 제한 사항을 기록하세요."
      };
    }else if(/Python|파이썬|스크립트|자동화|프로그래밍|개발/i.test(text)){
      guide={
        scope:"공고에 필요한 언어·자동화 범위·산출물 기준을 확인하세요.",
        evidence:"직접 작성한 스크립트, 입력·출력 예시, 오류 처리 방법을 정리하세요.",
        prepare:"샘플 로그 또는 비식별 테스트 데이터로 작은 자동화 스크립트를 만들고 정상·오류 사례를 테스트하세요."
      };
    }else if(/(?:해외여행|해외\s*출장|지방\s*출장|출장\s*업무|병역\s*필|병역필|면제자|신원\s*조회|결격\s*사유|운전\s*가능|운전\s*면허|인근\s*거주|입사\s*가능|근무\s*가능)/i.test(text)){
      guide={
        scope:"해당 조건이 요구하는 지원 자격·행정 사항의 정확한 범위와 대상자를 확인하세요. 업무 능력과 법적·행정적 요건은 구별해야 합니다.",
        evidence:"운전면허·졸업·병역·근무 가능 여부 등 공고와 관련 있는 사항만 본인이 보유한 증명 또는 사실로 확인하세요. 해당하지 않는 서류는 요구하지 마세요.",
        prepare:"공고에 명시된 증빙 종류와 제출 시점을 확인하고 본인 상황에 해당하는 사실을 점검하세요. 요건 해석이 애매하면 채용 담당자에게 인정 범위를 확인하세요."
      };
    }else if(/Zabbix|Prometheus|Grafana|관측성|모니터링\s*도구/i.test(text)){
      guide={
        scope:"모니터링에서 요구하는 지표 수집·시각화·경보·장애 대응 범위를 도구별로 나누어 확인하세요.",
        evidence:"실제로 사용한 모니터링 제품·메트릭·알림 설정과 분석 화면을 실습 및 실무로 구분하세요.",
        prepare:"허가된 실습 환경이나 공개 샘플 메트릭으로 CPU·메모리·서비스 상태 대시보드와 임계치 경보를 설계하고, 장애 원인 분석 과정을 기록하세요."
      };
    }else if(/Docker|컨테이너|K8s|Kubernetes|쿠버네티스|이미지\s*빌드/i.test(text)){
      guide={
        scope:"공고에서 요구하는 컨테이너 이미지 빌드, 배포, 서비스 운영 또는 오케스트레이션 경험의 범위를 확인하세요.",
        evidence:"직접 작성한 Dockerfile·배포 설정, 실행 로그와 장애 조치 여부를 구분하고 운영 경력을 실습으로 과장하지 마세요.",
        prepare:"격리된 실습 환경에서 작은 앱을 컨테이너로 실행하고 포트·볼륨·환경변수·로그를 검증하세요. K8s를 요구한다면 매니페스트 설정과 상태 확인을 추가하세요."
      };
    }else if(/MySQL|MariaDB|PostgreSQL|PostGIS|DB\s*설계|DB\s*구축|DB\s*운영|데이터\s*모델링/i.test(text)){
      guide={
        scope:"공고의 데이터베이스 모델링·쿼리·권한·백업·장애 대응 중 실제 요구하는 역할을 구별하세요.",
        evidence:"본인이 작성한 스키마·SQL·권한 설정·문제 해결 내용을 실습과 실무로 분리하고 실행 결과를 확인하세요.",
        prepare:"비식별 테스트 DB에 테이블과 제약조건을 설계하고 JOIN 쿼리·계정 권한·백업 복원 중 필요한 항목을 실행해 검증 결과를 기록하세요."
      };
    }else if(/React|Vue|TypeScript|JavaScript|NestJS|Express|Spring|Java\b|C\+\+|C#|WPF|MFC|Git\s*버전관리|Git\b|Tomcat|Nginx|Apache|WEB\/WAS/i.test(text)){
      guide={
        scope:"공고에 명시된 개발 언어·프레임워크·서버 구성 요소의 구현 수준과 요구 산출물을 먼저 구분하세요.",
        evidence:"실제로 직접 구현한 기능·코드·배포·테스트 내역을 기술별로 정리하세요. 단순 도구 사용을 운영 경험으로 과장하지 마세요.",
        prepare:"요구 기술과 가장 가까운 최소 기능을 구현하고 버전관리 기록, 실행 화면 또는 API 응답, 정상·오류 테스트 결과를 함께 남기세요."
      };
    }else if(/문서\s*작성|기술\s*문서|보고서|리포트|제안서|협업|커뮤니케이션|의사소통|MS[\s-]*Office|발표\s*역량|유관\s*부서/i.test(text)){
      guide={
        scope:"공고가 요구하는 문서·협업 능력이 어떤 업무 상황, 이해관계자와 결과물을 의미하는지 구체화하세요.",
        evidence:"본인이 작성한 보고자료나 협의·점검 이력을 익명화하여 본인 역할과 실제 전달·개선 결과를 분리해 정리하세요.",
        prepare:"가상의 기술 이슈를 선정해 상황·원인·대안·협의 결과를 1쪽으로 정리하고 검토 의견을 반영한 수정 내역을 남기세요."
      };
    }else if(/ETL|ELT|DW\b|OLAP|BI\b|Tableau|Power\s*BI|Databricks|Snowflake|Airflow|dbt\b|Kafka|지표\s*정의|통계\s*모델|시계열|데이터\s*파이프라인/i.test(text)){
      guide={
        scope:"데이터 수집·가공·적재·분석·시각화 중 공고가 요구한 단계와 도구를 명확히 구분하세요.",
        evidence:"직접 수행한 데이터 처리 과정, 품질 검증, 분석 쿼리와 시각화·보고 자료를 실제 결과로 확인하세요.",
        prepare:"공개 예제 데이터를 수집·정제하고 누락값·중복을 점검한 뒤 핵심 지표 하나를 계산해 시각화하거나 파이프라인 실행 로그를 남기세요."
      };
    }else if(/(?:영어|외국어|TOEIC|TOEFL|OPIc|토익|스피킹|외국어\s*능력)/i.test(text)){
      guide={
        scope:"공고에서 요구하는 언어 능력의 사용 상황과 공식 점수·회화·문서작성 기준을 구분하세요.",
        evidence:"실제 유효한 시험 성적과 직접 수행한 영어 문서 작성·업무 소통 경험을 구분해 확인하세요. 없는 점수나 업무 경험을 만들어내지 마세요.",
        prepare:"요구 업무에 가까운 1쪽 분량의 영문 업무 요약이나 모의 회화 질의응답을 준비하고, 공식 성적이 필요하다면 인정 시험·유효기간을 확인하세요."
      };
    }else if(/(?:학점|평점|GPA|컴퓨터\s*활용\s*능력|Excel|엑셀|OA\s*활용|파워포인트|PPT)/i.test(text)){
      guide={
        scope:"공고에서 요구하는 학점 또는 사무 도구 활용 기준이 객관적인 수치·기능인지 확인하세요.",
        evidence:"학점은 성적증명서와 정확히 대조하고, 도구 활용 능력은 실제 작성한 표·함수·발표 자료로 입증 가능 여부를 구분하세요.",
        prepare:"학점 요건을 실습으로 대체하지 말고 공식 기준을 확인하세요. 사무 도구 조건이라면 표·수식·차트 또는 발표 자료의 샘플과 오류 점검 결과를 준비하세요."
      };
    }else{
      guide={
        scope:"공고의 ‘"+text.slice(0,100)+(text.length>100?"…":"")+"’ 조건에 대해 채용사가 요구하는 업무 범위와 검증 가능한 결과물을 확인하세요.",
        evidence:"이 조건과 직접 관련된 본인의 경험·역할·기간·산출물을 실무·프로젝트·학습으로 구분해 정리하세요. 관련성이 없으면 미보유 또는 확인 필요로 유지하세요.",
        prepare:"공고에 명시된 요건에서 필요한 역량 하나를 선정하여 관련 실습이나 문서화된 기존 성과를 증빙하세요. 요건이 객관적 자격·기간을 뜻한다면 실습으로 대체하지 말고 인정 기준을 확인하세요."
      };
    }
    if(item.status==="확인 필요")return [
      guide.scope,guide.evidence,
      guide.prepare+" 확인 결과에 따라 '내 역량' 상태를 수정하세요."
    ];
    if(item.status==="부분 충족")return [
      "이미 갖춘 부분과 부족한 부분을 먼저 구분하세요. "+guide.scope,
      guide.evidence,guide.prepare
    ];
    return [guide.scope,guide.prepare,
      "완료한 결과와 증빙을 정리하고 공고 요건 충족 여부를 다시 확인하세요. "+guide.evidence];
  }
  function buildRoadmap(items){
    if(!Array.isArray(items))throw new TypeError("비교 결과 배열이 필요합니다.");
    const totals={"충족":0,"부분 충족":0,"미충족":0,"확인 필요":0};
    const normalized=items.filter(item=>item&&["required","preferred"].includes(item.kind)&&
      typeof item.text==="string"&&item.text.trim()).map((item,index)=>{
      const status=states.includes(item.status)?item.status:"확인 필요";
      totals[status]++;
      return {id:String(item.id||item.kind+"-"+index),kind:item.kind,text:item.text.trim(),
        status,reason:typeof item.explanation==="string"?item.explanation.trim():"",
        index,line:Number.isInteger(item.line)&&item.line>0?item.line:null,
        experienceExplanation:item.experienceExplanation?.mode==="local-rules"?item.experienceExplanation:null,postingSource:item.postingSource||null};
    });
    const sorted=normalized.sort((a,b)=>{
      const groupA=a.kind==="required"?0:1,groupB=b.kind==="required"?0:1;
      return order[a.status]-order[b.status]||groupA-groupB||a.index-b.index;
    }).map(item=>({...item,category:item.kind==="required"?"필수조건":"우대사항"}));
    // Distinguish actual work to do from conditions the user marked fulfilled.
    let priority=0;
    const tasks=sorted.filter(item=>item.status!=="충족")
      .map(item=>({...item,priority:++priority,action:nextAction(item),steps:preparationSteps(item)}));
    const completed=sorted.filter(item=>item.status==="충족");
    const groups=states.map(status=>({
      status,
      items:status==="충족"?completed:tasks.filter(item=>item.status===status)
    }));
    return {
      total:normalized.length,totals,tasks,completed,groups,
      requiredOpen:tasks.filter(item=>item.kind==="required").length,
      alreadyMarked:totals["충족"]
    };
  }
  function mount(){
    const empty=document.getElementById("roadmap-empty");
    const results=document.getElementById("roadmap-results");
    const summary=document.getElementById("roadmap-summary");
    const list=document.getElementById("roadmap-list");
    const notice=document.getElementById("roadmap-notice");
    if(!empty||!results||!summary||!list||!notice)return;
    const node=(tag,cls,text)=>{
      const n=document.createElement(tag);
      if(cls)n.className=cls;
      if(text!=null)n.textContent=String(text);
      return n;
    };
    // The same outlined status icons appear before all four status labels.
    // They are decorative; the full Korean status name remains readable text.
    const statusIcons={
      "확인 필요":{className:"pending",shapes:[
        ["circle",{cx:12,cy:12,r:10}],
        ["path",{d:"M9.2 9a3 3 0 0 1 5.6 1.4c0 1.8-2.8 2.2-2.8 3.8"}],
        ["path",{d:"M12 17h.01"}]
      ]},
      "미충족":{className:"missing",shapes:[
        ["circle",{cx:12,cy:12,r:10}],
        ["path",{d:"m9 9 6 6m0-6-6 6"}]
      ]},
      "부분 충족":{className:"partial",shapes:[
        ["circle",{cx:12,cy:12,r:10}],
        ["circle",{cx:12,cy:12,r:3,fill:"currentColor",stroke:"none"}]
      ]},
      "충족":{className:"fulfilled",shapes:[
        ["circle",{cx:12,cy:12,r:10}],
        ["path",{d:"m8 12 3 3 5-6"}]
      ]}
    };
    function statusIcon(status){
      const spec=statusIcons[status];
      const ns="http://www.w3.org/2000/svg";
      const svg=document.createElementNS(ns,"svg");
      svg.setAttribute("viewBox","0 0 24 24");
      svg.setAttribute("aria-hidden","true");
      svg.setAttribute("focusable","false");
      svg.setAttribute("class","roadmap-status-icon roadmap-status-icon--"+spec.className);
      spec.shapes.forEach(([tag,attrs])=>{
        const shape=document.createElementNS(ns,tag);
        Object.entries(attrs).forEach(([key,value])=>shape.setAttribute(key,String(value)));
        svg.appendChild(shape);
      });
      return svg;
    }
    function render(items){
      if(!Array.isArray(items)||!items.length){
        results.hidden=true;empty.hidden=false;list.replaceChildren();
        return;
      }
      const plan=buildRoadmap(items);
      if(!plan.total){results.hidden=true;empty.hidden=false;list.replaceChildren();return;}
      empty.hidden=true;results.hidden=false;list.replaceChildren();
      summary.textContent="비교한 조건 "+plan.total+"개 · 충족(본인 입력) "+plan.alreadyMarked+
        "개 · 확인 필요 "+plan.totals["확인 필요"]+"개 · 미충족 "+plan.totals["미충족"]+
        "개 · 부분 충족 "+plan.totals["부분 충족"]+"개. 이 순서는 필수조건을 먼저 살피기 위한 참고용입니다.";
      plan.groups.forEach(group=>{
        const section=node("section","roadmap-group");
        const groupTitle=node("h3","roadmap-group-title");
        groupTitle.appendChild(statusIcon(group.status));
        groupTitle.appendChild(node("span","",group.status+" · "+group.items.length+"개"));
        section.appendChild(groupTitle);
        const cards=node("div","roadmap-group-items");
        if(!group.items.length){
          cards.appendChild(node("p","roadmap-none","해당 조건 없음"));
        }else{
          group.items.forEach(item=>{
            const fulfilled=item.status==="충족";
            const card=node("article",fulfilled?"roadmap-task roadmap-task--fulfilled":"roadmap-task");
            const rank=node("p",fulfilled?"roadmap-rank roadmap-rank--fulfilled":"roadmap-rank");
            rank.appendChild(statusIcon(item.status));
            rank.appendChild(node("span","",fulfilled
              ?"충족 · "+item.category+" · 본인 입력 기준"
              :item.status+" · "+item.category+" · 우선 확인 "+item.priority));
            card.appendChild(rank);
            card.appendChild(node("h4","roadmap-item-title",item.text));
            if(item.line)card.appendChild(node("small","subtext","채용공고 원문 "+item.line+"행"));
            if(item.postingSource?.url){
              try{
                const source=new URL(item.postingSource.url);
                if(source.protocol==="https:"&&!source.username&&!source.password){
                  const link=node("a","subtext","가져온 공고 원문 열기 ↗");
                  link.href=source.href;link.target="_blank";link.rel="noopener noreferrer";card.appendChild(link);
                  if(item.postingSource.edited)card.appendChild(node("small","subtext","사용자가 수정해 적용한 본문 기준"));
                }
              }catch{}
            }
            card.appendChild(node("p","roadmap-action",fulfilled
              ?"본인 입력으로 충족 표시한 조건입니다. 실제 증빙과 기업의 자격 인정 여부는 별도로 확인해 주세요."
              :item.action));
            if(item.steps&&item.steps.length){
              const details=node("details","roadmap-steps");
              details.appendChild(node("summary","roadmap-steps-toggle","준비 단계 "+item.steps.length+"개 보기"));
              const steps=node("ol","roadmap-steps-list");
              item.steps.forEach(step=>steps.appendChild(node("li","",step)));
              details.appendChild(steps);
              card.appendChild(details);
            }
            if(item.experienceExplanation&&window.MuttajiExperience){
              const explanation=node("section","experience-explanation");
              window.MuttajiExperience.renderExplanation(document,explanation,item.experienceExplanation);
              card.appendChild(explanation);
            }else if(item.reason)card.appendChild(node("p","roadmap-evidence","내가 입력한 근거: "+item.reason));
            cards.appendChild(card);
          });
        }
        section.appendChild(cards);
        list.appendChild(section);
      });
      const requiredTotal=plan.tasks.filter(item=>item.kind==="required").length+
        plan.completed.filter(item=>item.kind==="required").length;
      notice.textContent=(requiredTotal===0
        ?"이번 공고에서 분류된 필수조건이 없습니다."
        :plan.requiredOpen
        ?"현재 아직 확인하거나 보완할 필수조건 "+plan.requiredOpen+"개가 있습니다."
        :"현재 필수조건은 모두 사용자가 충족으로 표시했습니다.")+
        " 확인 필요 → 미충족 → 부분 충족 → 충족 순서로 표시합니다. 모든 상태는 본인 입력 기준이며, 공식 자격 검증·대체 경력 인정·합격 확률을 판단하지 않습니다.";
    }
    window.addEventListener("muttaji:comparison-changed",event=>{
      render(event&&event.detail&&event.detail.items);
    });
  }
  if(typeof document!=="undefined"&&typeof window!=="undefined")mount();
  return {buildRoadmap,nextAction,preparationSteps};
});
