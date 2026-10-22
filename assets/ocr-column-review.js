/* 뭐따지? OCR 결과를 원문과 대조하는 열별 검토 UI.
 * 선택된 분야는 사용자 확인을 거쳐서만 분석 텍스트에 반영한다.
 */
(function(root,factory){
  "use strict";
  const api=factory();
  if(typeof module==="object"&&module.exports)module.exports=api;
  if(root)root.MuttajiOcrReview=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(){
  "use strict";
  const options=[
    {value:"unresolved",label:"확인 필요 / 부서·직급 등"},
    {value:"responsibilities",label:"담당업무"},
    {value:"required",label:"필수조건"},
    {value:"preferred",label:"우대사항"},
    {value:"headings",label:"원문 속 제목(필수·우대 등) 유지"}
  ];
  const headings={unresolved:"기타",responsibilities:"담당업무",required:"필수 자격요건",preferred:"우대사항",headings:"기타"};
  function normalize(part){
    const text=String(part==null?"":part).replace(/\r\n?/g,"\n").trim();
    return text;
  }
  function compose(columns){
    if(!Array.isArray(columns))throw new TypeError("열 정보를 확인할 수 없습니다.");
    const blocks=[];
    for(const column of columns){
      const value=normalize(column.text);
      if(!value)continue;
      if(!Object.prototype.hasOwnProperty.call(headings,column.kind))throw new Error("분류를 선택해 주세요.");
      blocks.push(headings[column.kind]+"\n"+value);
    }
    const output=blocks.join("\n\n");
    if(output.length>20000)throw new RangeError("20,000자 제한을 초과했습니다. 텍스트를 줄여주세요.");
    if(output.split("\n").length>400)throw new RangeError("400줄 제한을 초과했습니다. 텍스트를 줄여주세요.");
    return output;
  }
  function suggest(index,count){
    if(count===4&&index===2)return "responsibilities";
    if(count===4&&index===3)return "headings";
    return "unresolved";
  }
  function makeElement(tag,cls,text){
    const el=document.createElement(tag);
    if(cls)el.className=cls;
    if(text!=null)el.textContent=String(text);
    return el;
  }
  function createUI(){
    const panel=document.getElementById("ocr-review");
    const container=document.getElementById("ocr-review-columns");
    const apply=document.getElementById("ocr-review-apply");
    const notice=document.getElementById("ocr-review-notice");
    const textField=document.getElementById("job-text");
    if(!panel||!container||!apply||!notice||!textField)return null;
    let lastInserted="";
    let lastBase="";
    function reset(){panel.hidden=true;container.replaceChildren();notice.textContent="";}
    function show(raw){
      if(!Array.isArray(raw)||!raw.length){reset();return;}
      container.replaceChildren();notice.textContent="";
      const visible=raw.map((part,i)=>({text:normalize(part),index:i})).filter(p=>p.text);
      if(!visible.length){reset();return;}
      visible.forEach((part)=>{
        const card=makeElement("div","ocr-review-card");
        const id="ocr-kind-"+part.index;
        const title=makeElement("label","label", "OCR "+(part.index+1)+"열 · 분류 확인");
        title.htmlFor=id;
        const sel=makeElement("select","ocr-kind");
        sel.id=id;
        sel.dataset.kind=String(part.index);
        options.forEach(opt=>{const item=makeElement("option","",opt.label);item.value=opt.value;sel.appendChild(item);});
        sel.value=suggest(part.index,raw.length);
        const edit=makeElement("textarea","ocr-edit");
        edit.value=part.text;edit.dataset.ocrIndex=String(part.index);edit.setAttribute("aria-label","OCR "+(part.index+1)+"열 인식 텍스트 수정");
        const help=makeElement("small","subtext",sel.value!=="unresolved"?"선택값은 열 위치에 따른 임시 제안입니다. 반드시 원본과 비교하세요.":"부서명·직급처럼 필수·우대 여부가 불확실하면 그대로 두세요.");
        card.append(title,sel,edit,help);container.appendChild(card);
      });
      panel.hidden=false;
      notice.textContent="OCR "+visible.length+"개 열을 표시했습니다. 오인식된 문장을 수정하고 각 열의 분류를 확인해 주세요.";
    }
    apply.addEventListener("click",()=>{
      try{
        const cols=Array.from(container.querySelectorAll(".ocr-review-card")).map(card=>({
          kind:card.querySelector("select").value,
          text:card.querySelector("textarea").value
        }));
        const result=compose(cols);
        if(!result){notice.textContent="입력된 문장이 없습니다. 원문을 확인해 주세요.";return;}
        let previous=textField.value.trim();
        if(lastInserted && previous===lastInserted)previous=lastBase;
        const combined=previous?previous+"\n\n"+result:result;
        if(combined.length>20000||combined.split("\n").length>400){notice.textContent="텍스트 길이 제한을 초과했습니다. 원본 또는 기존 입력을 줄여주세요.";return;}
        textField.value=combined;lastBase=previous;lastInserted=combined;
        textField.dispatchEvent(new Event("input",{bubbles:true}));
        notice.textContent="검토한 내용을 공고 입력창에 적용했습니다. 아래 '텍스트 1차 분석하기' 버튼을 눌러 분류 결과를 확인해 주세요.";
        textField.focus();
      }catch(error){notice.textContent=error&&error.message||"OCR 결과 적용 중 오류가 발생했습니다.";}
    });
    return {show,reset};
  }
  return {compose,suggest,createUI};
});
