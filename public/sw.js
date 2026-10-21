/* RizwanTask সার্ভিস ওয়ার্কার: শুধু একই-সাইটের ফাইল (নেটওয়ার্ক-ফার্স্ট; নেট না থাকলে শেষ কপি)।
   Supabase / GitHub / এপি আই কল কখনো ক্যাশ হয় না। */
const V='kp-shell-v3';
const SHELL=['./','index.html','icon.svg','manifest.json'];   // বাকি ফাইল (হ্যাশ-নামের assets) প্রথম ভিজিটে নিজে ক্যাশ হয়
self.addEventListener('install',e=>{
  e.waitUntil(caches.open(V).then(c=>Promise.all(SHELL.map(u=>c.add(u).catch(()=>{})))).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',e=>{
  e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==V).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',e=>{
  const r=e.request; if(r.method!=='GET')return;
  const u=new URL(r.url); if(u.origin!==location.origin)return;
  e.respondWith(
    fetch(r).then(res=>{
      if(res&&res.ok&&res.type==='basic'){const cp=res.clone();caches.open(V).then(c=>c.put(r,cp)).catch(()=>{});}
      return res;
    }).catch(()=>caches.match(r,{ignoreSearch:true}).then(m=>m||caches.match('index.html')||caches.match('./')))
  );
});
