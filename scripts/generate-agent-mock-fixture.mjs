// Generate only the public fictional fixture. Does not read env or personal data.
import {writeFile} from "node:fs/promises";
import {mockExample} from "../lib/agent/adapters/mock.js";
import {analyzeAgent} from "../lib/agent/service.js";
const input=mockExample();
const output=await analyzeAgent({mode:"mock",consent:true,input});
await writeFile(new URL("../data/agent-mock-example.json",import.meta.url),JSON.stringify({input,output},null,2)+"\n");
