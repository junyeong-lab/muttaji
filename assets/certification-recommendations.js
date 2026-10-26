/* 뭐따지? · 규칙 기반 자격증 연관 후보. AI·취득/채용요건 판정 아님. */
(function(root,factory){
  const api=factory();
  if(typeof module==="object"&&module.exports)module.exports=api;
  if(root)root.MuttajiCertRecommendations=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(){
  "use strict";
  const normalize=t=>String(t||"").normalize("NFKC").toLocaleLowerCase("ko-KR").trim();
  function mentions(source,term){
    const a=normalize(source),b=normalize(term);if(!a||!b)return false;
    for(let i=a.indexOf(b);i>=0;i=a.indexOf(b,i+1)){
      const left=a[i-1]||"",right=a[i+b.length]||"";
      if((!/[a-z0-9]/.test(b[0])||!/[a-z0-9]/.test(left))&&
         (!/[a-z0-9]/.test(b[b.length-1])||!/[a-z0-9]/.test(right)))return true;
    }
    return false;
  }
  const map=[
    [["개인정보","프라이버시"],["CPPG","ISMS-P 인증심사원"]],
    [["ISMS-P","인증심사","컴플라이언스"],["ISMS-P 인증심사원","CPPG"]],
    [["산업보안","영업비밀"],["산업보안관리사"]],
    [["AWS","CloudTrail"],["AWS Certified Cloud Practitioner","AWS Certified Solutions Architect - Associate"]],
    [["Azure","애저"],["Microsoft Azure Fundamentals (AZ-900)"]],
    [["Wazuh","SIEM","EDR","SOC","보안관제","침해사고","취약점"],["정보보안기사","CompTIA Security+","정보보안산업기사"]],
    [["정보보안","정보보호","보안점검","보안 컨설팅"],["정보보안기사","정보보호위험관리사","정보보안산업기사"]],
    [["네트워크","방화벽","라우팅","VLAN"],["네트워크관리사 2급","Cisco CCNA","정보통신기사"]],
    [["리눅스","Linux","Ubuntu","서버 운영"],["리눅스마스터 2급","리눅스마스터 1급"]],
    [["PC정비","PC 정비","헬프데스크"],["PC정비사 2급","PC정비사 1급"]],
    [["데이터 모델링","데이터 아키텍처"],["DAsP","DAP"]],
    [["SQL 튜닝","옵티마이저"],["SQLP","SQLD"]],
    [["SQL","데이터베이스"],["SQLD","SQLP"]],
    [["데이터분석","데이터 분석","빅데이터","통계분석"],["ADsP","빅데이터분석기사","ADP"]],
    [["머신러닝","인공지능","AI 모델"],["AICE associate","빅데이터분석기사"]],
    [["소프트웨어 개발","정보시스템","IT 서비스 기획"],["정보처리기사","정보처리산업기사"]]
  ];
  function recommend(catalog,context){
    if(!Array.isArray(catalog))throw new TypeError("자격증 목록이 없습니다.");
    const c=context||{},posting=String(c.posting||""),goal=String(c.goal||"");
    if(!posting.trim()&&!goal.trim())return [];
    const asText=v=>(Array.isArray(v)?v:[]).map(x=>typeof x==="string"?x:x&&x.text||"").join("\n");
    const required=asText(c.required),preferred=asText(c.preferred);
    const owned=String(c.owned||"").split(/[\n,;，]+/).map(x=>normalize(x.replace(/^[·ㆍ•*\-\d.)\s]+/,"")
      .replace(/^(?:보유\s*자격증|자격증)\s*[:：]\s*/,""))).filter(Boolean);
    const scores=new Map();
    function add(item,value,basis,keyword,explicit,index){
      let row=scores.get(item.name);
      if(!row){
        const aliases=[item.name,...String(item.aliases||"").split(";")];
        row={item,points:0,priority:0,basis:"",keyword:"",explicit:false,
             owned:aliases.some(a=>owned.includes(normalize(a))),index};
        scores.set(item.name,row);
      }
      row.points+=value;
      if(value>row.priority){row.priority=value;row.basis=basis;row.keyword=keyword;}
      if(explicit)row.explicit=true;
    }
    catalog.forEach((item,i)=>{
      const terms=[item.name,...String(item.aliases||"").split(";")].map(s=>s.trim()).filter(Boolean).sort((a,b)=>b.length-a.length);
      const foundIn=txt=>terms.find(t=>mentions(txt,t));
      let term=foundIn(required);
      if(term)add(item,100,"공고 필수조건에 명시",term,true,i);
      else if((term=foundIn(preferred)))add(item,90,"공고 우대사항에 명시",term,true,i);
      else if((term=foundIn(posting)))add(item,75,"공고 원문에 명칭 언급",term,true,i);
    });
    for(const [words,names] of map){
      let keyword=words.find(w=>mentions(posting,w)),origin="공고";
      if(!keyword){keyword=words.find(w=>mentions(goal,w));origin="목표 직무";}
      if(!keyword)continue;
      names.forEach((name,k)=>{
        const index=catalog.findIndex(item=>normalize(item.name)===normalize(name));
        if(index>=0)add(catalog[index],20-2*k,origin+" 관련 기술·분야",keyword,false,index);
      });
    }
    return [...scores.values()].sort((a,b)=>{
      if(a.explicit!==b.explicit)return a.explicit?-1:1;
      if(!a.explicit&&a.owned!==b.owned)return a.owned?1:-1;
      return b.points-a.points||a.index-b.index;
    }).slice(0,3).map(x=>({name:x.item.name,field:x.item.field,
      basis:x.basis,keyword:x.keyword,explicit:x.explicit,owned:x.owned}));
  }
  function mount(){
    const btn=document.getElementById("cert-rec-run"),list=document.getElementById("cert-rec-results"),
      note=document.getElementById("cert-rec-note");
    if(!btn||!list||!note)return;
    function el(tag,cls,text){const n=document.createElement(tag);if(cls)n.className=cls;if(text!=null)n.textContent=String(text);return n;}
    ["job-text","goal-job","certs"].forEach(id=>document.getElementById(id)?.addEventListener("input",()=>{
      list.replaceChildren();note.textContent="입력이 바뀌었습니다. 다시 검색해 주세요.";
    }));
    btn.addEventListener("click",()=>{
      list.replaceChildren();
      const catalog=window.MuttajiCertificateSource?.()||[];
      if(!catalog.length){note.textContent="자격증 DB를 불러오지 못했습니다. 새로고침 후 다시 시도해 주세요.";return;}
      const posting=document.getElementById("job-text")?.value||"";
      const goal=document.getElementById("goal-job")?.value||"";
      const owned=document.getElementById("certs")?.value||"";
      if(!posting.trim()&&!goal.trim()){note.textContent="채용공고 또는 목표 직무를 먼저 입력해 주세요.";return;}
      let parsed=null;
      if(posting.trim()){
        try{
          const rev=window.MuttajiReviewedPosting;
          parsed=rev?.text===posting.trim()?rev.result:window.JobTextAnalyzer?.analyze(posting.trim());
        }catch(_error){parsed=null;}
      }
      const results=recommend(catalog,{posting,goal,owned,required:parsed?.required,preferred:parsed?.preferred});
      note.textContent=results.length?"관련 자격증 참고 후보 "+results.length+"개 · 규칙 기반, AI 판정 아님":
        "일치 후보가 없습니다. 구체적인 공고 기술명이나 목표 직무를 입력해 주세요.";
      results.forEach(r=>{
        const card=el("article","cert-card");card.appendChild(el("h3","",r.name));
        const badges=el("div","cert-meta");
        badges.appendChild(el("span","",r.explicit?"공고에 명칭 언급":"기술·분야 연관"));
        badges.appendChild(el("span","",r.owned?"보유 입력":"보유 입력 없음"));
        card.appendChild(badges);
        card.appendChild(el("p","","연결 근거: "+r.basis+" · "+r.keyword));
        card.appendChild(el("p","",r.explicit?"공고 원문의 필수·우대 및 인정 기준을 확인하세요.":
          "공고에서 취득을 요구한다는 뜻이 아닌 참고 후보입니다."));
        const action=el("button","outline","DB에서 자세히 보기");action.type="button";
        action.addEventListener("click",()=>{
          const search=document.getElementById("cert-search");
          const field=document.getElementById("cert-field");
          if(!search||!field)return;
          search.value=r.name;field.value="";
          search.dispatchEvent(new Event("input",{bubbles:true}));
          document.getElementById("cert-results")?.scrollIntoView({behavior:"smooth",block:"start"});
        });
        card.appendChild(action);list.appendChild(card);
      });
    });
  }
  if(typeof window!=="undefined"&&typeof document!=="undefined")mount();
  return {recommend,mentions};
});
