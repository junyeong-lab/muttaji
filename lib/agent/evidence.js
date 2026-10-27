import {createHash} from "node:crypto";
import {exactKeys,PROFILE_FIELDS} from "./contracts.js";
const digest=value=>createHash("sha256").update(value).digest("hex");
export function makeReference(input,source,field,start,end) {
  const text=source==="posting"?input.posting:input.profile[field];
  const quote=text.slice(start,end);
  // Full source hash prevents reuse after even an unrelated edit to that field.
  const id="ev-"+digest(JSON.stringify([source,field,digest(text),start,end,quote]));
  return {id,source,field,start,end,quote};
}
export function verifyReference(ref,input,expectedSource) {
  if(!exactKeys(ref,["id","source","field","start","end","quote"]) || ref.source!==expectedSource) return false;
  if(ref.source==="posting"?ref.field!=="posting":!PROFILE_FIELDS.includes(ref.field)) return false;
  const text=ref.source==="posting"?input.posting:input.profile[ref.field];
  if(!Number.isInteger(ref.start)||!Number.isInteger(ref.end)||ref.start<0||ref.end<=ref.start||ref.end>text.length
    || typeof ref.quote!=="string" || !ref.quote.trim() || ref.quote.length>1000) return false;
  const actual=makeReference(input,ref.source,ref.field,ref.start,ref.end);
  return ref.quote===actual.quote && ref.id===actual.id;
}
export const requirementId=ref=>"req-"+digest(ref.id);
// Quoting requires explicit offsets; repeated phrases are not resolved by guess.
export function quoteAt(input,source,field,quote,start) {
  const ref=makeReference(input,source,field,start,start+quote.length);
  if(ref.quote!==quote || !verifyReference(ref,input,source)) throw new TypeError("Invalid evidence location");
  return ref;
}
