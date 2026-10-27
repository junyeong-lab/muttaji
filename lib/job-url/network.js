import https from "node:https";
import ipaddr from "ipaddr.js";
import {ImportError} from "./errors.js";
// A fresh TLS connection uses the already-validated IP. No second DNS lookup,
// cookie jar, browser, proxy, redirect-following, decompression or script runner.
export function pinnedRequest(url,target,{signal,maxBytes,kind="html"},request=https.request){
  return new Promise((resolve,reject)=>{
    let done=false;
    const fail=error=>{if(!done){done=true;reject(error instanceof ImportError?error:new ImportError(signal.aborted?"TIMEOUT":"FETCH_FAILED",signal.aborted?504:422));}};
    const req=request(url,{
      method:"GET",agent:false,servername:url.hostname,autoSelectFamily:false,signal,
      headers:{"user-agent":"MuttajiJobImport/0.1","accept":kind==="robots"?"text/plain":"text/html,application/xhtml+xml","accept-encoding":"identity"},
      lookup(_hostname,options,callback){
        if(typeof options==="function")callback=options;
        if(options?.all)callback(null,[target]);else callback(null,target.address,target.family);
      }
    },res=>{
      const status=res.statusCode||0;
      if(status>=300&&status<400){res.destroy();done=true;resolve({status,headers:res.headers,body:""});return;}
      if(status!==200){res.destroy();done=true;resolve({status,headers:res.headers,body:""});return;}
      const mime=String(res.headers["content-type"]||"");
      const valid=kind==="robots"?/^text\/plain(?:\s*;|$)/i.test(mime):/^(?:text\/html|application\/xhtml\+xml)(?:\s*;|$)/i.test(mime);
      if(!valid){fail(new ImportError("INVALID_CONTENT_TYPE"));res.destroy();return;}
      if(res.headers["content-encoding"]&&!/^identity$/i.test(res.headers["content-encoding"])){fail(new ImportError("UNSUPPORTED_ENCODING"));res.destroy();return;}
      const length=res.headers["content-length"];
      if(length!==undefined&&(!/^\d+$/.test(String(length))||Number(length)>maxBytes)){fail(new ImportError("TOO_LARGE"));res.destroy();return;}
      const chunks=[];let count=0;
      res.on("data",chunk=>{count+=chunk.length;if(count>maxBytes){fail(new ImportError("TOO_LARGE"));res.destroy();}else chunks.push(chunk);});
      res.on("aborted",()=>fail(new ImportError("FETCH_FAILED")));res.on("error",fail);
      res.on("end",()=>{
        if(done)return;
        let body;try{
          const bytes=Buffer.concat(chunks);
          const match=mime.match(/charset\s*=\s*["']?([\w-]+)/i);
          body=new TextDecoder(match?.[1]||"utf-8",{fatal:true}).decode(bytes);
        }catch{fail(new ImportError("UNSUPPORTED_ENCODING"));return;}
        done=true;resolve({status,headers:res.headers,body});
      });
    });
    req.on("socket",socket=>socket.once("secureConnect",()=>{
      try{
        const remote=ipaddr.process(socket.remoteAddress).toString();
        if(remote!==ipaddr.process(target.address).toString())req.destroy(new ImportError("UNSAFE_DNS"));
      }catch{req.destroy(new ImportError("UNSAFE_DNS"));}
    }));
    req.on("error",fail);req.end();
  });
}