/* 뭐따지? · 채용공고 텍스트 1차 분류기 (규칙 기반, AI 아님) */
(function(root, factory) {
  "use strict";
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.JobTextAnalyzer = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function() {
  "use strict";
  var CATEGORY = [
    { group: "company", label: /^(?:기업명|회사명|회사|기업)$/i },
    { group: "role", label: /^(?:모집|모집\s*(?:직무|분야|포지션|부서|공고)|채용\s*(?:분야|포지션)|소속\s*부서|담당\s*부서|직무\s*명|직무|포지션)$/i },
    { group: "responsibilities", label: /^(?:이런\s*업무를\s*하시게\s*돼요|담당\s*업무|주요\s*업무|주요\s*역할\s*및\s*수행\s*업무|직무\s*개요|수행\s*업무|업무\s*내용|직무\s*내용|하는\s*일|이런\s*(?:업무|일)(?:를|을)\s*(?:하시게|하게)\s*(?:될\s*(?:거예요|거에요|겁니다)|됩니다)|이런\s*일을\s*해요|합류(?:하면|해서)\s*(?:할|하게\s*될)\s*일|함께\s*(?:하실|할)\s*(?:업무|일))$/i },
    { group: "unresolved", label: /^(?:스킬|기술\s*[··&/]\s*스킬|기술\s*(?:및\s*)?(?:지식|스킬)(?:\s*\(원문\)?)?|(?:상세\s*)?기술\s*스택|테크\s*스택|보유\s*스킬|skill[s]?|tech\s*stack)$/i },
    { group: "required", label: /^(?:이런\s*경험을\s*가지신\s*분을\s*찾고\s*있어요|공통\s*자격\s*요건|직무\s*필요\s*역량\s*및\s*자격\s*요건|필수(?:\s*(?:지원|자격|요건|조건|사항|역량|자격\s*요건))?|지원\s*자격(?:\s*요건)?|자격\s*요건|지원\s*요건|필수\s*조건|requirements|qualifications|이런\s*분(?:을|과)\s*(?:원해요|원합니다|찾아요|찾습니다|찾고\s*있어요|기다려요|모십니다)|이런\s*분이\s*필요해요|우리가\s*찾는\s*분|이런\s*분과\s*함께하고\s*싶어요)$/i },
    { group: "preferred", label: /^(?:이런\s*경험이\s*있다면\s*더욱\s*좋아요|우대(?:\s*(?:사항|조건|요건|자격|역량))?|preferred|plus|이런\s*(?:경험|역량)(?:이|을)?\s*있으면\s*(?:더\s*)?(?:좋아요|좋습니다|좋겠어요)|이런\s*분(?:이라면|이면)\s*더\s*좋아요|이런\s*점이\s*있으면\s*(?:더\s*)?좋아요|있으면\s*더\s*좋은\s*경험)$/i },
    { group: "unresolved", label: /^(?:근무\s*조건|근무\s*지역|복리\s*후생|접수\s*(?:방법|기간)|모집\s*기간(?:\s*및\s*마감일)?|마감일|기타\s*사항|기타|회사\s*소개|전형\s*절차|유의\s*사항|공통\s*사항|지원\s*방법)$/i }
  ];
  // Korean screenshots frequently use U+318D 'ㆍ' instead of the middle dot '·'.
  var BULLET = /^\s*(?:[-*•·ㆍ∙▪◦◆■□◇▶▷▸▹●○◯]|[oO](?=\s)|(?:\d{1,2}[.)])|(?:[가-하][.)]))\s*/;
  function withoutBullet(s) {
    return s.replace(BULLET, "").trim();
  }
  function normalizeHeader(s) {
    return s.replace(/^\s*#{1,5}\s*/, "").replace(/^[\s[【(]+|[\s\]】)]+$/g, "")
      .replace(/[!！?？。]+\s*$/g, "").replace(/\s+/g, " ").trim();
  }
  function groupForLabel(s) {
    var label = normalizeHeader(s);
    for (var i=0; i<CATEGORY.length; i++) if (CATEGORY[i].label.test(label)) return CATEGORY[i].group;
    return null;
  }
  function headingFor(line) {
    var t = withoutBullet(line);
    // Headings copied from job boards can be numbered ("Ⅱ. 우대사항",
    // "2) 우대사항", "나. 우대사항") or use decorative symbols.
    // Strip prefixes ONLY for testing a complete heading, not ordinary text.
    t=t.replace(/^(?:(?:[0-9]{1,3}|[IVXivx]{1,5}|[ⅠⅡⅢⅣⅤⅥⅦⅧⅨⅩ]|[가-하])\s*[.)．、]\s*|[※■□◆◇▶▷▸▹●○▪▫]\s*)/u,"").trim();
    var normalized=normalizeHeader(t.replace(/[:：]\s*$/, ""));
    if(/^(?:전문\s*지식|직무\s*필요\s*역량)$/.test(normalized))return {preserveSection:true};
    if(/^(?:공통|경력|신입)$/.test(normalized)&&/^\[(?:공통|경력|신입)\]$/.test(t.trim()))return {preserveSection:true};

    // Do not assign a combined job-table title to either eligibility bucket.
    if(/^(?:포지션\s*및\s*자격\s*요건|모집\s*분야\s*및\s*자격\s*요건(?:\s*정보)?|모집\s*부문\s*자격\s*요건\s*및\s*우대\s*사항|자격\s*요건\s*및\s*우대\s*사항|담당\s*업무\s*\/\s*자격\s*조건\s*\/\s*우대\s*사항|모집\s*분야\s*\/\s*업무\s*내용\s*\/\s*모집\s*인원)$/i.test(normalized))
      return {group:"unresolved",value:"",label:normalized};
    if(/^(?:지원\s*대상|지원\s*대상자)$/i.test(normalized))
      return {group:"required",value:"",label:normalized};
    if(/^.{2,55}에\s*지원하려면$/i.test(normalized))
      return {group:"required",value:"",label:normalized};
    if(/^우대\s*(?:사항|조건|요건)\s*\((?:경력|신입|공통)\)?$/i.test(normalized))
      return {group:"preferred",value:"",label:normalized};
    if(/^(?:채용\s*부문|모집\s*부문|포지션)$/i.test(normalized))
      return {group:"role",value:"",label:normalized};
    // Clear prior required/preferred/duty buckets at non-eligibility sections.
    if(/^(?:근무\s*환경|근무\s*일시|근무\s*형태|근무\s*시간|근\s*무\s*지|오시는\s*길|근무\s*안내[·\s]*복지|세부\s*사항|채용\s*절차|절차\s*안내|제출\s*서류|전형\s*안내|팀\s*소개|지원\s*방법\s*및\s*전형\s*절차는|신입\s*사원\s*성장\s*지원|CELA만의\s*특별한\s*문화|풍부한\s*복리\s*후생|(?:업무|복지)\s*환경|함께\s*일할\s*팀|팀과\s*일하는\s*방식|기술\s*환경|인턴십\s*기간(?:\s*급여)?(?:은|는)|인턴십\s*근무\s*환경은|정규직\s*전환\s*시\s*더\s*많은\s*복지가\s*기다리고\s*있습니다|회사에\s*대해\s*더\s*알고\s*싶으시다면.+|[\[\(]?\s*(?:제출\s*서류|기술\s*환경)\s*[\]\)]?)$/i.test(normalized))
      return {group:"unresolved",value:"",label:normalized};

    // Public Korean posting sections: never carry a prior required/preferred
    // category across an explicitly titled new section.
    if(/^이런\s*업무를\s*해요$/.test(normalized))return {group:"responsibilities",value:"",label:normalized};
    if(/^이런\s*분들을\s*찾고\s*있어요$/.test(normalized))return {group:"required",value:"",label:normalized};
    if(/^이런\s*분이라면\s*더욱\s*좋아요$/.test(normalized))return {group:"preferred",value:"",label:normalized};
    if(/^(?:이런\s*기술이\s*필요해요|이런\s*조건에서\s*근무할\s*예정이에요|전형\s*절차\s*및\s*유의\s*사항|채용\s*포지션\s*안내)$/.test(normalized))
      return {group:"unresolved",value:"",label:normalized};
    // Some job-board tables flatten a role name and [지원 자격] into one line.
    // Preserve any leading role text separately instead of losing its source.
    var inlineBracket=t.match(/^(.*?)\s*\[\s*(지원\s*자격|자격\s*요건|필수\s*조건|우대\s*(?:사항|요건|조건))\s*\]\s*(.*)$/i);
    if(inlineBracket){
      var inlineGroup=groupForLabel(inlineBracket[2]);
      if(inlineGroup)return {group:inlineGroup,value:inlineBracket[3].trim(),label:inlineBracket[2],prefix:inlineBracket[1].trim()||null};
    }
    var roleMarker=normalized.match(/^정보보호\s*[-–]\s*(BLUE|RED)$/i);
    if(roleMarker)return {group:"role",value:normalized,label:"모집 직무"};
    if(/^실무\s*경험\s*및\s*보안\s*엔지니어링\s*역량$/.test(normalized))return {preserveSection:true};
    // A complete conversational heading may be glued to the end of an intro.
    // Keep the intro as a separate source span on the SAME physical line.
    var suffix=t.match(/^(.+[.!?。])\s*(이런\s*업무를\s*하시게\s*돼요[!！]?|이런\s*경험을\s*가지신\s*분을\s*찾고\s*있어요[!！]?|이런\s*경험이\s*있다면\s*더욱\s*좋아요[!！]?)$/);
    if(suffix)return {group:groupForLabel(suffix[2]),value:"",label:suffix[2],prefix:line.slice(0,line.lastIndexOf(suffix[2])).trim()};
    // Job site compound headings: "[정보보호 컨설턴트] 자격요건".
    var embedded=normalized.match(/^(?:.{2,45}?[\]】)]?\s+)?(자격\s*요건|지원\s*자격|필수\s*조건|우대\s*사항|우대\s*조건)$/i);
    if(embedded) {
      var explicitGroup=groupForLabel(embedded[1]);
      if(explicitGroup)return {group:explicitGroup,value:"",label:t};
    }
    if(groupForLabel(normalized)==="responsibilities")return {group:"responsibilities",value:"",label:t};
    // "정보보호 컨설턴트 주요업무" names both the job and the section.
    var combined=t.match(/^(.{2,45}?)\s+(주요\s*업무|담당\s*업무|수행\s*업무)\s*[:：]?$/i);
    if(combined)return {group:"responsibilities",value:"",label:combined[2],roleCandidate:combined[1].trim()};
    if(/^(?:포지션\s*상세|채용\s*정보|모집\s*공고|공고\s*상세|공고\s*정보)$/i.test(normalized))
      return {group:"unresolved",value:"",label:"표시용 제목",skip:true};
    var direct = groupForLabel(t.replace(/[:：]\s*$/, ""));
    // Full-line marker "우대 사항" is a section boundary, not a
    // requirement item. This must reset the active section for all next rows.
    if (direct) return { group: direct, value: "", label: t.replace(/[:：]\s*$/, "").trim() };
    var m = t.match(/^([^:：]{1,38})\s*[:：]\s*(.*)$/);
    if (m) {
      var group = groupForLabel(m[1]);
      if (group) return { group: group, value: m[2].trim(), label: m[1].trim() };
    }
    return null;
  }
  function directGroup(s) {
    if (/(?:필수\s*[\/·&+]\s*우대|우대\s*[\/·&+]\s*필수|필수.*우대|우대.*필수)/i.test(s)) return "unresolved";
    if (/^(?:필수(?:\s*조건)?|반드시|지원\s*자격)\s*[:：\s]/.test(s)) return "required";
    if (/^(?:우대(?:\s*사항)?|있으면\s*좋은|가산점)\s*[:：\s]/.test(s)) return "preferred";
    if (/^(?:담당\s*업무|주요\s*업무)\s*[:：\s]/.test(s)) return "responsibilities";
    return null;
  }
  // A short, unlabeled organization/team name at the top of a posting is
  // only a candidate for a recruiting department, NEVER a verified job title.
  // No keyword matching against skills or certifications here.
  function organizationCandidate(value) {
    var v=String(value||"").trim();
    return v.length>=3 && v.length<=26
      && /^[A-Za-z0-9가-힣·&/_+ -]+(?:사업부|기술부|본부|센터|팀|실|부)$/.test(v)
      && !/\s{2,}|[:：]/.test(v);
  }
  function nonRequirementKind(value){
    var v=withoutBullet(String(value||"")).trim();
    if(/^(?:직무\s*개요|전문\s*지식|기타\s*사항)\s*[:：]?$/.test(v))return "unresolved";

    if(/^(?:상세\s*내용을\s*입력하세요|채용\s*제목을\s*입력해\s*주세요|필수\s*기재\s*사항(?:\s*[:：].*)?|서류\s*전형|최종\s*합격|면접\s*전형)\s*$/i.test(v))return "unresolved";

    if(/^※\s*.*(?:자격증\s*취득\s*기회|자격증\s*취득\s*비용|취득\s*기회와\s*비용).*(?:지원|가능)/.test(v))return "unresolved";

    if(/^※\s*(?:상세\s*공고|지원\s*방법|자세한\s*사항)/.test(v))return "unresolved";
    if(/^\d{1,2}$/.test(v))return "unresolved";
    if(/^.{2,80}\s+(?:0+|[1-9]\d{0,2}|○+)\s*명$/.test(v))return "unresolved";
    if(/^(?:학력|전공|경력|역량)\s*[:：]\s*$/.test(v))return "unresolved";

    if(/^정보보호\s*[-–]\s*(?:BLUE|RED)$/i.test(v))return "role";
    if(/^(?:접수\s*기간|모집\s*기간(?:\s*및\s*마감일)?|마감일|접수\s*방법)\s*[:：]/.test(v))return "unresolved";
    if(/^[([（]?\s*(?:(?:모집|채용)\s*인원\s*[:：]?\s*)?(?:[○ㅇOo0-9]+|약간|다수)\s*명\s*[\])）]?$/.test(v))return "unresolved";
    if(v.length<=140&&/(?:채용|모집)(?:\s*(?:공고|신입|경력|신입[·/ㆍ]경력|\([^)]*\)))*$/.test(v))return "role";
    return null;
  }
  function analyze(input) {
    if (typeof input !== "string") throw new TypeError("채용공고는 문자열이어야 합니다.");
    if (input.length > 20000) throw new RangeError("최대 20,000자까지 분석할 수 있습니다.");
    var text = input.replace(/\r\n?/g,"\n");
    var out = { method: "rule-based", company: [], role: [], responsibilities: [], required: [], preferred: [], unresolved: [], totalItems: 0, sourceLines: 0 };
    var section="unresolved";
    var roleHeaderLabel=null;
    var sectionLine=0;
    var workArea="";
    var skillContext=false;
    var lines=text.split("\n");
    if (lines.length > 400) throw new RangeError("최대 400줄까지 분석할 수 있습니다.");
    var prior=null;
    lines.forEach(function(original, ix) {
      var raw=original.trim();
      // A blank line separates paragraphs even if the previous item was bulleted.
      if(!raw){prior=null;return;}
      out.sourceLines++;

      // Public job boards sometimes flatten several [section] table cells into
      // one physical line. Split by explicit source markers without inventing
      // extra line numbers or transferring a preference into a requirement.
      var joined=[...raw.matchAll(/\[\s*(담당\s*업무|주요\s*업무|자격\s*요건|지원\s*자격|우대\s*(?:사항|요건|조건))\s*\]/gi)];
      if(joined.length>=2){
        var prefix=raw.slice(0,joined[0].index).trim();
        if(prefix){
          out.unresolved.push({text:withoutBullet(prefix),line:ix+1,endLine:ix+1,source:original.trim(),kindHint:"표 형태 모집 직무·인원 후보 · 확인 필요"});
          out.totalItems++;
        }
        joined.forEach(function(match,j){
          var g=groupForLabel(match[1]);
          if(!g)return;
          var next=joined[j+1];
          var value=raw.slice(match.index+match[0].length,next?next.index:raw.length).trim();
          section=g;sectionLine=ix+1;prior=null;
          if(value){
            out[g].push({text:withoutBullet(value),line:ix+1,endLine:ix+1,source:original.trim(),sectionLine:sectionLine,kindHint:"한 원문 행에 여러 구역이 연결됨 · 원문 확인 필요"});
            out.totalItems++;
          }
        });
        return;
      }

      var head=headingFor(raw);
      if(head&&head.preserveSection){prior=null;return;}
      if(head&&head.prefix){
        out.unresolved.push({text:withoutBullet(head.prefix),source:head.prefix,line:ix+1,endLine:ix+1,sectionLine:sectionLine});
        out.totalItems++;prior=null;
      }
      if (head) {
        section=head.group;
        skillContext=section==="unresolved" && /^(?:스킬|기술\s*[··&/]\s*스킬|기술\s*(?:및\s*)?(?:지식|스킬)|(?:상세\s*)?기술\s*스택|테크\s*스택|보유\s*스킬|skill[s]?|tech\s*stack)/i.test(head.label||"");
        sectionLine=ix+1;
        roleHeaderLabel=section==="role"?head.label:null;
        if(section!=="responsibilities")workArea="";
        prior=null;
        if(head.roleCandidate){
          out.role.push({text:head.roleCandidate,line:ix+1,endLine:ix+1,
            source:original.trim(),kindHint:"공고 제목에서 추출한 모집 직무 후보 · 확인 필요"});
          out.totalItems++;
        }
        if (!head.value) return;
        raw=head.value;
      }
      // Technology/management subsection markers are not separate duties.
      if(!head&&section==="responsibilities"){
        var subsection=withoutBullet(raw).match(/^(.{2,45}?\s*\(\s*(기술|관리)\s*\))\s*[:：]?$/);
        if(subsection&&/(?:컨설턴트|엔지니어|담당자|직무)/.test(subsection[1])){
          workArea=subsection[2];
          out.responsibilities.push({text:subsection[1],line:ix+1,endLine:ix+1,
            source:original.trim(),sectionLine:sectionLine,sectionHeading:true,
            kindHint:workArea+" 분야 업무 구간 제목"});
          prior=null;
          return;
        }
      }
      // Some job-board exports include a role prefix before "가. 업무".
      if(section==="responsibilities"){
        var mixed=raw.match(/^(.{2,45}?)\s+[가-하][.)]\s+(.+)$/);
        if(mixed && /(?:컨설턴트|엔지니어|개발자|분석가|담당자|운영자|전문가|관리자|기술자)/.test(mixed[1])){
          var found=out.role.some(function(item){
            return item.text===mixed[1]||item.text===mixed[1].replace(/\([^)]*\)/g,"").trim();
          });
          if(!found){
            out.role.push({text:mixed[1],line:ix+1,endLine:ix+1,source:original.trim(),
              kindHint:"공고의 업무 열에서 추출한 직무 후보 · 확인 필요"});
            out.totalItems++;
          }
          raw=mixed[2];
          prior=null;
        }
      }
      var hasBullet=BULLET.test(raw);
      var cleaned=withoutBullet(raw);
      if (!cleaned) {prior=null;return;}
      var kind=head?head.group:section;
      var candidate=false;
      // The first unlabeled short team name (e.g. "ES기술부") may be a
      // recruiting department. Surface it in the shared role/department card
      // with an explicit candidate flag rather than hiding it under 기타.
      if (!head && !hasBullet && section==="unresolved" &&
          out.totalItems===0 && organizationCandidate(cleaned)) {
        kind="role";
        candidate=true;
      }
      // An explicit location label must not inherit a role or eligibility section.
      var isLocation=!head&&/^(?:근무\s*(?:지|지역|장소|주소))\s*[:：]\s*\S/.test(cleaned);
      if(isLocation){kind="unresolved";section="unresolved";skillContext=false;sectionLine=ix+1;roleHeaderLabel=null;prior=null;}
      var nonRequirement=nonRequirementKind(cleaned);
      if(nonRequirement){kind=nonRequirement;prior=null;}
      if(/^자격증\s*[:：]/.test(cleaned)&&/우대\s*$/.test(cleaned))kind="preferred";
      // A standalone explicit "... 우대" bullet is preferred even when it follows a compact required-qualifications table cell.
      if(!head&&kind==="required"&&cleaned.length<=90&&/\S.{2,}\s+우대\s*$/.test(cleaned))kind="preferred";

      if(!head&&kind==="required"&&/(?:채용\s*시\s*우대(?:함|합니다)?|우대(?:함|합니다|대상)?|서류\s*전형\s*시\s*가점\s*부여|가점\s*부여)\s*$/.test(cleaned))kind="preferred";

      // A negative condition must never be treated as a positive requirement.
      if(!head&&kind==="required"&&/필수(?:\s*조건)?(?:는|가)?\s*아닙니다/.test(cleaned))kind="unresolved";

      // Employment, application and welfare labels are not qualifications.
      if(!head&&/^(?:근무\s*(?:형태|일시|요일|시간|지|지역|조건)|채용\s*형태|제출\s*서류|접수\s*(?:방법|기간)|전형\s*절차|지원\s*방법|지원\s*서류)\s*[:：]/.test(cleaned)){
        kind="unresolved";section="unresolved";skillContext=false;prior=null;
      }

      // Even inside a section, an explicitly contradictory label is never silently trusted.
      if (!head && /(?:필수.*우대|우대.*필수)/i.test(cleaned)) kind="unresolved";
      else if(!head&&/^※\s*(?:기술|관리).{0,60}포지션.{0,40}채용/.test(raw))kind="unresolved";
      else if (!head && kind==="unresolved"&&!nonRequirement) kind=directGroup(cleaned)||"unresolved";
      // A short typo/variant that starts like a section title should remain
      // independently reviewable, not be merged into the preceding bullet.
      // Do NOT silently assume it is a valid heading or a preferred criterion.
      var suspectedHeading=!head&&!hasBullet&&
        /^(?:우대|필수|자격|지원)[가-힣\s]{0,8}$/.test(cleaned)&&cleaned.length<=15;
      if(suspectedHeading)prior=null;
      // OCR often wraps a long bullet over two or more physical lines.
      // Join ONLY immediately adjacent, unbulleted continuation lines of an
      // existing bullet; never join distinct bullets, section headers or blanks.
      var certExample=!head&&!hasBullet&&prior&&
        /(?:자격증|자격)\s*(?:소지자?|보유자?)$/.test(prior.item.text)&&
        /(?:기사|관리사|심사원|CPPG|CISSP|ISO\s*27001|SQLD)/i.test(cleaned)&&
        /[,，]/.test(cleaned);
      if(!head&&!hasBullet&&prior?.location&&prior.kind===kind&&
          /^\d{1,5}\s*(?:호|층|동)$/.test(cleaned)){
        prior.item.text+=" "+cleaned;
        prior.item.source+="\n"+original.trim();
        prior.item.endLine=ix+1;
        return;
      }
      if (!head && !hasBullet && prior && prior.bullet && prior.kind===kind &&
          (cleaned.length<=16 || certExample ||
           /(?:및|또는|관련|보안|정하는|\u002F|／|[,] )$/.test(prior.item.text))) {
        prior.item.text += /[\/／]$/.test(prior.item.text) ? cleaned : " "+cleaned;
        prior.item.source += "\n"+original.trim();
        prior.item.endLine=ix+1;
        return;
      }
      var item={text:cleaned,line:ix+1,endLine:ix+1,source:original.trim(),sectionLine:sectionLine};

      // Distinguish grouping captions from standalone qualification criteria.
      if((kind==="required"||kind==="preferred")&&/^(?:\[(?:공통|경력|신입)\]|아래\s*역량을\s*보유하신\s*분)$/.test(cleaned))
        item.sectionHeading=true;

      if((kind==="required"||kind==="preferred")&&/^(?:관리진단|기술진단)\s*컨설팅\s*\([^)]*\)$/.test(cleaned))item.sectionHeading=true;

      if(kind==="unresolved"&&skillContext)item.kindHint="원문 스킬 참고 정보 · 필수·우대 여부 미확정";
      if(candidate)item.kindHint="부서명 후보 · 직무명인지 확인 필요";
      if(suspectedHeading)item.kindHint="제목으로 보이는 문구 · 분류 및 아래 구간을 확인해 주세요";
      if(kind==="role"&&roleHeaderLabel&&/부서/.test(roleHeaderLabel))item.kindHint="모집 부서";
      if(kind==="responsibilities"&&workArea)item.kindHint=workArea+" 분야 업무";
      out[kind].push(item);
      out.totalItems++;
      prior={item:item,kind:kind,location:isLocation,bullet:hasBullet && !/^\s*[가-하][.)]/.test(raw)};
    });
    // Repeated titles from a summary and detailed listing appear only once.
    // Keep the earliest source line and leave the original input unchanged.
    var seenTitles=new Set();
    out.role=out.role.filter(function(item){
      var title=item.text.normalize("NFKC").toLowerCase().replace(/\s+/g,"");
      if(seenTitles.has(title)){out.totalItems--;return false;}
      seenTitles.add(title);
      return true;
    });
    return out;
  }
  return { analyze: analyze, nonRequirementKind: nonRequirementKind };
});
