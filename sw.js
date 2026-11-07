// PAC ETF offline support. Network-first HTML ensures new releases appear promptly.
const CACHE = "pac-etf-v12";
const ASSETS = ["./index.html","./manifest.webmanifest","./icon-192.png","./icon-512.png"];
self.addEventListener("install",event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)).then(()=>self.skipWaiting()));
});
self.addEventListener("activate",event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));
});
self.addEventListener("fetch",event=>{
  const request=event.request;
  if(request.method!=="GET")return;
  const url=new URL(request.url);
  if(url.origin!==self.location.origin)return;
  if(request.mode==="navigate"||url.pathname.endsWith("/index.html")){
    event.respondWith(fetch(request,{cache:"no-store"}).then(response=>{
      if(response.ok){const copy=response.clone();event.waitUntil(caches.open(CACHE).then(cache=>cache.put("./index.html",copy)));}
      return response;
    }).catch(()=>caches.match("./index.html")));
    return;
  }
  event.respondWith(caches.match(request).then(cached=>cached||fetch(request).then(response=>{
    if(response.ok){const copy=response.clone();event.waitUntil(caches.open(CACHE).then(cache=>cache.put(request,copy)));}
    return response;
  })));
});
