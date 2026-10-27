/* Model-provider-neutral request preparation only. No fetch or state changes. */
(function(root,factory){const api=factory();if(typeof module==="object"&&module.exports)module.exports=api;if(root)root.MuttajiAgentInput=api;})(typeof globalThis!=="undefined"?globalThis:this,function(){
 "use strict";
 function prepare({posting,profile={},imported=null,consent=false,revision}){
  if(consent!==true)throw Error("EXTERNAL_AI_CONSENT_REQUIRED");
  if(typeof posting!=="string"||!posting.trim()||posting.length>20000||posting.split(/\r\n|\r|\n/).length>400)throw Error("INVALID_POSTING");
  if(typeof revision!=="string"||!/^[a-zA-Z0-9_-]{1,64}$/.test(revision))throw Error("INVALID_REVISION");
  let source={type:"manual"};
  if(imported){
   if(imported.reviewed!==true||imported.text!==posting.trim())throw Error("IMPORT_REVIEW_REQUIRED");
   const url=new URL(imported.sourceUrl);if(url.protocol!=="https:")throw Error("INVALID_SOURCE");
   source={type:"url",url:url.href,method:imported.method,edited:imported.edited===true,reviewed:true};
  }
  const fields=["goal-job","education","experience","certs","skills"];
  const user=Object.fromEntries(fields.map(key=>{const value=profile[key]??"";if(typeof value!=="string"||value.length>12000)throw Error("INVALID_PROFILE");return [key,value];}));
  return {schemaVersion:1,revision,posting:posting.trim(),profile:user,source,consent:{externalAi:true},
   policy:{inputIsUntrusted:true,preserveUserAssessments:true,requireEvidence:true,allowAutomaticVerdicts:false,allowHiringProbability:false}};
 }
 return {prepare};
});