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
  const states=["확인 필요","미충족","부분 충족","충족"];
  const order={"확인 필요":0,"미충족":1,"부분 충족":2};
  function nextAction(item){
    if(item.status==="확인 필요")
      return "공고 원문과 본인의 실제 이력·증빙을 대조하고, 내 역량 화면에서 상태를 직접 확정하세요.";
    if(item.status==="부분 충족")
      return "이미 갖춘 부분과 부족한 조건을 구분하세요. 부족한 부분에 대한 학습·경험 또는 추가 확인 계획을 정리하세요.";
    const text=item.text;
    if(/경력|실무\s*경험|\d+\s*년\s*이상/.test(text))
      return "요구 경력의 종류·기간을 확인하세요. 부족한 실무 경력을 자격증이나 프로젝트로 대체할 수 있다고 단정하지 말고 채용 기준을 확인하세요.";
    if(/학력|전공|졸업|학사|석사/.test(text))
      return "공고의 학력·전공 기준과 실제 학력을 대조하고, 지원 가능한 조건인지 채용 담당자 또는 공식 안내에서 확인하세요.";
    if(/자격증|자격|기사|기능사|관리사|마스터|certified|certification|SQLD|ADsP|CPPG|CISSP|CCNA/i.test(text))
      return "공고에 명시된 자격증명을 확인하세요. 필요하면 공식 시행기관에서 취득 요건·일정을 확인해 준비 계획을 세우세요.";
    return "공고에서 요구한 역량의 구체적인 범위를 확인하고, 학습·실습·실무 경험 중 무엇을 보완해야 하는지 정리하세요.";
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
        index,line:Number.isInteger(item.line)&&item.line>0?item.line:null};
    });
    const tasks=normalized.filter(item=>item.status!=="충족").sort((a,b)=>{
      const groupA=a.kind==="required"?0:1,groupB=b.kind==="required"?0:1;
      return groupA-groupB||order[a.status]-order[b.status]||a.index-b.index;
    }).map((item,index)=>({
      ...item,priority:index+1,
      category:item.kind==="required"?"필수조건":"우대사항",
      action:nextAction(item)
    }));
    return {
      total:normalized.length,totals,tasks,
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
      if(!plan.tasks.length){
        list.appendChild(node("p","req-explain","현재 점검 기록에서는 추가 확인·보완으로 표시된 조건이 없습니다. 충족으로 표시된 내용의 증빙과 채용공고 원문을 최종 확인하세요."));
      }else{
        plan.tasks.forEach(item=>{
          const card=node("article","roadmap-task");
          card.appendChild(node("p","roadmap-rank","우선 확인 "+item.priority+" · "+item.category+" · "+item.status));
          card.appendChild(node("h3","",item.text));
          if(item.line)card.appendChild(node("small","subtext","채용공고 원문 "+item.line+"행"));
          card.appendChild(node("p","roadmap-action",item.action));
          if(item.reason)card.appendChild(node("p","roadmap-evidence","내가 입력한 근거: "+item.reason));
          list.appendChild(card);
        });
      }
      notice.textContent=(plan.requiredOpen
        ?"현재 아직 확인하거나 보완할 필수조건 "+plan.requiredOpen+"개를 우대사항보다 앞에 표시했습니다."
        :"현재 비교 결과에서 미확인·미충족 필수조건은 없습니다.")+
        " 자격증 일치 표시는 본인 입력 기준이며, 공식 자격 검증·대체 경력 인정·합격 확률은 판단하지 않습니다.";
    }
    window.addEventListener("muttaji:comparison-changed",event=>{
      render(event&&event.detail&&event.detail.items);
    });
  }
  if(typeof document!=="undefined"&&typeof window!=="undefined")mount();
  return {buildRoadmap,nextAction};
});
