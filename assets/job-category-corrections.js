/* 뭐따지? · source-ordered manual reclassification of job posting items.
 * Operates only on the parser output in memory; never calls a server.
 */
(function(root,factory){
  "use strict";
  const api=factory();
  if(typeof module==="object"&&module.exports)module.exports=api;
  if(root)root.MuttajiJobCorrections=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(){
  "use strict";
  const keys=["company","role","responsibilities","required","preferred","unresolved"];
  function headingType(text){
    const normalized=String(text||"").trim()
      .replace(/^(?:(?:[0-9]{1,3}|[IVXivx]{1,5}|[ⅠⅡⅢⅣⅤⅥⅦⅧⅨⅩ]|[가-하])\s*[.)．、]\s*|[※■□◆◇▶▷▸▹●○▪▫]\s*)/u,"")
      .replace(/^[\s[【(]+|[\s\]】)]+$/g,"").replace(/\s+/g," ").trim();
    if(/^(?:우대(?:\s*(?:사항|조건|요건|자격|역량))?|preferred)$/i.test(normalized))return "preferred";
    if(/^(?:필수(?:\s*(?:자격|요건|조건|사항))?|자격\s*요건|지원\s*자격|필수\s*조건|requirements)$/i.test(normalized))return "required";
    if(/^(?:담당\s*업무|주요\s*업무|수행\s*업무)$/i.test(normalized))return "responsibilities";
    return null;
  }
  function sortedItems(result){
    return keys.flatMap(key=>(result[key]||[]).map((item,index)=>({item,key,index})))
      .sort((a,b)=>Number(a.item.line||0)-Number(b.item.line||0) ||
          Number(a.item.endLine||0)-Number(b.item.endLine||0));
  }
  function moveOne(result,item,destination){
    const src=keys.find(key=>Array.isArray(result[key])&&result[key].includes(item));
    if(!src||!keys.includes(destination))throw new Error("선택한 항목이나 분류를 찾을 수 없습니다.");
    if(src!==destination){
      result[src].splice(result[src].indexOf(item),1);
      result[destination].push(item);
    }
    item.manualReviewed=true;
  }
  function reclassify(result,item,destination,scope){
    if(!keys.includes(destination))throw new TypeError("유효하지 않은 분류입니다.");
    const ordered=sortedItems(result);
    const start=ordered.findIndex(x=>x.item===item);
    if(start<0)throw new Error("변경할 항목을 찾을 수 없습니다.");
    const isTitle=!!headingType(item.text);
    // A standalone "우대사항" is a section marker: change its whole following
    // section and keep the marker editable so the operation can be reversed.
    const section=scope==="section"||isTitle;
    if(!section){
      moveOne(result,item,destination);
      keys.forEach(k=>result[k].sort((a,b)=>a.line-b.line));
      return {moved:1,scope:"single",heading:false};
    }
    const sectionStart=Number(item.line);
    const firstSection=Number(item.sectionLine||0);
    let selected=[];
    for(let i=start;i<ordered.length;i++){
      const next=ordered[i].item;
      if(i>start){
        if(headingType(next.text))break; // next manually recoverable section
        if(next.sectionLine!=null && firstSection &&
            Number(next.sectionLine)>sectionStart)break; // explicit heading
        if(next.manualSectionStart!=null &&
           Number(next.manualSectionStart)>sectionStart)break;
        // Do not accidentally cross into unrelated job/company groups.
        if(["company","role","responsibilities"].includes(ordered[i].key) &&
           destination!=="responsibilities")break;
      }
      selected.push(next);
    }
    for(const entry of selected){
      moveOne(result,entry,destination);
      entry.manualSectionStart=sectionStart;
    }
    if(isTitle){
      item.sectionHeading=true;
      item.manualSectionStart=sectionStart;
    }
    keys.forEach(k=>result[k].sort((a,b)=>Number(a.line)-Number(b.line)));
    return {moved:selected.filter(x=>!x.sectionHeading).length,scope:"section",heading:isTitle};
  }
  return {headingType,sortedItems,reclassify};
});
