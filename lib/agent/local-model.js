import {createOpenAI} from "@ai-sdk/openai";
import {createSdkAdapter} from "./adapters/ai-sdk.js";
// Explicit opt-in local test only. No env files or settings are written here.
export function localModelSettings(env){
 const enabled=env.MUTTAJI_AI_ENABLED==="true"&&env.MUTTAJI_AI_OWNER_APPROVED==="true"&&Boolean(env.OPENAI_API_KEY)&&
  typeof env.MUTTAJI_AI_MODEL==="string"&&/^[a-z0-9.-]{1,80}$/.test(env.MUTTAJI_AI_MODEL)&&typeof env.MUTTAJI_AI_ACCESS_CODE==="string"&&env.MUTTAJI_AI_ACCESS_CODE.length>=16;
 return {enabled,model:enabled?env.MUTTAJI_AI_MODEL:null,token:env.MUTTAJI_AI_ACCESS_CODE};
}
export function createLocalAdapter(env){
 const settings=localModelSettings(env);if(!settings.enabled)return undefined;
 const provider=createOpenAI({apiKey:env.OPENAI_API_KEY,baseURL:"https://api.openai.com/v1"});
 return createSdkAdapter({model:provider.responses(settings.model),providerOptions:{openai:{store:false,reasoningEffort:"low",reasoningSummary:null}}});
}
