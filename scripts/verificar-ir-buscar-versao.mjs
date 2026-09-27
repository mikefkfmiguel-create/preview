/**
 * IR BUSCAR A VERSÃO NOVA — a app instalada não pode ficar presa na antiga.
 *
 * Reportado assim, de telemóvel, com a app já publicada há um bom bocado:
 * *"e ainda não atualizou"*.
 *
 * Registar o service worker não chega, e era só isso que esta app fazia. O
 * browser só vai ver o `sw.js` por sua conta numa **navegação** — e uma app
 * instalada que se retoma do fundo não navega para lado nenhum. Fica dias
 * sem perguntar nada a ninguém, a servir do cache uma versão de há uma
 * semana, sem um único sinal de que é isso que está a acontecer.
 *
 * Três coisas passaram a existir, e são as três que este teste guarda:
 *
 *   1. a app PERGUNTA — `registration.update()` ao abrir, e outra vez sempre
 *      que volta à frente (`visibilitychange`, `focus`);
 *   2. o número da versão é um BOTÃO de último recurso, como o dos
 *      Calculadores: apaga o cache, desregista o service worker e recarrega;
 *   3. e esse botão **confirma a rede antes de apagar seja o que for**. O
 *      cache é o que faz esta app abrir numa sala sem internet; apagá-lo às
 *      cegas deixava-o com a app em branco precisamente no sítio onde ela
 *      faz falta. Esta é a asserção que mais interessa aqui: a cura não pode
 *      ser pior do que a doença.
 *
 * O service worker não se pode registar com `serviceWorkers: "block"`, que é
 * o que o resto da bateria usa — aqui ele é o assunto, e por isso corre-se
 * com ele ligado, num contexto só para isto.
 *
 *   node scripts/verificar-ir-buscar-versao.mjs
 */

import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = fileURLToPath(new URL("..", import.meta.url));

const TIPOS = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8",
  ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml",
  ".wasm": "application/wasm", ".ico": "image/x-icon",
  ".webmanifest": "application/manifest+json"
};

/** Conta quem pediu o quê: é assim que se vê se a app foi mesmo perguntar. */
const pedidos = [];

/**
 * Com isto ligado, o servidor passa a anunciar uma versão MAIS RECENTE no
 * sw.js — como se ela tivesse acabado de ser publicada enquanto a app está
 * aberta. É a única forma honesta de verificar isto: a app tem de reparar
 * numa versão que não é a sua, e não numa que lhe demos à partida.
 */
let publicarVersaoFalsa = null;

function servidor() {
  return new Promise((resolve) => {
    const s = createServer(async (req, res) => {
      const caminho = decodeURIComponent(req.url.split("?")[0]);
      pedidos.push(caminho);
      const ficheiro = join(RAIZ, normalize(caminho === "/" ? "/index.html" : caminho).replace(/^(\.\.[/\\])+/, ""));
      try {
        let dados = await readFile(ficheiro);
        if (publicarVersaoFalsa && caminho.endsWith("/sw.js")) {
          dados = Buffer.from(String(dados).replace(/preview-v[0-9]+\.[0-9]+/,
            "preview-v" + publicarVersaoFalsa));
        }
        res.writeHead(200, {
          "Content-Type": TIPOS[extname(ficheiro)] || "application/octet-stream",
          "Cache-Control": "no-cache"
        });
        res.end(dados);
      } catch (_) { res.writeHead(404).end("não há"); }
    });
    s.listen(0, "127.0.0.1", () => resolve({ s, porta: s.address().port }));
  });
}

async function carregarPlaywright() {
  const sitios = [process.env.PLAYWRIGHT, "playwright",
                  "/opt/node22/lib/node_modules/playwright/index.mjs"].filter(Boolean);
  for (const sitio of sitios) { try { return await import(sitio); } catch (_) {} }
  console.log("Falta o playwright. `npm i -D playwright`, ou PLAYWRIGHT a apontar a uma instalação.");
  process.exit(2);
}

const { s, porta } = await servidor();
const { chromium } = await carregarPlaywright();
const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM || "/opt/pw-browsers/chromium"
});

let falhas = 0;
const conferir = (ok, texto) => { console.log((ok ? "  ✓ " : "  ✗ ") + texto); if (!ok) falhas++; };

// COM service worker: aqui ele é o assunto.
const ctx = await browser.newContext({ viewport: { width: 393, height: 873 }, isMobile: true, hasTouch: true });
const pagina = await ctx.newPage();
const erros = [];
pagina.on("pageerror", (e) => erros.push(e.message));

await pagina.goto(`http://127.0.0.1:${porta}/index.html`, { waitUntil: "networkidle" });
await pagina.waitForFunction(() => window.preview && window.preview.montar, null, { timeout: 30000 });
await pagina.waitForTimeout(2500);

console.log("\n== o service worker instala-se ==");
const registado = await pagina.evaluate(async () => {
  if (!("serviceWorker" in navigator)) return { ha: false };
  const r = await navigator.serviceWorker.getRegistration();
  return { ha: !!r, activo: !!(r && r.active) };
});
conferir(registado.ha, "está registado");
conferir(registado.activo, "e activo");

console.log("\n== o número da versão é um botão ==");
const etiqueta = await pagina.evaluate(() => {
  const e = document.getElementById("versao");
  if (!e) return null;
  const r = e.getBoundingClientRect();
  return {
    texto: e.textContent.trim(), papel: e.getAttribute("role"),
    alcancavel: e.getAttribute("tabindex") === "0",
    explica: (e.getAttribute("title") || "").toLowerCase().includes("atualiza"),
    clicavel: getComputedStyle(e).cursor === "pointer",
    largura: Math.round(r.width), altura: Math.round(r.height)
  };
});
conferir(!!etiqueta && etiqueta.papel === "button", "tem papel de botão");
conferir(!!etiqueta && etiqueta.alcancavel, "e alcança-se pelo teclado");
conferir(!!etiqueta && etiqueta.explica, "e diz para que serve (" + (etiqueta ? etiqueta.texto : "?") + ")");
conferir(!!etiqueta && etiqueta.clicavel && etiqueta.largura > 30,
  "e parece tocável (" + (etiqueta ? etiqueta.largura + "×" + etiqueta.altura + " px" : "?") + ")");

console.log("\n== a app repara numa versão nova, e diz ==");
// Publica-se uma versão nova POR BAIXO da app aberta — que é exactamente o
// que lhe acontece a ele: a app fica no telemóvel, publica-se outra, e ela
// não dá por nada.
const versaoEmUso = await pagina.evaluate(() =>
  document.getElementById("versao").textContent.trim().replace(/^v/, ""));
publicarVersaoFalsa = "9.99";
conferir(/^\d+\.\d+$/.test(versaoEmUso), "a app está na v" + versaoEmUso);

const antes = pedidos.filter((c) => c.endsWith("/sw.js")).length;
// A app volta à frente — o gesto de quem tinha o telemóvel no bolso.
await pagina.evaluate(() => {
  dispatchEvent(new Event("focus"));
  dispatchEvent(new Event("visibilitychange"));
});
await pagina.waitForTimeout(2500);
const depois = pedidos.filter((c) => c.endsWith("/sw.js")).length;
conferir(depois > antes,
  "foi mesmo perguntar à rede quando voltou à frente (" + antes + " → " + depois + " pedidos ao sw.js)");

const reparou = await pagina.evaluate(() => {
  const e = document.getElementById("versao");
  return {
    acesa: e.classList.contains("ha-nova"),
    titulo: e.getAttribute("title") || "",
    recado: (document.getElementById("aviso") || {}).textContent || ""
  };
});
conferir(/9\.99/.test(reparou.recado),
  "e diz que há uma nova: «" + reparou.recado.trim().slice(0, 80) + "»");
conferir(reparou.acesa, "com o número da versão aceso, para haver onde tocar");
conferir(/9\.99/.test(reparou.titulo), "e a dizer qual é (" + reparou.titulo.slice(0, 50) + ")");

// E não repete: um aviso que aparece a cada vinda à frente deixa de se ler.
await pagina.evaluate(() => {
  const a = document.getElementById("aviso");
  if (a) { a.textContent = ""; a.classList.remove("mostra"); }
  dispatchEvent(new Event("focus"));
});
await pagina.waitForTimeout(2000);
const repetiu = await pagina.evaluate(() => (document.getElementById("aviso") || {}).textContent || "");
conferir(repetiu.trim() === "", "e não repete o aviso à segunda vinda à frente");
publicarVersaoFalsa = null;

console.log("\n== COM rede, o botão vai mesmo buscar tudo de novo ==");
const cachesCheios = await pagina.evaluate(() => caches.keys().then((k) => k.length));
conferir(cachesCheios > 0, "a app guardou-se para abrir sem rede (" + cachesCheios + ")");

const antesDeForcar = pedidos.length;
// Marca-se a página ANTES de carregar: se a marca desaparecer, foi porque
// a página se recarregou de raiz — que é o que o botão promete. Esperar por
// um relógio media o relógio; isto mede a app.
await pagina.evaluate(() => { window.__antesDeForcar = true; });
await pagina.evaluate(() => document.getElementById("versao").click());
let recarregouMesmo = false;
for (let i = 0; i < 40 && !recarregouMesmo; i++) {
  await pagina.waitForTimeout(500);
  try { recarregouMesmo = await pagina.evaluate(() => !window.__antesDeForcar); } catch (_) {}
}
conferir(recarregouMesmo, "a página recarregou-se de raiz");
if (recarregouMesmo) {
  await pagina.waitForFunction(() => window.preview && window.preview.montar, null, { timeout: 30000 });
  await pagina.waitForTimeout(1500);
}
const recarregou = pedidos.slice(antesDeForcar);
conferir(recarregou.some((c) => c.endsWith("/index.html") || c === "/"),
  "a página foi buscada de novo à rede");
conferir(recarregou.some((c) => c.endsWith("/js/app.js")),
  "e o js/app.js também — é o que estava preso no cache antigo");
const versaoFinal = await pagina.evaluate(() =>
  (document.getElementById("versao") || {}).textContent.trim());
conferir(/^v\d+\.\d+$/.test(versaoFinal), "e a app voltou a abrir, na " + versaoFinal);


console.log("\n== SEM REDE, o botão não apaga nada ==");
// A asserção que mais interessa: o cache é o que faz esta app abrir numa
// sala sem internet. Um botão que o apagasse às cegas deixava a app em
// branco precisamente onde ela faz falta.
const cachesAntes = await pagina.evaluate(() => caches.keys().then((k) => k.length));
conferir(cachesAntes > 0, "há cache guardado (" + cachesAntes + " conjunto(s))");

await ctx.setOffline(true);
await pagina.evaluate(() => document.getElementById("versao").click());
await pagina.waitForTimeout(2500);
const semRede = await pagina.evaluate(async () => ({
  caches: (await caches.keys()).length,
  registos: (await navigator.serviceWorker.getRegistrations()).length,
  recado: (document.getElementById("aviso") || {}).textContent || ""
}));
conferir(semRede.caches === cachesAntes,
  "o cache ficou intacto (" + cachesAntes + " → " + semRede.caches + ")");
conferir(semRede.registos >= 1, "e o service worker continua registado");
conferir(/sem resposta da rede/i.test(semRede.recado),
  "e a app diz porquê: «" + semRede.recado.trim() + "»");
await ctx.setOffline(false);

console.log("\n== sem erros na consola ==");
conferir(erros.length === 0, erros.length ? erros.join(" | ") : "nenhum");

await browser.close();
s.close();
console.log(falhas ? `\n${falhas} falha(s).` : "\nA app pergunta, e há onde tocar quando ela não pergunta.");
process.exit(falhas ? 1 : 0);
