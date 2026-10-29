import {safeProviderError} from "../provider-errors.js";
import {generateText,Output,jsonSchema} from "ai";
import {schemaForRequest} from "../model-schema.js";
import {validateAnalysisContext} from "../semantic-analysis.js";
// A model object is injected by the server, never chosen by browser data.
export function createSdkAdapter({model,run=generateText,providerOptions={}}){
 return {async analyze({request,requirements,catalog,instructions},{signal}){
  try{
  const result=await run({model,output:Output.object({schema:jsonSchema(schemaForRequest({request,requirements,catalog,semantic:true}))}),
   system:[...instructions,"한국어로 간결하고 실용적으로 설명하세요. 출장 가능 등 사용자가 직접 밝힌 의사는 받아들이고 불필요한 추가 질문을 만들지 마세요.","예정·학습·실무 경험을 구분하고, 현재 역량과 다음 준비 행동을 연결하세요. 각 요건당 핵심 행동은 최대 3개로 제안하세요.","출력 한도는 4096 토큰입니다. 요건이 많아도 모든 ID를 포함한 JSON을 완성하도록 요건당 설명과 이유는 각각 한 문장, 경험 인용은 가장 짧은 정확한 원문 1개, 보완점과 행동은 각각 최대 1개로 간결하게 작성하세요. 불필요한 keySkills와 certifications는 빈 배열로 두세요."].join("\n"),
   prompt:JSON.stringify({untrustedData:{posting:request.posting,profile:request.profile,requirements,catalog,analysisContext:validateAnalysisContext(request.analysisContext)},responseContract:{schemaVersion:1,revision:request.revision,mode:"model-suggestion",needsHumanReview:true}}),
   maxOutputTokens:4096,maxRetries:0,abortSignal:signal,providerOptions,
   experimental_telemetry:{isEnabled:false}});
  // JSON Schema hints alone are not an evidence validator. Mark a missing new
  // contract explicitly invalid, while legacy injected adapters remain supported.
  if(Array.isArray(result.output?.items))return {...result.output,items:result.output.items.map(item=>({...item,semantics:item.semantics??null}))};
  return result.output;
  }catch(error){throw safeProviderError(error);}
 }};
}
