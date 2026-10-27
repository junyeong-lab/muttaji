import {AgentError,validateInput,validateOutput} from "./contracts.js";
import {verifyReference,requirementId} from "./evidence.js";
import {requireMock,requireConsent} from "./policy.js";
import {mockAdapter,isMockExample} from "./adapters/mock.js";
// Adapter injection is internal only, never selected by request data.
export async function analyzeAgent({mode,consent,input},adapter=mockAdapter,{timeoutMs=2000}={}) {
  requireMock(mode);
  requireConsent(consent);
  const validated=validateInput(input);
  if(!isMockExample(validated)) throw new AgentError("MOCK_FIXTURE_ONLY",422);
  // Retain our own source snapshot even if a future adapter mutates its input.
  const source=structuredClone(validated);
  let result,timer;
  const controller=new AbortController();
  try {
    result=await Promise.race([
      Promise.resolve().then(()=>adapter.analyze(structuredClone(validated),{signal:controller.signal})),
      new Promise((resolve,reject)=>{timer=setTimeout(()=>{
        controller.abort();reject(new AgentError("ADAPTER_TIMEOUT",504));
      },timeoutMs);})
    ]);
  }
  catch(error) {
    if(controller.signal.aborted) throw new AgentError("ADAPTER_TIMEOUT",504);
    throw new AgentError("ADAPTER_FAILED",502);
  } finally {clearTimeout(timer);}
  const output=validateOutput(result,source,verifyReference);
  if(output.requirements.some(item=>item.id!==requirementId(item.postingEvidence[0])))
    throw new AgentError("INVALID_AGENT_OUTPUT",502);
  return output;
}
