/* 뭐따지? · per-item manual reclassification.
 * No bulk/section changes: one user selection moves only that one item.
 * Operates on parser output in browser memory and makes no network calls.
 */
(function(root,factory){
  "use strict";
  const api=factory();
  if(typeof module==="object"&&module.exports)module.exports=api;
  if(root)root.MuttajiJobCorrections=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(){
  "use strict";
  const keys=["company","role","responsibilities","required","preferred","unresolved"];
  function reclassify(result,item,destination){
    if(!keys.includes(destination))throw new TypeError("유효하지 않은 분류입니다.");
    const source=keys.find(key=>Array.isArray(result[key])&&result[key].includes(item));
    if(!source)throw new Error("변경할 항목을 찾을 수 없습니다.");
    if(source===destination)return {moved:0,scope:"single"};
    result[source].splice(result[source].indexOf(item),1);
    result[destination].push(item);
    result[destination].sort((a,b)=>Number(a.line||0)-Number(b.line||0));
    item.manualReviewed=true;
    return {moved:1,scope:"single"};
  }
  return {reclassify};
});
