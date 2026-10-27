import {AgentError} from "./contracts.js";
// No live branch or provider fallback exists in this implementation.
export function agentMode(env={}) {
  return env.MUTTAJI_AGENT_MODE==="mock"?"mock":"disabled";
}
export function requireMock(mode) {
  if(mode!=="mock") throw new AgentError("AGENT_DISABLED",503);
}
export function requireConsent(consent) {
  if(consent!==true) throw new AgentError("CONSENT_REQUIRED",400);
}
