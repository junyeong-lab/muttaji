import {validateInput,validateOutput,exactKeys,PROFILE_FIELDS} from "../lib/agent/contracts.js";

// This preview loads a public synthetic fixture only. It never reads input values,
// posts profiles, enables the server API, or changes comparison assessments.
export function validateFixture(value) {
  if(!exactKeys(value,["input","output"]))throw Error("INVALID_FIXTURE");
  const input=validateInput(value.input);
  const verify=(ref,sourceInput,expectedSource)=>{
    if(!exactKeys(ref,["id","source","field","start","end","quote"]) || ref.source!==expectedSource
      || typeof ref.id!=="string" || !/^ev-[a-f0-9]{64}$/.test(ref.id))return false;
    if(expectedSource==="posting"?ref.field!=="posting":!PROFILE_FIELDS.includes(ref.field))return false;
    const text=expectedSource==="posting"?sourceInput.posting:sourceInput.profile[ref.field];
    return Number.isInteger(ref.start)&&Number.isInteger(ref.end)&&ref.start>=0&&ref.end>ref.start&&ref.end<=text.length
      && typeof ref.quote==="string"&&!!ref.quote.trim()&&ref.quote.length<=1000&&text.slice(ref.start,ref.end)===ref.quote;
  };
  validateOutput(value.output,input,verify);
  return value;
}

export function createPreviewController({load,view,timeoutMs=8000}) {
  let revision=0,generation=0,active=null;
  function invalidate() {
    revision++;generation++;
    active?.abort();active=null;
    view.clear();view.busy(false);
    view.status("입력 내용이 변경되어 이전 예제 결과를 숨겼습니다.");
  }
  async function run() {
    const currentRevision=revision,currentGeneration=++generation;
    active?.abort();
    const controller=new AbortController();active=controller;
    let timer;
    view.clear();view.busy(true);view.status("가상 예제 결과를 불러오고 있습니다.");
    try {
      const fixture=await Promise.race([
        load(controller.signal),
        new Promise((resolve,reject)=>{timer=setTimeout(()=>{controller.abort();reject(Error("TIMEOUT"));},timeoutMs);})
      ]);
      if(currentRevision!==revision||currentGeneration!==generation)return;
      view.render(validateFixture(fixture));
      view.status("가상 예제의 모의 결과입니다. 현재 입력한 공고와 내 역량을 분석한 결과가 아닙니다.");
    } catch {
      if(currentRevision===revision&&currentGeneration===generation)
        view.status("예제 결과를 불러오지 못했습니다. 다시 시도해 주세요. 기존 공고 분석과 요건 비교는 계속 사용할 수 있습니다.");
    } finally {
      clearTimeout(timer);
      if(currentGeneration===generation){active=null;view.busy(false);}
    }
  }
  return {run,invalidate};
}

export function mountAgentPreview(doc,win) {
  const button=doc.getElementById("agent-preview-run");
  const clearButton=doc.getElementById("agent-preview-clear");
  const panel=doc.getElementById("agent-preview-results");
  const cards=doc.getElementById("agent-preview-cards");
  const examples=doc.getElementById("agent-preview-examples");
  const status=doc.getElementById("agent-preview-status");
  if(!button||!clearButton||!panel||!cards||!examples||!status)return null;
  const el=(tag,className,text)=>{
    const node=doc.createElement(tag);if(className)node.className=className;
    if(text!==undefined)node.textContent=String(text);
    return node;
  };
  const fieldNames={goalJob:"목표 직무",education:"학력·전공",experience:"경력·프로젝트",certificates:"자격증",skills:"기술·지식"};
  const categories={required:"필수조건",preferred:"우대사항",unresolved:"확인 필요"};
  const relations={related:"관련 경험 있음 · 충족 판정 아님","explicit-gap":"예제에서 경험 부족을 직접 명시","not-stated":"정보 미입력 · 보유 여부 확인 필요"};
  function render(fixture) {
    cards.replaceChildren();examples.replaceChildren();
    const posting=el("details","agent-example");
    posting.appendChild(el("summary","","가상 채용공고 원문 보기"));
    posting.appendChild(el("pre","agent-source",fixture.input.posting));
    const profile=el("details","agent-example");
    profile.appendChild(el("summary","","가상 지원자 입력 보기"));
    const fields=el("dl","");
    for(const key of PROFILE_FIELDS){fields.appendChild(el("dt","",fieldNames[key]));fields.appendChild(el("dd","",fixture.input.profile[key]||"미입력"));}
    profile.appendChild(fields);examples.appendChild(posting);examples.appendChild(profile);
    for(const item of fixture.output.requirements) {
      const card=el("article","agent-result-card");
      card.appendChild(el("span","pill",categories[item.category]+" · 가상 예제"));
      card.appendChild(el("h4","",item.postingEvidence[0].quote));
      card.appendChild(el("p","agent-relation",relations[item.relation]));
      card.appendChild(el("p","", "예제 해석: "+item.interpretation));
      card.appendChild(el("p","", "중요하게 본 이유: "+item.importance));
      card.appendChild(el("h5","","공고에서 확인한 문구"));
      for(const ref of item.postingEvidence)card.appendChild(el("blockquote","agent-quote",ref.quote));
      card.appendChild(el("h5","","가상 지원자 입력 근거"));
      if(!item.profileEvidence.length)card.appendChild(el("p","","해당 정보를 입력하지 않았습니다. 미충족으로 판단하지 않습니다."));
      for(const ref of item.profileEvidence){
        card.appendChild(el("small","subtext",fieldNames[ref.field]));
        card.appendChild(el("blockquote","agent-quote",ref.quote));
      }
      for(const [heading,items] of [["추가로 확인할 사항",item.uncertainties],["제안하는 다음 행동",item.nextActions]]) {
        card.appendChild(el("h5","",heading));
        const list=el("ul","");for(const text of items)list.appendChild(el("li","",text));card.appendChild(list);
      }
      cards.appendChild(card);
    }
    panel.hidden=false;
  }
  const controller=createPreviewController({
    load:async signal=>{
      const response=await win.fetch("./data/agent-mock-example.json",{method:"GET",cache:"no-store",signal});
      if(!response.ok||!/^application\/json\b/i.test(response.headers.get("content-type")||""))throw Error("FIXTURE_UNAVAILABLE");
      const raw=await response.text();if(raw.length>64000)throw Error("FIXTURE_TOO_LARGE");
      return JSON.parse(raw);
    },
    view:{render,clear(){panel.hidden=true;cards.replaceChildren();examples.replaceChildren();},
      busy(value){button.disabled=value;button.setAttribute("aria-busy",String(value));},
      status(text){status.textContent=text;}}
  });
  button.addEventListener("click",()=>controller.run());
  const invalidate=()=>{
    controller.invalidate();
    status.textContent="입력 또는 검토 내용이 변경되어 이전 예제 결과를 숨겼습니다. 가상 예제는 다시 볼 수 있습니다.";
  };
  clearButton.addEventListener("click",()=>{
    controller.invalidate();status.textContent="예제 결과를 닫았습니다.";
  });
  for(const id of ["job-text","job-file","goal-job","education","experience","certs","skills"])
    doc.getElementById(id)?.addEventListener(id==="job-file"?"change":"input",invalidate);
  doc.getElementById("profile-clear")?.addEventListener("click",invalidate);
  win.addEventListener("muttaji:posting-reviewed",invalidate);
  return controller;
}
if(typeof document!=="undefined"&&typeof window!=="undefined")mountAgentPreview(document,window);
