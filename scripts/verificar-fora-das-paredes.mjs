/**
 * MUDAR A SALA E AS PEÇAS FICAREM LÁ FORA — A APP TEM DE DIZER.
 *
 * Reportado com uma fotografia: *"alterei as medidas da sala e os objetos não
 * acompanharam, o palco 2 ficou fora"*.
 *
 * E é mesmo assim que funciona, por desenho: as peças com posição própria (os
 * palcos, régies e passarelas extra, os gomos, os DSM) vivem em coordenadas
 * suas e não em percentagem da sala. Encolher a sala à volta delas deixa-as
 * onde estavam — que passa a ser do lado de fora.
 *
 * A app já tinha uma arrumação, mas com duas lacunas que juntas davam
 * exactamente isto:
 *
 *   1. só corria a pedido, no botão de trazer tudo à vista;
 *   2. a régua dela é de propósito muito larga -- "fugiu" é estar a TRÊS VEZES
 *      a maior medida da sala. Essa largura existe por boa razão (em retro as
 *      máquinas ficam metros atrás do pano e não fugiram), mas um palco dois
 *      metros para lá da parede nova nunca lá cai.
 *
 * O que este teste guarda não é que a app arrume sozinha -- é que ela DIGA. Uma
 * peça meio metro para lá da parede pode estar onde alguém a pôs de propósito,
 * e a app a mexer-lhe sem pedir seria desfazer trabalho para resolver um
 * problema que ela nem sabe se existe. Mexer só quando se carrega no botão.
 *
 * E guarda o contrário, que é onde isto se estragaria: os projetores NÃO podem
 * entrar na conta. Em retroprojecção vivem atrás do pano, fora da sala, e
 * acusá-los todas as vezes seria ensinar a ignorar o aviso.
 *
 *   node scripts/verificar-fora-das-paredes.mjs
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
const ctx = await browser.newContext({ viewport: { width: 1400, height: 950 }, serviceWorkers: "block" });

let falhas = 0;
const conferir = (ok, texto) => { console.log((ok ? "  ✓ " : "  ✗ ") + texto); if (!ok) falhas++; };

const pagina = await ctx.newPage();
const erros = [];
pagina.on("pageerror", (e) => erros.push(e.message));
await pagina.goto(`http://127.0.0.1:${porta}/index.html`, { waitUntil: "networkidle" });
await pagina.waitForFunction(() => window.preview && window.preview.montar, null, { timeout: 30000 });
await pagina.waitForTimeout(1000);

const por = (campos) => pagina.evaluate(async (campos) => {
  Object.keys(campos).forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    const v = campos[id];
    if (el.type === "checkbox") el.checked = !!v; else el.value = String(v);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await new Promise((r) => setTimeout(r, 1200));
}, campos);

const estado = () => pagina.evaluate(() => {
  const aviso = document.getElementById("aviso");
  return {
    fora: window.preview.pecasForaDasParedes().map((p) => ({
      rotulo: p.rotulo, x: +p.x.toFixed(2), z: +p.z.toFixed(2) })),
    aviso: aviso && aviso.classList.contains("mostra") ? aviso.textContent : "",
    temBotao: !!(aviso && aviso.querySelector("[data-arrumar]"))
  };
});

// ---- 1. Uma sala grande, com um palco 2 lá dentro ----------------------
console.log("\n== sala 40 × 30, com um palco 2 no fundo ==");
await por({ salaL: 40, salaP: 30, salaA: 8, palcoL: 12, palcoP: 6, palcoA: 1, verPalco: true });
await pagina.evaluate(async () => {
  // Um palco extra a 11 m do centro: dentro de uma sala com 30 de fundo
  // (±15), e fora de uma com 20 (±10). É o caso da fotografia.
  const ajustes = window.preview.ajustes;
  ajustes.palcosExtra.length = 0;
  ajustes.palcosExtra.push({ largura: 6, profundidade: 4, altura: 0.6,
                             dx: 0, dz: 11, rot: 0 });
  window.preview.guardarAjustes(ajustes);
  window.preview.montar();
  await new Promise((r) => setTimeout(r, 1200));
});
const dentro = await estado();
console.log("   " + JSON.stringify(dentro.fora));
conferir(dentro.fora.length === 0, "com a sala grande não há nada fora das paredes");
conferir(!/fora das paredes/.test(dentro.aviso), "e a app não se queixa de nada");

// ---- 2. Encolher a sala. É AQUI QUE ESTÁ O DEFEITO --------------------
console.log("\n== e agora a sala passa a 40 × 20 ==");
await por({ salaP: 20 });
const encolhida = await estado();
console.log("   " + JSON.stringify(encolhida.fora));
console.log("   aviso: " + encolhida.aviso.replace(/\s+/g, " ").slice(0, 140));
conferir(encolhida.fora.length >= 1,
  "a app REPARA que ficou peça fora das paredes (" + encolhida.fora.length + ")");
conferir(/Palco 1/.test(encolhida.aviso) || /fora das paredes/.test(encolhida.aviso),
  "e diz QUAL — não só que há uma");
conferir(encolhida.temBotao, "com um botão para a trazer para dentro");

// ---- 3. Mas não lhe toca sozinha --------------------------------------
//
// Uma peça meio metro para lá da parede pode estar onde alguém a pôs. A app a
// arrumá-la sem pedir era desfazer trabalho por sua conta.
const naoMexeu = await pagina.evaluate(() => {
  const p = window.preview.ajustes.palcosExtra[0];
  return { dz: p ? p.dz : null };
});
console.log("   o palco continua em dz = " + naoMexeu.dz);
conferir(naoMexeu.dz === 11,
  "e NÃO lhe mexeu — dizer não é arrumar, e arrumar sem pedir era desfazer trabalho");

// ---- 4. O botão é que arruma -------------------------------------------
console.log("\n== carregar no botão ==");
await pagina.evaluate(async () => {
  document.querySelector("#aviso [data-arrumar]").click();
  await new Promise((r) => setTimeout(r, 1400));
});
const arrumado = await pagina.evaluate(() => ({
  dz: window.preview.ajustes.palcosExtra[0].dz,
  fora: window.preview.pecasForaDasParedes().length
}));
console.log("   " + JSON.stringify(arrumado));
conferir(arrumado.dz <= 10.01, "o palco voltou para dentro da parede (dz " + arrumado.dz + ")");
conferir(arrumado.fora === 0, "e já não há nada fora das paredes");

// ---- 5. OS PROJETORES NÃO ENTRAM NA CONTA ------------------------------
//
// Em retro vivem atrás do pano, fora da sala. Acusá-los todas as vezes era
// ensinar a ignorar o aviso -- e um aviso que se ignora não é um aviso.
console.log("\n== um projetor atrás do pano (retro) ==");
const comProjetor = await pagina.evaluate(async () => {
  const por = (id, v) => { const el = document.getElementById(id);
    if (!el) return;
    if (el.type === "checkbox") el.checked = !!v; else el.value = String(v);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true })); };
  por("projLigada", true); por("projRacio", 1.5); por("projDist", 8);
  const retro = document.getElementById("projRetro");
  if (retro) por("projRetro", true);
  await new Promise((r) => setTimeout(r, 1400));
  const nomes = window.preview.objetosArrastaveis().map((a) => a.rotulo);
  return { arrastaveis: nomes,
           fora: window.preview.pecasForaDasParedes().map((p) => p.rotulo) };
});
console.log("   arrastáveis: " + JSON.stringify(comProjetor.arrastaveis));
console.log("   fora:        " + JSON.stringify(comProjetor.fora));
conferir(!comProjetor.fora.some((r) => /^Projetor/.test(r)),
  "nenhum projetor entra na lista — em retro ficam atrás do pano de propósito");

conferir(erros.length === 0, erros.length ? "erro de JavaScript: " + erros[0] : "sem erros de JavaScript");

await browser.close();
s.close();
console.log("\n" + (falhas ? falhas + " FALHA(S)"
  : "Mudar a sala já não deixa peças lá fora em silêncio."));
process.exit(falhas ? 1 : 0);
