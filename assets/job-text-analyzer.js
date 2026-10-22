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
    { group: "role", label: /^(?:모집\s*(?:직무|분야|포지션|부서)|소속\s*부서|담당\s*부서|직무\s*명|직무|포지션)$/i },
    { group: "responsibilities", label: /^(?:담당\s*업무|주요\s*업무|수행\s*업무|업무\s*내용|직무\s*내용|하는\s*일)$/i },
    { group: "required", label: /^(?:필수(?:\s*(?:지원|자격|요건|조건|사항|역량|자격\s*요건))?|지원\s*자격(?:\s*요건)?|자격\s*요건|지원\s*요건|필수\s*조건|requirements|qualifications)$/i },
    { group: "preferred", label: /^(?:우대(?:\s*(?:사항|조건|요건|자격|역량))?|preferred|plus)$/i },
    { group: "unresolved", label: /^(?:근무\s*조건|근무\s*지역|복리\s*후생|접수\s*방법|기타|회사\s*소개|전형\s*절차|공통\s*사항|지원\s*방법)$/i }
  ];
  // Korean screenshots frequently use U+318D 'ㆍ' instead of the middle dot '·'.
  var BULLET = /^\s*(?:[-*•·ㆍ∙▪◦◆■▶]|(?:\d{1,2}[.)])|(?:[가-하][.)]))\s*/;
  function withoutBullet(s) {
    return s.replace(BULLET, "").trim();
  }
  function normalizeHeader(s) {
    return s.replace(/^\s*#{1,5}\s*/, "").replace(/^[\s[【(]+|[\s\]】)]+$/g, "").replace(/\s+/g, " ").trim();
  }
  function groupForLabel(s) {
    var label = normalizeHeader(s);
    for (var i=0; i<CATEGORY.length; i++) if (CATEGORY[i].label.test(label)) return CATEGORY[i].group;
    return null;
  }
  function headingFor(line) {
    var t = withoutBullet(line);
    var normalized=normalizeHeader(t.replace(/[:：]\s*$/, ""));
    // Job site compound headings: "[정보보호 컨설턴트] 자격요건".
    var embedded=normalized.match(/^(?:.{2,45}?[\]】)]?\s+)?(자격\s*요건|지원\s*자격|필수\s*조건|우대\s*사항|우대\s*조건)$/i);
    if(embedded) {
      var explicitGroup=groupForLabel(embedded[1]);
      if(explicitGroup)return {group:explicitGroup,value:"",label:t};
    }
    // "정보보호 컨설턴트 주요업무" names both the job and the section.
    var combined=t.match(/^(.{2,45}?)\s+(주요\s*업무|담당\s*업무|수행\s*업무)\s*[:：]?$/i);
    if(combined)return {group:"responsibilities",value:"",label:combined[2],roleCandidate:combined[1].trim()};
    if(/^(?:포지션\s*상세|채용\s*정보|모집\s*공고|공고\s*상세|공고\s*정보)$/i.test(normalized))
      return {group:"unresolved",value:"",label:"표시용 제목",skip:true};
    var direct = groupForLabel(t.replace(/[:：]\s*$/, ""));
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
  function analyze(input) {
    if (typeof input !== "string") throw new TypeError("채용공고는 문자열이어야 합니다.");
    if (input.length > 20000) throw new RangeError("최대 20,000자까지 분석할 수 있습니다.");
    var text = input.replace(/\r\n?/g,"\n");
    var out = { method: "rule-based", company: [], role: [], responsibilities: [], required: [], preferred: [], unresolved: [], totalItems: 0, sourceLines: 0 };
    var section="unresolved";
    var roleHeaderLabel=null;
    var lines=text.split("\n");
    if (lines.length > 400) throw new RangeError("최대 400줄까지 분석할 수 있습니다.");
    var prior=null;
    lines.forEach(function(original, ix) {
      var raw=original.trim();
      // A blank line separates paragraphs even if the previous item was bulleted.
      if(!raw){prior=null;return;}
      out.sourceLines++;
      var head=headingFor(raw);
      if (head) {
        section=head.group;
        roleHeaderLabel=section==="role"?head.label:null;
        prior=null;
        if(head.roleCandidate){
          out.role.push({text:head.roleCandidate,line:ix+1,endLine:ix+1,
            source:original.trim(),kindHint:"공고 제목에서 추출한 모집 직무 후보 · 확인 필요"});
          out.totalItems++;
        }
        if (!head.value) return;
        raw=head.value;
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
      // Even inside a section, an explicitly contradictory label is never silently trusted.
      if (!head && /(?:필수.*우대|우대.*필수)/i.test(cleaned)) kind="unresolved";
      else if (!head && kind==="unresolved") kind=directGroup(cleaned)||"unresolved";
      // OCR often wraps a long bullet over two or more physical lines.
      // Join ONLY immediately adjacent, unbulleted continuation lines of an
      // existing bullet; never join distinct bullets, section headers or blanks.
      if (!head && !hasBullet && prior && prior.bullet && prior.kind===kind &&
          (cleaned.length<=16 || /(?:및|또는|관련|보안|\u002F|／|[,] )$/.test(prior.item.text))) {
        prior.item.text += /[\/／]$/.test(prior.item.text) ? cleaned : " "+cleaned;
        prior.item.source += "\n"+original.trim();
        prior.item.endLine=ix+1;
        return;
      }
      var item={text:cleaned,line:ix+1,endLine:ix+1,source:original.trim()};
      if(candidate)item.kindHint="부서명 후보 · 직무명인지 확인 필요";
      if(kind==="role"&&roleHeaderLabel&&/부서/.test(roleHeaderLabel))item.kindHint="모집 부서";
      out[kind].push(item);
      out.totalItems++;
      prior={item:item,kind:kind,bullet:hasBullet};
    });
    return out;
  }
  return { analyze: analyze };
});
