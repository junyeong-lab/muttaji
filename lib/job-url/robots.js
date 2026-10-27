import {ImportError} from "./errors.js";
// Conservative robots rules: an uncertain policy blocks collection. Specific
// crawler groups take precedence over '*'; longest Allow/Disallow match wins.
export function checkRobots(text,url){
  const groups=[];let group=null,hasRules=false;
  for(const raw of text.split(/\r?\n/)){
    const line=raw.replace(/#.*/,"").trim();if(!line)continue;
    const m=line.match(/^([\w-]+)\s*:\s*(.*)$/);if(!m)continue;
    const key=m[1].toLowerCase(),value=m[2].trim();
    if(key==="user-agent"){
      if(!group||hasRules){group={agents:[],rules:[]};groups.push(group);hasRules=false;}
      group.agents.push(value.toLowerCase());
    }else if(group&&(key==="disallow"||key==="allow")){
      hasRules=true;if(value)group.rules.push({allow:key==="allow",path:value});
    }
  }
  const specific=groups.filter(g=>g.agents.some(a=>a!=="*"&&"muttajijobimport".includes(a)));
  const selected=specific.length?specific:groups.filter(g=>g.agents.includes("*"));
  const path=url.pathname+url.search;
  const matches=[];
  for(const rule of selected.flatMap(g=>g.rules)){
    const end=rule.path.endsWith("$");
    const plain=end?rule.path.slice(0,-1):rule.path;
    const matchesPath=value=>globPrefix(plain,value,end);
    let decoded=path;try{decoded=decodeURI(path);}catch{}
    if(matchesPath(path)||matchesPath(decoded))matches.push({...rule,length:plain.replace(/\*/g,"").length});
  }
  matches.sort((a,b)=>b.length-a.length||Number(b.allow)-Number(a.allow));
  if(matches[0]&&!matches[0].allow)throw new ImportError("ROBOTS_DENIED");
}

function globPrefix(pattern,value,end){
 const parts=pattern.split("*");if(!value.startsWith(parts[0]))return false;
 if(parts.length===1)return !end||value===pattern;
 let cursor=parts[0].length;
 for(let i=1;i<parts.length;i++){
  if(i===parts.length-1&&end)return value.endsWith(parts[i])&&value.length-parts[i].length>=cursor;
  const found=value.indexOf(parts[i],cursor);if(found<0)return false;cursor=found+parts[i].length;
 }
 return true;
}
