// One atomic reservation across all Function instances. No profile/URL/IP stored.
export const RESERVE_LUA=`
if redis.call('GET',KEYS[1]) ~= 'ready-v1' then return 'NOT_INITIALIZED' end
local spent=tonumber(redis.call('GET',KEYS[2]))
local total=tonumber(redis.call('GET',KEYS[3]))
if not spent or not total then return 'NOT_INITIALIZED' end
local ip=tonumber(redis.call('GET',KEYS[4]) or '0')
local session=tonumber(redis.call('GET',KEYS[5]) or '0')
if not ip or not session then return 'NOT_INITIALIZED' end
if spent+tonumber(ARGV[1])>tonumber(ARGV[2]) then return 'BUDGET_EXHAUSTED' end
if total>=tonumber(ARGV[3]) then return 'TOTAL_LIMIT_REACHED' end
if ip>=tonumber(ARGV[4]) or session>=tonumber(ARGV[4]) then return 'RATE_LIMITED' end
redis.call('INCRBY',KEYS[2],ARGV[1])
redis.call('INCR',KEYS[3])
redis.call('INCR',KEYS[4]); redis.call('EXPIRE',KEYS[4],172800)
redis.call('INCR',KEYS[5]); redis.call('EXPIRE',KEYS[5],172800)
return 'ALLOWED'
`;
const codes=new Set(['ALLOWED','NOT_INITIALIZED','BUDGET_EXHAUSTED','TOTAL_LIMIT_REACHED','RATE_LIMITED']);
export function createSharedQuota({url,token,budgetMicros,totalRequests,namespace="release1",fetchImpl=fetch,clock=Date.now}){
 const endpoint=new URL(url);
 if(endpoint.protocol!=="https:"||!endpoint.hostname.endsWith(".upstash.io")||endpoint.username||endpoint.password||endpoint.port||endpoint.search||endpoint.hash||endpoint.pathname!=="/")throw Error("INVALID_QUOTA_CONFIG");
 if(typeof token!=="string"||!token||!Number.isSafeInteger(budgetMicros)||budgetMicros<250000||budgetMicros>5000000||!Number.isSafeInteger(totalRequests)||totalRequests<1||totalRequests>100||!/^[a-z0-9-]{1,32}$/.test(namespace))throw Error("INVALID_QUOTA_CONFIG");
 const prefix="muttaji:{"+namespace+"}";
 return {scope:"shared",async reserve({kind,subject,session}){
  if(!['model','url'].includes(kind)||!/^[\w-]{20,100}$/.test(subject)||!/^[a-f0-9]{48}$/.test(session))throw Error("INVALID_QUOTA_SUBJECT");
  const day=Math.floor(clock()/86400000),charge=kind==="model"?250000:0;
  const keys=[prefix+":ready",prefix+":reserved",prefix+":"+kind+":total",prefix+":"+kind+":ip:"+day+":"+subject,prefix+":"+kind+":session:"+day+":"+session];
  const response=await fetchImpl(endpoint.href,{method:"POST",headers:{authorization:"Bearer "+token,"content-type":"application/json"},body:JSON.stringify(['EVAL',RESERVE_LUA,keys.length,...keys,charge,budgetMicros,kind==="model"?totalRequests:100,kind==="model"?3:10]),redirect:"error",signal:AbortSignal.timeout(2000)});
  if(!response.ok)throw Error("QUOTA_UNAVAILABLE");
  const raw=await response.text();if(raw.length>2000)throw Error("QUOTA_UNAVAILABLE");
  const data=JSON.parse(raw);if(data.error||!codes.has(data.result))throw Error("QUOTA_UNAVAILABLE");
  return data.result;
 }};
}
