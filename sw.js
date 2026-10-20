const CACHE='beach-cams-v9';
const SHELL=['./','./index.html','./styles.css','./app.js','./startup.js','./conditions.js','./sources.js','./history.js','./cams.json','./manifest.json','./icons/wave.svg','./icons/apple-touch-icon.png','./icons/icon-192.png','./icons/icon-512.png','./vendor/hls.min.js'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting()));});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('beach-cams-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',event=>{
  const url=new URL(event.request.url);
  // Never cache video, provider players, or NOAA responses.
  if(event.request.method!=='GET'||url.origin!==self.location.origin||!SHELL.some(path=>new URL(path,self.registration.scope).pathname===url.pathname))return;
  event.respondWith(fetch(event.request, {cache:'no-cache'}).then(response=>{
    if(response.ok){const clone=response.clone();event.waitUntil(caches.open(CACHE).then(cache=>cache.put(event.request,clone)));}
    return response;
  }).catch(()=>caches.match(event.request).then(cached=>cached||Response.error())));
});
