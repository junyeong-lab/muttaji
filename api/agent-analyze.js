// Deprecated AI Agent endpoint, including mock mode, is disabled.
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store","x-content-type-options":"nosniff"}});
export function createHandler(){
  return async request=>{
    if(request.method==="GET")return json({enabled:false,mode:"disabled",externalCallsAllowed:false,reason:"AI_FEATURE_REMOVED"});
    if(request.method==="POST")return json({error:"AGENT_DISABLED"},503);
    return json({error:"METHOD_NOT_ALLOWED"},405);
  };
}
export default {fetch:createHandler()};
