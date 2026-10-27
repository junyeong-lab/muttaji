// Explicit developer smoke check only. No model call, cookie, profile or body log.
import {createImporter} from "../lib/job-url/service.js";
const importer=createImporter();
const urls=process.argv.slice(2);
if(!urls.length){console.log("Usage: node scripts/check-job-urls.mjs https://public-job-url");process.exit(0);}
const results=await Promise.all(urls.map(async url=>{
 let host;try{host=new URL(url).hostname;}catch{host="invalid";}
 try{const value=await importer(url);return {host,result:value.contentStatus==="partial"?"partial":"extracted",method:value.method,characters:value.text.length,fields:Object.fromEntries(Object.entries(value.fields).map(([key,list])=>[key,list.length]))};}
 catch(error){return {host,result:"not-extracted",code:error.code||"FETCH_FAILED"};}
}));
console.log(JSON.stringify(results,null,2));