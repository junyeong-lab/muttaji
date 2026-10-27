// One shared initialization prevents competing cookies from parallel features.
(function(){
 if(typeof window==="undefined")return;
 let pending;
 window.MuttajiSession={get(){
  if(!pending)pending=fetch("/api/session",{cache:"no-store",credentials:"same-origin"}).then(async response=>{
   if(!response.ok)throw Error("SESSION_UNAVAILABLE");const data=await response.json();
   if(data.enabled!==true||typeof data.csrfToken!=="string")throw Error("SESSION_UNAVAILABLE");
   return data.csrfToken;
  }).catch(error=>{pending=null;throw error;});
  return pending;
 }};
})();
