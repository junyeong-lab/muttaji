// Legacy AI Gateway route retired. Never call an external model.
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store","x-content-type-options":"nosniff"}});
export default {fetch:async request=>{
  if(request.method==="GET")return json({enabled:false,mode:"disabled",reason:"AI_FEATURE_REMOVED"});
  if(request.method==="POST")return json({error:"SERVICE_DISABLED",message:"AI 분석 기능이 제거되었습니다."},503);
  return json({error:"METHOD_NOT_ALLOWED"},405);
}};
