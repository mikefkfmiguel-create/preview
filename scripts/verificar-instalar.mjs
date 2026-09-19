/**
 * UM LINK QUE LEVA À INSTALAÇÃO — QUE É O MAIS LONGE QUE UM LINK PODE IR.
 *
 * Pedido a olhar para a página de entrada: *"podemos ter um link para download
 * aqui que force a instalar a app"*, e a seguir: *"forçaria a app a abrir nos
 * browsers que podem criar o atalho instalado nas várias plataformas"*.
 *
 * O que NÃO se pode fazer, e este teste existe em parte para o deixar escrito:
 * nenhum link instala nada. Não há URL, cabeçalho nem ficheiro que faça um
 * browser instalar uma app web — e ainda bem, porque a alternativa era qualquer
 * página do mundo poder pôr ícones no telemóvel de quem a abre. A instalação é
 * sempre um gesto feito DENTRO da app.
 *
 * O que este teste guarda é a corrente toda até lá:
 *
 *   1. o MANIFESTO serve para instalar (display, ícones de 192 e 512, start_url)
 *      — sem isto o browser nunca oferece a instalação e o botão fica a mentir;
 *   2. o BOTÃO está na página e liga ao motor, em vez de ser um enfeite;
 *   3. quando o browser deixa pedir, é o nosso botão que abre a caixa — o
 *      `beforeinstallprompt` é apanhado e guardado, não desperdiçado;
 *   4. quando o browser NÃO deixa pedir (iPhone, Firefox), o botão DIZ o
 *      caminho do menu nessa plataforma. Um botão morto é pior do que instrução
 *      nenhuma;
 *   5. e o "#instalar" que vem da página de entrada carrega o botão sozinho —
 *      é esse o "link que instala" que é possível existir;
 *   6. as duas cópias do js/instalar.js são IGUAIS. Duas cópias que divergem
 *      são pior do que duas cópias.
 *
 *   node scripts/verificar-instalar.mjs
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

function servidor() {
  return new Promise((resolve) => {
    const s = createServer(async (req, res) => {
      const caminho = decodeURIComponent(req.url.split("?")[0]);
      const ficheiro = join(RAIZ, normalize(caminho === "/" ? "/index.html" : caminho).replace(/^(\.\.[/\\])+/, ""));
      try {
        const dados = await readFile(ficheiro);
        res.writeHead(200, { "Content-Type": TIPOS[extname(ficheiro)] || "application/octet-stream" });
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

// O Chromium de teste NUNCA dispara o beforeinstallprompt sozinho (não há perfil,
// não há histórico de visitas, e em headless não há instalação nenhuma). Portanto
// finge-se o evento — e finge-se com a forma exacta do a sério: um `prompt()` que
// devolve promessa e um `userChoice` que resolve numa escolha.
const FINGIR = `
  window.__instalar = { prompts: 0, recados: [] };
  window.__fingirEvento = function (escolha) {
    var e = new Event("beforeinstallprompt");
    e.prompt = function () { window.__instalar.prompts++; return Promise.resolve(); };
    e.userChoice = Promise.resolve({ outcome: escolha || "accepted" });
    window.dispatchEvent(e);
  };
`;

async function abrir(hash) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: "block" });
  const pagina = await ctx.newPage();
  await pagina.addInitScript(FINGIR);
  await pagina.goto(`http://127.0.0.1:${porta}/index.html${hash || ""}`, { waitUntil: "networkidle" });
  await pagina.waitForFunction(() => window.mikeappsInstalar, null, { timeout: 15000 });
  return { ctx, pagina };
}

// ---- 1. O MANIFESTO SERVE PARA INSTALAR --------------------------------
console.log("\n== o manifesto ==");
const manifesto = JSON.parse(await readFile(join(RAIZ, "manifest.json"), "utf8"));
conferir(["standalone", "fullscreen", "minimal-ui"].includes(manifesto.display),
  "display é «" + manifesto.display + "» — um modo que o browser aceita instalar");
conferir(typeof manifesto.start_url === "string" && manifesto.start_url.length > 0,
  "tem start_url (" + manifesto.start_url + ")");
const tamanhos = (manifesto.icons || []).map((i) => String(i.sizes || ""));
conferir(tamanhos.some((t) => /\b192x192\b/.test(t)), "tem ícone de 192×192");
conferir(tamanhos.some((t) => /\b512x512\b/.test(t)), "tem ícone de 512×512 — o que o Android exige");
const html = await readFile(join(RAIZ, "index.html"), "utf8");
conferir(/<link[^>]+rel=["']manifest["']/.test(html), "o index.html liga ao manifesto");

// ---- 2. O BOTÃO ESTÁ LÁ, E LIGADO --------------------------------------
console.log("\n== o botão ==");
const quantos = (html.match(/id="btInstalar"/g) || []).length;
conferir(quantos === 1, "há UM só botão de instalar na página (encontrados: " + quantos + ")");

let { ctx, pagina } = await abrir();
const erros = [];
pagina.on("pageerror", (e) => erros.push(e.message));
conferir(await pagina.isVisible("#btInstalar"),
  "o botão está à vista — quem ainda não instalou tem de o encontrar");
conferir(await pagina.evaluate(() => window.mikeappsInstalar.estado()) === "manual",
  "sem o evento do browser, o motor diz «manual» — e não finge que pode pedir");

// ---- 3. QUANDO O BROWSER DEIXA, É O NOSSO BOTÃO QUE PEDE ---------------
console.log("\n== o browser deixa pedir ==");
await pagina.evaluate(() => window.__fingirEvento("accepted"));
await pagina.waitForTimeout(150);
conferir(await pagina.evaluate(() => window.mikeappsInstalar.estado()) === "pode",
  "o beforeinstallprompt foi apanhado e guardado, em vez de deixar o browser decidir a hora");
await pagina.click("#btInstalar");
await pagina.waitForTimeout(400);
conferir(await pagina.evaluate(() => window.__instalar.prompts) === 1,
  "o clique abriu a caixa de instalação — uma vez");
conferir(await pagina.evaluate(() => window.mikeappsInstalar.estado()) === "manual",
  "e o pedido ficou gasto, como manda o browser — não se pede duas vezes com o mesmo evento");
await ctx.close();

// ---- 4. QUANDO NÃO DEIXA, DIZ-SE COMO SE FAZ ---------------------------
//
// É o caso do iPhone e do Firefox — juntos, gente que chega e não tem caixa
// nenhuma. Mostrar-lhes um botão que não faz nada era perdê-los ali.
console.log("\n== o browser não deixa pedir ==");
({ ctx, pagina } = await abrir());
const semEvento = await pagina.evaluate(() => window.mikeappsInstalar.pedirInstalacao());
conferir(semEvento.resultado === "manual", "o motor assume: não dá para pedir aqui");
conferir(typeof semEvento.recado === "string" && semEvento.recado.length > 20,
  "e devolve o caminho do menu, escrito: «" + String(semEvento.recado).slice(0, 70) + "…»");

const noIPhone = await pagina.evaluate(() => {
  const real = navigator.userAgent;
  Object.defineProperty(navigator, "userAgent", { configurable: true,
    value: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 " +
           "(KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1" });
  const texto = window.mikeappsInstalar.comoSeFazAqui();
  Object.defineProperty(navigator, "userAgent", { configurable: true, value: real });
  return texto;
});
console.log("   iPhone → " + noIPhone);
conferir(/partilhar/i.test(noIPhone) && /ecrã principal/i.test(noIPhone),
  "no iPhone diz Partilhar → Adicionar ao ecrã principal, que é o caminho que lá existe");

const noFirefox = await pagina.evaluate(() => {
  const real = navigator.userAgent;
  Object.defineProperty(navigator, "userAgent", { configurable: true,
    value: "Mozilla/5.0 (X11; Linux x86_64; rv:130.0) Gecko/20100101 Firefox/130.0" });
  const texto = window.mikeappsInstalar.comoSeFazAqui();
  Object.defineProperty(navigator, "userAgent", { configurable: true, value: real });
  return texto;
});
console.log("   Firefox → " + noFirefox);
conferir(/firefox/i.test(noFirefox) && /(chrome|edge)/i.test(noFirefox),
  "no Firefox de computador diz a verdade — não instala — e manda para um que instale");
await ctx.close();

// ---- 5. O "#instalar" DA PÁGINA DE ENTRADA -----------------------------
//
// É o pedido dele, tal como pode existir: o link abre a app, e a app pede.
console.log("\n== o link da página de entrada: «#instalar» ==");
({ ctx, pagina } = await abrir("#instalar"));
await pagina.evaluate(() => window.__fingirEvento("accepted"));
await pagina.waitForTimeout(1500);
conferir(await pagina.evaluate(() => window.__instalar.prompts) === 1,
  "a caixa de instalação abriu-se sozinha, sem ninguém carregar em nada");
await ctx.close();

console.log("\n== e sem «#instalar» não se pede nada a ninguém ==");
({ ctx, pagina } = await abrir());
await pagina.evaluate(() => window.__fingirEvento("accepted"));
await pagina.waitForTimeout(1500);
conferir(await pagina.evaluate(() => window.__instalar.prompts) === 0,
  "quem abre a app para trabalhar não leva com uma caixa de instalação à cara");
await ctx.close();

// ---- 6. AS DUAS CÓPIAS SÃO IGUAIS --------------------------------------
console.log("\n== as duas cópias do motor ==");
const IRMA = join(RAIZ, "..", RAIZ.includes("/preview") ? "calculadores" : "preview", "js", "instalar.js");
try {
  const daqui = await readFile(join(RAIZ, "js", "instalar.js"), "utf8");
  const delas = await readFile(IRMA, "utf8");
  conferir(daqui === delas, "o js/instalar.js é o MESMO nas duas apps");
} catch (_) {
  console.log("  – a app irmã não está aqui ao lado; salta-se (só corre com as duas em /home/user)");
}

conferir(erros.length === 0, erros.length ? "erro de JavaScript: " + erros[0] : "sem erros de JavaScript");

await browser.close();
s.close();
console.log("\n" + (falhas ? falhas + " FALHA(S)"
  : "O link leva à instalação — e onde o browser não deixa, diz-se como se faz."));
process.exit(falhas ? 1 : 0);
