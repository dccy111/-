// 빠른 실행·오프라인용 서비스워커
// 앱 파일은 휴대폰에 저장해 두고 바로 연다(네트워크를 기다리지 않음). 새 버전이 올라오면 이 파일이 바뀌어 뒤에서 새로 받고, 다음 실행(또는 '적용' 버튼)부터 새 버전.
// 로그인·동기화(Supabase) 요청은 저장하지 않고 항상 네트워크.
const CACHE = "ptlvl-b102400250";
const SHELL = ["./", "./index.html", "./manifest.webmanifest", "./icon-192.png", "./icon-512.png"];
self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL.map((u) => new Request(u, { cache: "reload" })))).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET" || u.hostname.endsWith("supabase.co")) return;
  if (u.origin === location.origin) {
    e.respondWith(caches.open(CACHE).then(async (c) => {
      const hit = await c.match(e.request, { ignoreSearch: true });
      if (hit) return hit;
      try { const r = await fetch(e.request); if (r.ok) c.put(e.request, r.clone()); return r; }
      catch (err) { return (await c.match("./index.html")) || Response.error(); }
    }));
  } else if (/fonts\.(googleapis|gstatic)\.com$/.test(u.hostname)) {
    e.respondWith(caches.match(e.request).then((r) => r || fetch(e.request).then((res) => { const cp = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, cp)); return res; })));
  }
});
