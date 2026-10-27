import {NoObjectGeneratedError,NoOutputGeneratedError} from "ai";
import {AgentError} from "./contracts.js";
// Inspect only status / allowlisted machine codes. Never expose provider bodies.
export const providerCodes=Object.freeze(["PROVIDER_AUTH","PROVIDER_QUOTA","PROVIDER_RATE_LIMIT","PROVIDER_MODEL_UNAVAILABLE","PROVIDER_BAD_REQUEST","PROVIDER_UNAVAILABLE","PROVIDER_OUTPUT_LIMIT","PROVIDER_OUTPUT_INVALID","PROVIDER_NO_OUTPUT","PROVIDER_REQUEST_TOO_LARGE"]);
export function safeProviderError(error){
 if(error instanceof AgentError && error.code==="PROVIDER_REQUEST_TOO_LARGE")return error;
 if(NoObjectGeneratedError.isInstance(error))return new AgentError(error.finishReason==="length"?"PROVIDER_OUTPUT_LIMIT":"PROVIDER_OUTPUT_INVALID",502);
 if(NoOutputGeneratedError.isInstance(error))return new AgentError("PROVIDER_NO_OUTPUT",502);
 let data=error?.data;
 if(!data&&typeof error?.responseBody==="string"&&error.responseBody.length<64000){try{data=JSON.parse(error.responseBody);}catch{}}
 const code=data?.error?.code;
 let safe;
 if(error?.statusCode===401)safe="PROVIDER_AUTH";
 else if(["insufficient_quota","billing_hard_limit_reached","credit_balance_exhausted","organization_spend_limit_exceeded","project_spend_limit_exceeded","organization_usage_limit_exceeded"].includes(code))safe="PROVIDER_QUOTA";
 else if(code==="model_not_found"||error?.statusCode===403||error?.statusCode===404)safe="PROVIDER_MODEL_UNAVAILABLE";
 else if(error?.statusCode===429)safe="PROVIDER_RATE_LIMIT";
 else if(error?.statusCode===400||error?.statusCode===422)safe="PROVIDER_BAD_REQUEST";
 else if(error?.statusCode>=500)safe="PROVIDER_UNAVAILABLE";
 return new AgentError(safe||"ADAPTER_FAILED",502);
}
