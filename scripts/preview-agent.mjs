// Local preview; paid model calls require separate explicit server opt-in.
import {createModelHandler} from "../lib/agent/model-api.js";
import {localModelSettings,createLocalAdapter} from "../lib/agent/local-model.js";
import {createServer} from "node:http";
import {readFile} from "node:fs/promises";
import {createImporter} from "../lib/job-url/service.js";
import {createImportHandler} from "../lib/job-url/api.js";
import {extractPosting} from "../lib/job-url/extract.js";
import {validateUrl} from "../lib/job-url/policy.js";
import {ImportError} from "../lib/job-url/errors.js";
const root=new URL("../",import.meta.url);
const requestedPort=process.argv[2]===undefined?4173:Number(process.argv[2]);
if(!Number.isInteger(requestedPort)||requestedPort<0||requestedPort>65535)throw Error("Port must be an integer from 0 to 65535");
const types={".html":"text/html; charset=utf-8",".js":"text/javascript; charset=utf-8",".json":"application/json; charset=utf-8",".webp":"image/webp"};
const mockHtml=await readFile(new URL("../tests/fixtures/job-url/structured.html",import.meta.url),"utf8");
const liveUrls=process.argv.includes("--live-url");
const urlHandler=createImportHandler({config:()=>({mode:liveUrls?"local":"mock",ownerApproved:liveUrls,token:"local-demo-code"}),importer:liveUrls?createImporter():async value=>{
 const url=validateUrl(value);if(url.href!=="https://jobs.example.org/demo/security")throw new ImportError("IMPORT_DISABLED",503);
 return extractPosting(mockHtml,url.href);
}});
const aiSettings=localModelSettings(process.env);
const catalog=JSON.parse(await readFile(new URL("../data/certifications.json",import.meta.url),"utf8")).certifications.map(x=>({id:String(x.id),name:x.name}));
const modelHandler=createModelHandler({config:()=>aiSettings,adapter:createLocalAdapter(process.env),catalog,maxCalls:process.argv.includes("--ai-one-shot")?1:3});
const server=createServer(async(req,res)=>{
  const path=new URL(req.url,"http://localhost").pathname;
  res.setHeader("cache-control","no-store");res.setHeader("x-content-type-options","nosniff");
  if(path==="/api/model-analysis"){
    const chunks=[];let size=0;const timeout=setTimeout(()=>req.destroy(),5000);
    try{
      for await(const chunk of req){size+=chunk.length;if(size>32000){res.writeHead(413);res.end();return;}chunks.push(chunk);}
    }catch{res.destroy();return;}finally{clearTimeout(timeout);}
    const request=new Request("http://"+req.headers.host+path,{method:req.method,headers:req.headers,...(!["GET","HEAD"].includes(req.method)?{body:Buffer.concat(chunks)}:{})});
    const response=await modelHandler(request);res.writeHead(response.status,Object.fromEntries(response.headers));res.end(await response.text());return;
  }
  if(path==="/api/job-url-import"){
    const chunks=[];let size=0;
    for await(const chunk of req){size+=chunk.length;if(size>6000){res.writeHead(413);res.end();return;}chunks.push(chunk);}
    const request=new Request("http://"+req.headers.host+path,{method:req.method,headers:req.headers,...(req.method!=="GET"&&req.method!=="HEAD"?{body:Buffer.concat(chunks)}:{})});
    const response=await urlHandler(request);res.writeHead(response.status,Object.fromEntries(response.headers));res.end(await response.text());return;
  }
  if(path==="/api/analyze"||path==="/api/agent-analyze"){
    res.setHeader("content-type",types[".json"]);
    res.statusCode=req.method==="GET"?200:503;
    res.end(JSON.stringify(req.method==="GET"?{enabled:false,mode:"disabled"}:{error:"PREVIEW_AI_DISABLED"}));return;
  }
  if(req.method!=="GET"&&req.method!=="HEAD"){res.writeHead(405);res.end();return;}
  const file=path==="/"?"/index.html":path;
  const allowed=file==="/index.html"||/^\/assets\/[a-z0-9-]+\.(?:js|webp)$/.test(file)
    ||/^\/data\/(?:certifications|agent-mock-example)\.json$/.test(file)||file==="/lib/agent/contracts.js";
  if(!allowed){res.writeHead(404);res.end();return;}
  try {
    const data=await readFile(new URL(file.slice(1),root));
    res.setHeader("content-type",types[file.slice(file.lastIndexOf("."))]);
    res.end(req.method==="HEAD"?undefined:data);
  } catch {res.writeHead(404);res.end();}
});
server.on("error",error=>{
  console.error(error.code==="EADDRINUSE"?"Port in use. Run: node scripts/preview-agent.mjs 0":"Local preview could not start: "+error.code);
  process.exitCode=1;
});
server.listen(requestedPort,"127.0.0.1",()=>console.log("Local preview: http://127.0.0.1:"+server.address().port+"/#analyze"));
