import {parse,parseFragment} from "parse5";
import {ImportError} from "./errors.js";
const skip=new Set(["script","style","noscript","nav","footer","header","aside","form","button","svg","canvas","iframe","template"]);
const block=new Set(["p","div","section","article","main","h1","h2","h3","h4","h5","h6","li","ul","ol","tr","br"]);
const attr=(node,name)=>node.attrs?.find(x=>x.name===name)?.value||"";
function walk(root){
 const all=[],stack=[root];
 while(stack.length){const node=stack.pop();all.push(node);if(all.length>50000)throw new ImportError("TOO_LARGE");for(const child of [...node.childNodes||[]].reverse())stack.push(child);}
 return all;
}
function visibleText(root){
 const parts=[],stack=[{node:root,depth:0}];
 while(stack.length){
  const {node,end,depth}=stack.pop();if(depth>500)throw new ImportError("TOO_LARGE");
  if(end){parts.push("\n");continue;}
  if(node.nodeName==="#text"){parts.push(node.value);continue;}
  const tag=node.tagName;
  if(skip.has(tag)||/display\s*:\s*none|visibility\s*:\s*hidden/i.test(attr(node,"style"))||node.attrs?.some(x=>x.name==="hidden")||attr(node,"aria-hidden")==="true"
    ||["navigation","banner","contentinfo"].includes(attr(node,"role"))
    ||/(?:^|[\s_-])(?:advert|advertisement|related|recommend|footer|navigation|cookie|ads)(?:$|[\s_-])/i.test(attr(node,"class")))continue;
  if(block.has(tag)){parts.push("\n");stack.push({node,end:true,depth});}
  if(tag==="li")parts.push("- ");
  for(const child of [...node.childNodes||[]].reverse())stack.push({node:child,depth:depth+1});
 }
 return parts.join("").replace(/[\t \u00a0]+/g," ").split(/\r?\n/).map(x=>x.trim()).filter(Boolean).join("\n");
}
function preflight(html){
 if(typeof html!=="string"||Buffer.byteLength(html,"utf8")>1024*1024)throw new ImportError("TOO_LARGE");
 let depth=0,count=0;
 const voids=new Set(["area","base","br","col","embed","hr","img","input","link","meta","param","source","track","wbr"]);
 for(const match of html.matchAll(/<\/?([a-z][\w:-]*)\b[^>]*>/gi)){
  if(++count>12000)throw new ImportError("TOO_LARGE");
  if(match[0].startsWith("</"))depth=Math.max(0,depth-1);
  else if(!voids.has(match[1].toLowerCase())&&!match[0].endsWith("/>"))depth++;
  if(depth>300)throw new ImportError("TOO_LARGE");
 }
}
const clean=value=>{if(typeof value!=="string")return "";preflight(value);return visibleText(parseFragment(value)).trim();};
const fieldKeys=["company","department","role","responsibilities","required","preferred","location","deadline","extras","skills"];
const headings={company:"기업명",department:"모집 부서",role:"모집 직무",responsibilities:"담당업무",required:"필수 자격요건",preferred:"우대사항",location:"근무지",deadline:"모집기간 및 마감일",extras:"기타 참고사항",skills:"기술 및 지식(원문)"};
export function extractPosting(html,sourceUrl){
 preflight(html);
 const tree=parse(html,{sourceCodeLocationInfo:true}),nodes=walk(tree);
 const title=visibleText(nodes.find(x=>x.tagName==="title")||{childNodes:[]});
 if(/captcha|just a moment|access denied|자동.*접근.*차단|접근.*차단/i.test(title)
   ||nodes.some(x=>["challenge-form","cf-challenge-running","captcha-form"].includes(attr(x,"id"))))throw new ImportError("BOT_CHALLENGE");
 const jobs=[];
 for(const [index,node] of nodes.filter(x=>x.tagName==="script"&&attr(x,"type").toLowerCase()==="application/ld+json").entries()){
  let value;try{value=JSON.parse(node.childNodes?.map(x=>x.value||"").join("")||"");}catch{continue;}
  const pending=[{value,path:"$"}];let seen=0;
  while(pending.length){
   if(++seen>3000)throw new ImportError("TOO_LARGE");
   const {value:entry,path}=pending.pop();
   if(!entry||typeof entry!=="object")continue;
   if(Array.isArray(entry)){entry.forEach((v,i)=>pending.push({value:v,path:path+"["+i+"]"}));continue;}
   const types=Array.isArray(entry["@type"])?entry["@type"]:[entry["@type"]];
   if(types.some(x=>typeof x==="string"&&/(?:^|[/#])JobPosting$/.test(x)))jobs.push({value:entry,locator:"jsonld["+index+"]"+path});
   for(const [key,v] of Object.entries(entry))if(v&&typeof v==="object")pending.push({value:v,path:path+"."+key});
  }
 }
 const unique=[...new Map(jobs.map(x=>[JSON.stringify([x.value.title,x.value.description,x.value.hiringOrganization]),x])).values()];
 if(unique.length>1)throw new ImportError("MULTIPLE_POSTINGS");
 const fields=Object.fromEntries(fieldKeys.map(key=>[key,[]]));
 const add=(key,value,locator)=>{
  const text=clean(value);if(!text)return;
  fields[key].push({value:text,evidence:{quote:text,locator,sourceUrl}});
 };
 let text="",method;
 if(unique.length){
  method="jsonld";const {value:job,locator}=unique[0];
  add("company",typeof job.hiringOrganization==="string"?job.hiringOrganization:job.hiringOrganization?.name,locator+".hiringOrganization.name");
  add("role",job.title,locator+".title");
  add("department",typeof job.hiringOrganization?.department==="string"?job.hiringOrganization.department:job.hiringOrganization?.department?.name,locator+".hiringOrganization.department");
  for(const [key,property] of [["responsibilities","responsibilities"],["required","qualifications"],["preferred","preferredQualifications"],["skills","skills"],["extras","employmentType"]]){
   const values=Array.isArray(job[property])?job[property]:[job[property]];for(const value of values)add(key,value,locator+"."+property);
  }
  for(const [property,label] of [["datePosted","게시일"],["validThrough","마감일"]])if(typeof job[property]==="string")add("deadline",label+": "+job[property],locator+"."+property);
  const locations=Array.isArray(job.jobLocation)?job.jobLocation:[job.jobLocation];
  for(const location of locations){
   const address=location?.address;
   const value=typeof address==="string"?address:address&&[address.addressCountry?.name||address.addressCountry,address.addressRegion,address.addressLocality,address.streetAddress].filter(x=>typeof x==="string").join(" ");
   add("location",value,locator+".jobLocation.address");
  }
  const description=clean(job.description);
  if(description.length<60&&!fields.responsibilities.length&&!fields.required.length&&!fields.preferred.length)
   throw new ImportError("PARTIAL_POSTING");
  const chunks=[];
  for(const key of ["company","department","role","location","deadline"])
   for(const entry of fields[key])chunks.push(headings[key]+": "+entry.value);
  if(description)chunks.push(description);
  for(const key of ["responsibilities","required","preferred","skills","extras"]){
   const values=fields[key].filter(entry=>!description.includes(entry.value));
   if(values.length)chunks.push((["skills","extras"].includes(key)?"기타\n":"")+headings[key]+"\n"+values.map(x=>x.value).join("\n"));
  }
  text=chunks.join("\n\n");
  if(description)fields.extras.push({value:description,evidence:{quote:description,locator:locator+".description",sourceUrl}});
 }else{
  if(/로그인|sign[ -]?in|log[ -]?in/i.test(title))throw new ImportError("LOGIN_REQUIRED");
  const candidates=nodes.filter(node=>["article","main"].includes(node.tagName)||/(?:job[_-]?(?:description|detail|view)|recruit[_-]?(?:detail|view)|user_content|dev-template-v2-root|artReadJobSum)/i.test(attr(node,"id")+" "+attr(node,"class")));
  const scored=candidates.map(node=>({node,text:visibleText(node)})).filter(x=>x.text.length>=60&&/담당\s*업무|자격\s*요건|필수|우대|responsibilities|qualifications|requirements/i.test(x.text));
  // Prefer the smallest job-specific container, not an enclosing document.
  const leaves=scored.filter(a=>!scored.some(b=>{
   if(a===b)return false;let node=b.node.parentNode;
   while(node){if(node===a.node)return true;node=node.parentNode;}return false;
  }));
  if(new Set(leaves.map(x=>x.text)).size>1)throw new ImportError("MULTIPLE_POSTINGS");
  scored.sort((a,b)=>a.text.length-b.text.length);
  if(!scored.length){
   const imageBody=nodes.find(node=>attr(node,"id")==="detail-content");
   if(imageBody&&visibleText(imageBody).length<60&&walk(imageBody).some(node=>node.tagName==="img"&&attr(node,"src")))throw new ImportError("IMAGE_POSTING");
   throw new ImportError("NO_POSTING");
  }
  const candidate=scored[0];text=candidate.text;method="html-body";
  const locator=candidate.node.tagName+(attr(candidate.node,"id")?"#"+attr(candidate.node,"id"):"")+"@"+(candidate.node.sourceCodeLocation?.startOffset??0);
  fields.extras.push({value:text,evidence:{quote:text,locator,sourceUrl}});
  const labels={company:/^(?:기업명|회사명)\s*[:：]\s*(.+)$/,role:/^(?:모집\s*직무|직무명|모집분야)\s*[:：]\s*(.+)$/,department:/^(?:모집\s*부서|담당\s*부서)\s*[:：]\s*(.+)$/,location:/^(?:근무지|근무지역)\s*[:：]\s*(.+)$/,deadline:/^(?:마감일|모집기간|접수기간)\s*[:：]\s*(.+)$/};
  for(const line of text.split("\n"))for(const [key,pattern] of Object.entries(labels)){const match=line.replace(/^[\s•ㆍ-]+/," ").trim().match(pattern);if(match)add(key,match[1],locator);}
 }
 // Recognize explicit headings only; ambiguous language remains in the text
 // for the existing parser/user to review, rather than being guessed here.
 const groups={responsibilities:/^(?:담당\s*업무|주요\s*업무|주요역할 및 수행업무|responsibilities)$/i,skills:/^(?:스킬|기술\s*(?:및\s*)?(?:지식|스킬)(?:\s*\(원문\))?|기술\s*스택|skill[s]?|tech\s*stack)$/i,required:/^(?:필수(?:\s*(?:조건|요건|사항))?|(?:공통)?자격\s*요건|지원\s*자격|requirements|qualifications)$/i,preferred:/^(?:우대(?:\s*(?:사항|조건|요건))?|preferred)$/i};
 const collected={responsibilities:[],skills:[],required:[],preferred:[]};let active=null;
 text.split("\n").forEach((line,index)=>{
  const heading=line.replace(/^[^\p{L}\p{N}]+/u,"").replace(/^[\[【(]+|[\]】):：]+$/g,"").trim();
  const next=Object.entries(groups).find(([,pattern])=>pattern.test(heading));
  if(next){active=next[0];return;}
  if(/^(?:기업명|모집|근무|접수|마감|기타|복리|기술|채용절차|유의사항)/.test(heading)){active=null;return;}
  if(active&&line.trim())collected[active].push({value:line,evidence:{quote:line,locator:(method==="jsonld"?unique[0].locator+".description":"html-body")+":text-line:"+(index+1),sourceUrl}});
 });
 for(const key of Object.keys(collected))if(!fields[key].length)fields[key]=collected[key];
 if(text.length>20000||text.split("\n").length>400)throw new ImportError("EXTRACT_TOO_LONG");
 if(text.length<40)throw new ImportError("NO_POSTING");
 const contentStatus=!fields.responsibilities.length&&!fields.required.length&&!fields.preferred.length&&text.length<800?"partial":"body";
 return {schemaVersion:1,sourceUrl,method,contentStatus,reviewRequired:true,fields,text,
  warnings:["추출한 내용은 적용 전에 확인·수정해 주세요.","페이지에 없는 정보는 채우지 않았습니다."],
  analysisInput:{schemaVersion:1,postingText:text,source:{url:sourceUrl,method,reviewed:false},untrusted:true,aiEnabled:false}};
}