import {isIP} from "node:net";
import {lookup} from "node:dns/promises";
import ipaddr from "ipaddr.js";
import {ImportError} from "./errors.js";
export const LIMITS=Object.freeze({bytes:1024*1024,robotsBytes:64000,timeoutMs:10000,redirects:3,inputBytes:6000});
export function validateUrl(value){
  if(typeof value!=="string"||value.length>2048||value!==value.trim()||/[\u0000-\u0020\\]/.test(value))throw new ImportError("INVALID_URL",400);
  let url;try{url=new URL(value);}catch{throw new ImportError("INVALID_URL",400);}
  if(url.protocol!=="https:"||url.username||url.password||(url.port&&url.port!=="443"))throw new ImportError("UNSAFE_URL",400);
  const host=url.hostname.toLowerCase();
  if(isIP(host.replace(/^\[|\]$/g,""))||!host.includes(".")||host.endsWith(".")
    ||/(?:^|\.)(?:localhost|local|internal|invalid|test|onion|home|lan)$/.test(host)
    ||host==="metadata.google.internal"||host==="metadata.azure.internal")throw new ImportError("UNSAFE_URL",400);
  for(const key of url.searchParams.keys())if(/^(?:access[_-]?token|token|authorization|api[_-]?key|password|session(?:id)?|sig|signature|x-amz-.+|x-goog-.+)$/i.test(key))throw new ImportError("UNSAFE_URL",400);
  url.hash="";return url;
}
export function publicAddress(address){
  if(!isIP(address)||address==="168.63.129.16")return false;
  // Only native global-unicast IPv6 is accepted; mapped/tunnel/NAT64 ranges
  // are excluded rather than interpreted as alternative routes to IPv4.
  try{return ipaddr.parse(address).range()==="unicast";}catch{return false;}
}
export async function abortable(promise,signal){
  if(signal.aborted)throw new ImportError("TIMEOUT",504);
  let listener;
  try{return await Promise.race([promise,new Promise((_,reject)=>{
    listener=()=>reject(new ImportError("TIMEOUT",504));signal.addEventListener("abort",listener,{once:true});
  })]);}finally{signal.removeEventListener("abort",listener);}
}
export async function resolvePublic(url,signal,resolver=lookup){
  let answers;
  try{answers=await abortable(resolver(url.hostname,{all:true,verbatim:true}),signal);}
  catch(error){if(error instanceof ImportError)throw error;throw new ImportError("DNS_FAILED");}
  if(!Array.isArray(answers)||!answers.length||answers.length>32||answers.some(x=>!publicAddress(x.address)))throw new ImportError("UNSAFE_DNS");
  const selected=answers.find(x=>isIP(x.address)===4)||answers[0];
  return {address:selected.address,family:isIP(selected.address)};
}