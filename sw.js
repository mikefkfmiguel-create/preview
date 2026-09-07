// O que faz esta app abrir sem rede.
//
// Não é só para ela se poder instalar: é porque isto usa-se em salas e
// pavilhões, e o sítio onde a ferramenta faz falta é precisamente o sítio onde
// costuma não haver internet. Tudo o que a app precisa está no cache — o motor
// 3D incluído, que é o ficheiro grande.

// O nome do cache segue a versao que aparece no painel: subindo uma, sobe a
// outra, e quem estiver com a app aberta recebe a nova sem fazer nada.
const CACHE = "preview-v2.32";

const TUDO = [
  "./",
  "./index.html",
  "./manifest.json",
  "./css/estilo.css",
  "./js/app.js",
  "./js/cena.js",
  "./js/projeto.js",
  "./js/dxf.js",
  "./js/exportar.js",
  "./js/importar.js",
  "./js/assistente.js",
  "./vendor/three.module.js",
  "./vendor/OrbitControls.js",
  "./vendor/GLTFExporter.js",
  "./vendor/OBJExporter.js",
  "./icons/mike-logo.png",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/apple-touch-icon.png"
];

// Os motores de DWG (10 MB) e de PDF (2 MB) NAO entram nesta lista de
// proposito: sao descarregados a primeira vez que alguem abrir um ficheiro
// desses, e ficam no cache a partir dai pelo mesmo caminho que tudo o resto.
// Poe-los aqui seria fazer toda a gente esperar por eles no primeiro arranque.

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

  // Estes dois módulos mudam com frequência e a página pode já ter recebido
  // o HTML novo enquanto o cache ainda devolve o JavaScript anterior. Primeiro
  // tenta-se a rede; sem rede, o cache continua a permitir trabalhar offline.
  const caminho = new URL(pedido.url).pathname;
  if (caminho.endsWith("/js/app.js") || caminho.endsWith("/js/cena.js")) {
    evento.respondWith(
      fetch(pedido).then((resposta) => {
        if (resposta && resposta.ok) {
          const copia = resposta.clone();
          caches.open(CACHE).then((cache) => cache.put(pedido, copia));
        }
        return resposta;
      }).catch(() => caches.match(pedido))
    );
    return;
  }

  // Serve-se do cache — que é o que faz isto abrir sem rede — mas vai-se
  // buscar a versão nova em segundo plano. Sem esta segunda metade, quem
  // abriu a app uma vez ficava com essa versão para sempre: o mike pediu a
  // largura do palco, ela foi publicada, e ele continuava a ver a app de
  // ontem sem nada que lho dissesse.
  evento.respondWith(
    caches.match(pedido).then((guardado) => {
      const daRede = fetch(pedido).then((resposta) => {
        if (resposta && resposta.ok) {
          const copia = resposta.clone();
          caches.open(CACHE).then((cache) => cache.put(pedido, copia));
        }
        return resposta;
      }).catch(() => guardado);
      return guardado || daRede;
    })
  );
});
