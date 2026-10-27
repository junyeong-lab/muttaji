import {createHmac,randomBytes,timingSafeEqual} from "node:crypto";
import {isIP} from "node:net";
const COOKIE="__Host-muttaji-session",TTL=86400;
const mac=(secret,value)=>createHmac("sha256",secret).update(value).digest("base64url");
const equal=(a,b)=>{if(typeof a!=="string"||typeof b!=="string")return false;const left=Buffer.from(a),right=Buffer.from(b);return left.length===right.length&&timingSafeEqual(left,right);};
export function createSessions({secret,clock=Date.now}){
 if(typeof secret!=="string"||secret.length<32)throw Error("SESSION_NOT_CONFIGURED");
 function read(req){
  const token=(req.headers.get("cookie")||"").split(";").map(x=>x.trim()).find(x=>x.startsWith(COOKIE+"="))?.slice(COOKIE.length+1);
  if(!token||token.length>250)return null;
  const [id,expires,signature,...rest]=token.split(".");
  if(rest.length||!/^[a-f0-9]{48}$/.test(id)||!/^\d{10}$/.test(expires)||Number(expires)<=Math.floor(clock()/1000)||Number(expires)>Math.floor(clock()/1000)+TTL)return null;
  return equal(signature,mac(secret,id+"."+expires))?{id,token}:null;
 }
 return {
  establish(req){
   const previous=read(req);const id=previous?.id||randomBytes(24).toString("hex"),expires=Math.floor(clock()/1000)+TTL;
   const token=previous?.token||id+"."+expires+"."+mac(secret,id+"."+expires);
   return {csrfToken:mac(secret,"csrf:"+id),cookie:COOKIE+"="+token+"; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age="+TTL};
  },
  authorize(req){const session=read(req);return session&&equal(req.headers.get("x-muttaji-csrf"),mac(secret,"csrf:"+session.id))?session.id:null;},
  subject(req){
   // Trust this header only behind the Vercel edge (runtime enforces VERCEL=1).
   const ip=req.headers.get("x-vercel-forwarded-for")||req.headers.get("x-forwarded-for");
   return ip&&isIP(ip)?mac(secret,"ip:"+ip):null;
  }
 };
}
