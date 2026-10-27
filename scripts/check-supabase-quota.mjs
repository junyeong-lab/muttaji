// No AI call. Disabled namespace returns without reserving budget/counters.
import {randomBytes} from "node:crypto";
import {createSupabaseQuota} from "../lib/public/supabase-quota.js";
try{
 if(!process.env.MUTTAJI_SUPABASE_URL||!process.env.MUTTAJI_SUPABASE_SECRET_KEY)throw Error("SUPABASE_SETTINGS_MISSING");
 const quota=createSupabaseQuota({url:process.env.MUTTAJI_SUPABASE_URL,secret:process.env.MUTTAJI_SUPABASE_SECRET_KEY,namespace:"connection-check"});
 const status=await quota.reserve({kind:"model",subject:randomBytes(24).toString("hex"),session:randomBytes(24).toString("hex")});
 console.log(status==="NOT_INITIALIZED"?"SUPABASE_RPC_CONNECTED: server authentication verified; AI not called; no budget reserved.":"SUPABASE_UNEXPECTED_STATE");
 if(status!=="NOT_INITIALIZED")process.exitCode=1;
}catch(error){
 const messages={
  SUPABASE_SETTINGS_MISSING:"Server URL or secret key is not set in this PowerShell session.",
  INVALID_QUOTA_CONFIG:"Check the Supabase URL and whether the full server key was entered.",
  INVALID_QUOTA_KEY:"Use a server sb_secret key or service_role key, not publishable/anon/OpenAI keys.",
  SUPABASE_AUTH_FAILED:"Supabase rejected the key. Check that it belongs to the muttaji project and is active.",
  SUPABASE_PERMISSION_DENIED:"The key cannot execute the server quota function.",
  SUPABASE_RPC_NOT_FOUND:"Check project URL, RPC deployment and Data API schema cache.",
  SUPABASE_TIMEOUT:"Connection timed out. No automatic retry or AI call was made.",
  SUPABASE_NETWORK_FAILED:"Could not connect to Supabase. Check network/DNS availability.",
  SUPABASE_RATE_LIMITED:"Supabase request limit reached. No AI call was made.",
  SUPABASE_SERVER_ERROR:"Supabase returned a server error. No AI call was made.",
  SUPABASE_INVALID_RESPONSE:"Supabase returned an unexpected response. No AI call was made."
 };
 const code=Object.hasOwn(messages,error?.diagnostic)?error.diagnostic:Object.hasOwn(messages,error?.message)?error.message:"SUPABASE_CONNECTION_FAILED";
 console.log(code+": "+(messages[code]||"Connection check failed. No key or provider details are logged."));process.exitCode=1;
}
