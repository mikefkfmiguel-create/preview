/**
 * O 🏠 ENQUADRA AS PEÇAS, e não a sala.
 *
 * Reportado assim: *"o home deve enquadrar os objetos todos e não saltar
 * para o fundo da casa; se for muito comprida deixo de os ver"*.
 *
 * A caixa a enquadrar era à volta de **tudo o que está desenhado** — e tudo
 * inclui o chão e as paredes. Numa sala comprida (a app nasce com 50 × 50 m,
 * e um pavilhão a sério pode ter 120 m de fundo) a caixa É a sala: o botão
 * que existe para trazer tudo à vista levava a câmara para trás de tudo, a
 * olhar para um chão vazio com as peças a um palmo do horizonte.
 *
 * O que este teste guarda:
 *
 *   1. num pavilhão de 120 m, o 🏠 aponta às PEÇAS e não ao meio da sala;
 *   2. e elas ficam mesmo DENTRO do ecrã — medido a projetar o centro do
 *      ecrã na câmara, que é a única forma de responder a "deixo de os ver"
 *      sem ser de olho;
 *   3. a grelha e os pontos da cobertura não puxam o enquadramento: cobrem a
 *      plateia toda, e enquadrá-los era enquadrar o chão por outro caminho;
 *   4. numa sala vazia o botão não rebenta — não há peças, e a vista de
 *      frente é a resposta honesta.
 *
 *   node scripts/verificar-enquadrar-o-que-existe.mjs
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

/** Um pavilhão comprido: 120 m de fundo, com tudo à frente. */
const PAVILHAO = {
  nome: "Pavilhão", sala: { largura: 30, profundidade: 120, altura: 12 },
  palco: { largura: 12, profundidade: 6, altura: 1, dx: 0, dz: 0 },
  zonas: [{ nome: "central", id: "z1", x: 0, y: 2, w: 8, h: 4.5, tiles: { x: 16, y: 9 },
            res: { x: 3072, y: 1728 }, peso: 600, amp: 60, tipo: "led", cor: "#2E7BFF" }]
};

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
await pagina.waitForTimeout(1400);

console.log("\n== numa sala vazia o botão não rebenta ==");
await pagina.evaluate(async () => {
  document.getElementById("btRecentrarVista").click();
  await new Promise((r) => setTimeout(r, 1500));
});
conferir(erros.length === 0, "sem erros com a sala vazia" + (erros.length ? ": " + erros[0] : ""));

await pagina.evaluate(async (p) => {
  const caixa = document.getElementById("colagem");
  caixa.value = JSON.stringify(p);
  caixa.dispatchEvent(new Event("input", { bubbles: true }));
  document.getElementById("btCarregar").click();
  await new Promise((r) => setTimeout(r, 2400));
}, PAVILHAO);
await pagina.evaluate(async () => {
  ["verPalco", "verPublico"].forEach((id) => {
    const c = document.getElementById(id);
    if (c && !c.checked) c.click();
  });
  await new Promise((r) => setTimeout(r, 1800));
});

/** Onde está a câmara, e o que é que dali se vê. */
const olhar = () => pagina.evaluate(() => {
  const THREE = window.preview.THREE;
  const camara = window.preview.camara;
  const alvo = window.preview.controlos.target;
  let ecra = null;
  window.preview.desenhado.traverse((o) => { if (!ecra && o.name === "zona central") ecra = o; });
  if (!ecra) return null;
  const caixa = new THREE.Box3().setFromObject(ecra);
  const centro = caixa.getCenter(new THREE.Vector3());
  // Projetar o centro do ecrã: |x| e |y| abaixo de 1 quer dizer DENTRO do
  // ecrã do computador. É a única forma de responder a "deixo de os ver"
  // sem ser a olho.
  const naTela = centro.clone().project(camara);
  return {
    alvo: { x: +alvo.x.toFixed(1), z: +alvo.z.toFixed(1) },
    centroDoEcra: { x: +centro.x.toFixed(1), z: +centro.z.toFixed(1) },
    distancia: +camara.position.distanceTo(centro).toFixed(1),
    naTela: { x: +naTela.x.toFixed(2), y: +naTela.y.toFixed(2), z: +naTela.z.toFixed(3) },
    dentroDaTela: Math.abs(naTela.x) < 1 && Math.abs(naTela.y) < 1 && naTela.z < 1
  };
});

const trazerTudo = () => pagina.evaluate(async () => {
  document.getElementById("btRecentrarVista").click();
  await new Promise((r) => setTimeout(r, 1800));
});

console.log("\n== num pavilhão de 120 m, o 🏠 aponta às peças ==");
await trazerTudo();
const visto = await olhar();
conferir(!!visto, "o ecrã está desenhado");
if (visto) {
  console.log("   alvo da câmara: z=" + visto.alvo.z + " · centro do ecrã: z=" +
    visto.centroDoEcra.z + " · " + visto.distancia + " m de distância");
  // O meio da sala é z≈0; as peças estão lá ao fundo, contra a parede.
  conferir(Math.abs(visto.alvo.z - visto.centroDoEcra.z) < 12,
    "a câmara aponta às peças (z=" + visto.alvo.z + "), e não ao meio da sala (z=0)");
  conferir(visto.distancia < 45,
    "e fica perto delas — " + visto.distancia + " m (enquadrar a sala punha-a a mais de 150)");
  conferir(visto.dentroDaTela,
    "e o ecrã fica DENTRO da tela " + JSON.stringify(visto.naTela));
}

console.log("\n== a grelha e a cobertura não puxam o enquadramento ==");
// Cobrem a plateia toda: enquadrá-las era enquadrar o chão por outro caminho.
await pagina.evaluate(async () => {
  ["verMedidas", "verCobertura"].forEach((id) => {
    const c = document.getElementById(id);
    if (c && !c.checked) c.click();
  });
  await new Promise((r) => setTimeout(r, 2200));
});
await trazerTudo();
const comAjudas = await olhar();
conferir(!!comAjudas && comAjudas.dentroDaTela,
  "com as medidas e a cobertura ligadas, o ecrã continua dentro da tela " +
  (comAjudas ? JSON.stringify(comAjudas.naTela) : ""));
conferir(!!comAjudas && !!visto && Math.abs(comAjudas.distancia - visto.distancia) < 10,
  "e o enquadramento é praticamente o mesmo (" + (visto ? visto.distancia : "?") +
  " m → " + (comAjudas ? comAjudas.distancia : "?") + " m)");

console.log("\n== sem erros na consola ==");
conferir(erros.length === 0, erros.length ? erros.join(" | ") : "nenhum");

await browser.close();
s.close();
console.log(falhas ? `\n${falhas} falha(s).` : "\nO 🏠 traz as peças à vista, e não o chão.");
process.exit(falhas ? 1 : 0);
