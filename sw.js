// O que faz esta app abrir sem rede.
//
// Não é só para ela se poder instalar: é porque isto usa-se em salas e
// pavilhões, e o sítio onde a ferramenta faz falta é precisamente o sítio onde
// costuma não haver internet. Tudo o que a app precisa está no cache — o motor
// 3D incluído, que é o ficheiro grande.

const CACHE = "preview-v1";

const TUDO = [
  "./",
  "./index.html",
  "./manifest.json",
  "./css/estilo.css",
  "./js/app.js",
  "./js/cena.js",
  "./js/projeto.js",
  "./vendor/three.module.js",
  "./vendor/OrbitControls.js",
  "./icons/mike-logo.png",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/apple-touch-icon.png"
];

self.addEventListener("install", (evento) => {
  evento.waitUntil(
    caches.open(CACHE)
      // addAll falha inteiro se UM ficheiro falhar, e depois a app fica sem
      // cache nenhum sem ninguém perceber porquê. Um a um, o que falhar que
      // falhe sozinho.
      .then((cache) => Promise.all(TUDO.map((url) => cache.add(url).catch(() => null))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (evento) => {
  evento.waitUntil(
    caches.keys()
      .then((nomes) => Promise.all(nomes.filter((n) => n !== CACHE).map((n) => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (evento) => {
  const pedido = evento.request;
  if (pedido.method !== "GET" || new URL(pedido.url).origin !== location.origin) return;

  // Uma navegação vai primeiro à rede para apanhar versões novas, e cai no
  // cache quando não houver. O resto vai primeiro ao cache, que é mais rápido
  // e é o que garante o arranque offline.
  if (pedido.mode === "navigate") {
    evento.respondWith(
      fetch(pedido).catch(() => caches.match("./index.html").then((r) => r || caches.match("./"))));
    return;
  }

  evento.respondWith(
    caches.match(pedido).then((guardado) => guardado || fetch(pedido).then((resposta) => {
      if (resposta && resposta.ok) {
        const copia = resposta.clone();
        caches.open(CACHE).then((cache) => cache.put(pedido, copia));
      }
      return resposta;
    }))
  );
});
