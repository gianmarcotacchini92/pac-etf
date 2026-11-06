// PAC ETF price inbox. Quotes are stored in private Cloudflare KV by Firebase UID.
// Authenticated endpoint returns private broker prices, position quantities and trade summaries.
const PROJECT_ID = "sincro-ai";
const JWKS_URL = "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com";
const corsOrigin = "https://gianmarcotacchini92.github.io";
function response(status, data, origin) {
  return new Response(JSON.stringify(data), {status,headers:{"Content-Type":"application/json","Cache-Control":"no-store","Vary":"Origin","Access-Control-Allow-Origin":origin===corsOrigin?corsOrigin:"null","Access-Control-Allow-Headers":"Authorization, Content-Type","Access-Control-Allow-Methods":"GET, OPTIONS"}});
}
function decodeB64Url(value) {
  const s=value.replace(/-/g,"+").replace(/_/g,"/");
  return Uint8Array.from(atob(s.padEnd(Math.ceil(s.length/4)*4,"=")),c=>c.charCodeAt(0));
}
async function verifyFirebase(token) {
  const parts=token.split(".");
  if(parts.length!==3 || parts.some(x=>x.length>6000)) throw Error("invalid_token");
  const header=JSON.parse(new TextDecoder().decode(decodeB64Url(parts[0])));
  const payload=JSON.parse(new TextDecoder().decode(decodeB64Url(parts[1])));
  const now=Math.floor(Date.now()/1000);
  if(header.alg!=="RS256"||typeof header.kid!=="string"||
     payload.aud!==PROJECT_ID||payload.iss!=="https://securetoken.google.com/"+PROJECT_ID||
     typeof payload.sub!=="string"||!payload.sub||payload.sub.length>128||
     typeof payload.exp!=="number"||payload.exp<=now||
     typeof payload.iat!=="number"||payload.iat>now+60||
     typeof payload.auth_time!=="number"||payload.auth_time>now+60) throw Error("invalid_claims");
  const r=await fetch(JWKS_URL,{headers:{Accept:"application/json"},cf:{cacheTtl:300,cacheEverything:true}});
  if(!r.ok) throw Error("key_unavailable");
  const jwks=await r.json();
  const jwk=(jwks.keys||[]).find(k=>k.kid===header.kid&&k.kty==="RSA"&&k.alg==="RS256");
  if(!jwk) throw Error("unknown_key");
  const key=await crypto.subtle.importKey("jwk",jwk,{name:"RSASSA-PKCS1-v1_5",hash:"SHA-256"},false,["verify"]);
  const valid=await crypto.subtle.verify("RSASSA-PKCS1-v1_5",key,decodeB64Url(parts[2]),new TextEncoder().encode(parts[0]+"."+parts[1]));
  if(!valid) throw Error("bad_signature");
  return payload.sub;
}
export default {async fetch(request,env) {
  const url=new URL(request.url),origin=request.headers.get("Origin");
  if(request.method==="OPTIONS") return new Response(null,{status:204,headers:{"Access-Control-Allow-Origin":origin===corsOrigin?corsOrigin:"null","Access-Control-Allow-Headers":"Authorization, Content-Type","Access-Control-Allow-Methods":"GET, OPTIONS","Vary":"Origin"}});
  if(request.method!=="GET"||url.pathname!=="/prices") return response(404,{error:"not_found"},origin);
  if(!env.PRICE_INBOX) return response(503,{error:"storage_unavailable"},origin);
  const auth=request.headers.get("Authorization")||"";
  if(!auth.startsWith("Bearer ")) return response(401,{error:"authentication_required"},origin);
  let uid;
  try {uid=await verifyFirebase(auth.slice(7));}catch{return response(401,{error:"invalid_authentication"},origin);}
  const raw=await env.PRICE_INBOX.get("prices:"+uid);
  if(!raw) return response(200,{prices:[],updatedAt:null},origin);
  try {const payload=JSON.parse(raw);return response(200,{prices:Array.isArray(payload.prices)?payload.prices:[],positions:Array.isArray(payload.positions)?payload.positions:[],transactions:Array.isArray(payload.transactions)?payload.transactions:[],updatedAt:payload.updatedAt||null},origin);}
  catch{return response(502,{error:"invalid_snapshot"},origin);}
}};
