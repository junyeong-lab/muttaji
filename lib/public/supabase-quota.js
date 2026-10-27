// Server-only RPC. The database owns the budget; clients cannot raise limits.
function unavailable(diagnostic){const error=new Error("QUOTA_UNAVAILABLE");error.diagnostic=diagnostic;return error;}
const codes=new Set(['ALLOWED','NOT_INITIALIZED','BUDGET_EXHAUSTED','TOTAL_LIMIT_REACHED','RATE_LIMITED']);
export function createSupabaseQuota({url,secret,namespace="release1",fetchImpl=fetch}){
 const endpoint=new URL(url);
 if(endpoint.protocol!=="https:"||!endpoint.hostname.endsWith(".supabase.co")||endpoint.username||endpoint.password||endpoint.port||endpoint.search||endpoint.hash||endpoint.pathname!=="/")throw Error("INVALID_QUOTA_CONFIG");
 if(typeof secret!=="string"||secret.length<20||!/^[a-z0-9-]{1,32}$/.test(namespace))throw Error("INVALID_QUOTA_CONFIG");
 const legacy=secret.split('.').length===3;
 if(legacy){let claims;try{claims=JSON.parse(Buffer.from(secret.split('.')[1],'base64url').toString());}catch{throw Error("INVALID_QUOTA_KEY");}if(claims.role!=="service_role")throw Error("INVALID_QUOTA_KEY");}
 else if(!secret.startsWith("sb_secret_")||/[\r\n]/.test(secret))throw Error("INVALID_QUOTA_KEY");
 return {scope:"shared",async reserve({kind,subject,session}){
  if(!['model','url'].includes(kind)||!/^[\w-]{20,100}$/.test(subject)||!/^[a-f0-9]{48}$/.test(session))throw Error("INVALID_QUOTA_SUBJECT");
  const headers={apikey:secret,"content-type":"application/json"};
  // New sb_secret keys go in apikey only; legacy service_role JWT also uses Bearer.
  if(legacy)headers.authorization="Bearer "+secret;
  let response;try{response=await fetchImpl(new URL('/rest/v1/rpc/muttaji_reserve_quota',endpoint),{method:"POST",headers,body:JSON.stringify({p_namespace:namespace,p_kind:kind,p_subject:subject,p_session:session}),redirect:"error",signal:AbortSignal.timeout(8000)});
  }catch(error){
   const timeout=["TimeoutError","AbortError"].includes(error?.name);
   throw unavailable(timeout?"SUPABASE_TIMEOUT":"SUPABASE_NETWORK_FAILED");
  }
  if(!response.ok){
   const diagnostic=({401:"SUPABASE_AUTH_FAILED",403:"SUPABASE_PERMISSION_DENIED",404:"SUPABASE_RPC_NOT_FOUND",429:"SUPABASE_RATE_LIMITED"})[response.status]||"SUPABASE_SERVER_ERROR";
   throw unavailable(diagnostic);
  }
  const text=await response.text();if(text.length>2000)throw unavailable("SUPABASE_INVALID_RESPONSE");
  let code;try{code=JSON.parse(text);}catch{throw unavailable("SUPABASE_INVALID_RESPONSE");}if(!codes.has(code))throw unavailable("SUPABASE_INVALID_RESPONSE");
  return code;
 }};
}
