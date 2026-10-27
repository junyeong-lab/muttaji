// Provider-neutral, versioned contracts. No credentials, storage or network.
export const PROFILE_FIELDS = Object.freeze(["goalJob", "education", "experience", "certificates", "skills"]);
export const LIMITS = Object.freeze({bodyBytes:64000, posting:8000, lines:400, profileField:2000});
export class AgentError extends Error {
  constructor(code, status=400) { super(code); this.code=code; this.status=status; }
}
export function exactKeys(value, keys) {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    && Object.keys(value).length === keys.length
    && keys.every(key=>Object.hasOwn(value,key));
}
export function validateInput(value) {
  if(!exactKeys(value,["schemaVersion","revision","posting","profile"]) || value.schemaVersion!==1)
    throw new AgentError("INVALID_INPUT");
  if(typeof value.revision!=="string" || !/^[a-zA-Z0-9_-]{1,64}$/.test(value.revision))
    throw new AgentError("INVALID_REVISION");
  if(typeof value.posting!=="string" || value.posting.trim().length<20 || value.posting.length>LIMITS.posting
    || value.posting.split(/\r\n|\r|\n/).length>LIMITS.lines) throw new AgentError("INVALID_POSTING");
  if(!exactKeys(value.profile,PROFILE_FIELDS) || PROFILE_FIELDS.some(key=>
    typeof value.profile[key]!=="string" || value.profile[key].length>LIMITS.profileField))
    throw new AgentError("INVALID_PROFILE");
  // Copy only known fields; never trim/normalize evidence-bearing strings.
  return {schemaVersion:1,revision:value.revision,posting:value.posting,
    profile:Object.fromEntries(PROFILE_FIELDS.map(key=>[key,value.profile[key]]))};
}
const shortText = value=>typeof value==="string" && value.trim().length>0 && value.length<=1000;
const textList = value=>Array.isArray(value) && value.length<=8 && value.every(shortText);
export function validateOutput(value,input,verifyReference) {
  const fail=()=>{throw new AgentError("INVALID_AGENT_OUTPUT",502);};
  if(!exactKeys(value,["schemaVersion","revision","mode","label","needsHumanReview","requirements"])
    || value.schemaVersion!==1 || value.revision!==input.revision || value.mode!=="mock"
    || value.label!=="모의 결과 · 실제 AI 분석 아님" || value.needsHumanReview!==true
    || !Array.isArray(value.requirements) || !value.requirements.length || value.requirements.length>40) fail();
  const ids=new Set();
  for(const item of value.requirements) {
    if(!exactKeys(item,["id","category","interpretation","importance","postingEvidence","profileEvidence","relation","uncertainties","nextActions"])
      || typeof item.id!=="string" || !/^req-[a-f0-9]{64}$/.test(item.id) || ids.has(item.id)
      || !["required","preferred","unresolved"].includes(item.category)
      || !shortText(item.interpretation) || !shortText(item.importance)
      || !["related","not-stated","explicit-gap"].includes(item.relation)
      || !textList(item.uncertainties) || !item.uncertainties.length
      || !textList(item.nextActions) || !item.nextActions.length) fail();
    ids.add(item.id);
    for(const [key,source] of [["postingEvidence","posting"],["profileEvidence","profile"]]) {
      const refs=item[key];
      if(!Array.isArray(refs) || refs.length>8 || (key==="postingEvidence"&&!refs.length)) fail();
      for(const ref of refs) if(!verifyReference(ref,input,source)) fail();
      if(new Set(refs.map(ref=>ref.id)).size!==refs.length) fail();
    }
    // Missing information is never evidence of a gap; related/gap claims need
    // an actual user-input citation. Neither relation is a final verdict.
    if(item.relation==="not-stated" ? item.profileEvidence.length!==0 : item.profileEvidence.length===0) fail();
  }
  return value;
}
