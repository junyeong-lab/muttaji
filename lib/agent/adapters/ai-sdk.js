import {safeProviderError} from "../provider-errors.js";
import {generateText,Output,jsonSchema} from "ai";
import {schemaForRequest} from "../model-schema.js";
// A model object is injected by the server, never chosen by browser data.
export function createSdkAdapter({model,run=generateText,providerOptions={}}){
 return {async analyze({request,requirements,catalog,instructions},{signal}){
  try{
  const result=await run({model,output:Output.object({schema:jsonSchema(schemaForRequest({request,requirements,catalog}))}),
   system:[...instructions,"한국어로 간결하고 실용적으로 설명하세요. 출장 가능 등 사용자가 직접 밝힌 의사는 받아들이고 불필요한 추가 질문을 만들지 마세요.","예정·학습·실무 경험을 구분하고, 현재 역량과 다음 준비 행동을 연결하세요. 각 요건당 핵심 행동은 최대 3개로 제안하세요."].join("\n"),
   prompt:JSON.stringify({untrustedData:{posting:request.posting,profile:request.profile,requirements,catalog},responseContract:{schemaVersion:1,revision:request.revision,mode:"model-suggestion",needsHumanReview:true}}),
   maxOutputTokens:4096,maxRetries:0,abortSignal:signal,providerOptions,
   experimental_telemetry:{isEnabled:false}});
  return result.output;
  }catch(error){throw safeProviderError(error);}
 }};
}
