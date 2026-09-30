/**
 * RODAR UM GRUPO COM PROJEÇÃO NÃO PARTE A MONTAGEM.
 *
 * Reparo dele: *"só tentei rodar e ficou assim"*.
 *
 * Medido com um pano e as máquinas num grupo, rodado 30 graus: o PANO ficou
 * de x = -10,37 a -2,12 e as IMAGENS de x = -2,47 a +5,78 — a luz a cair AO
 * LADO do ecrã. E o pano continuou paralelo à parede (z0 = z1): ele
 * trasladou, mas não rodou.
 *
 * A causa é que uma projeção não tem rotação nenhuma para dar. O desenho
 * assume o pano paralelo à parede de trás, e o alvo de cada máquina sai daí;
 * rodar o grupo mexia nas peças uma a uma e partia o par pano-máquinas.
 *
 * Enquanto não houver um ecrã que saiba ficar de viés, mais vale não rodar do
 * que rodar e desenhar um projetor a iluminar o ar.
 *
 *   node scripts/verificar-rodar-projecao.mjs
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
const perto = (a, b, tol) => Math.abs(a - b) < (tol || 0.02);

const pagina = await ctx.newPage();
const erros = [];
pagina.on("pageerror", (e) => erros.push(e.message));

// Uma fila de três máquinas num pano plano, como a que vem do Blending.
const blend = (lateral, distancia) => JSON.stringify({
  v: 2, retro: false, curva: null, alturaLente: 6, shiftV: -50,
  projetores: [-1, 0, 1].map((k) => ({
    lateral: +(lateral + k * 3.4).toFixed(2), alturaOffset: 0,
    largura: 5.05, altura: 2.84, racio: 3.563, distancia
  })),
  quando: new Date().toISOString()
});
const PROJETO = JSON.stringify({
  nome: "Sala", origem: "calculadores", alturaDoChao: 1,
  sala: { largura: 40, profundidade: 40, altura: 12 },
  zonas: [{ nome: "Cenário 1", id: "z1", x: 0, y: 0, w: 8, h: 4.5, cor: "#2e7bff", tipo: "led" }]
});
const BLEND = JSON.stringify({
  v: 2, retro: false, curva: null, alturaLente: 6, shiftV: -50,
  projetores: [-1, 0, 1].map((k) => ({
    lateral: +(k * 3.4).toFixed(2), alturaOffset: 0,
    largura: 5.05, altura: 2.84, racio: 3.563, distancia: 18
  })),
  quando: new Date().toISOString()
});

await pagina.goto(`http://127.0.0.1:${porta}/index.html`, { waitUntil: "networkidle" });
await pagina.evaluate((a) => {
  localStorage.clear();
  localStorage.setItem("mikeapps-sincronizacao-v1", JSON.stringify("ligada"));
  localStorage.setItem("mikeapps-projeto-v1", a[0]);
  localStorage.setItem("mikeapps-projetor-v1", a[1]);
}, [PROJETO, BLEND]);
await pagina.reload({ waitUntil: "networkidle" });
await pagina.waitForFunction(() => window.preview && window.preview.montar, null, { timeout: 30000 });
await pagina.waitForTimeout(1600);
await pagina.evaluate(async () => {
  document.getElementById("btSincronizar").click();
  await new Promise((r) => setTimeout(r, 2500));
});

// UMA projeção só na sala, por isso cada imagem desenhada é dela: aqui os
// números não se confundem com os de mais ninguém.
const medir = () => pagina.evaluate(() => {
  const w = window.preview, THREE = w.THREE;
  let pano = null; const imgs = [];
  w.desenhado.traverse((o) => {
    const n = o.name || "";
    const b = new THREE.Box3().setFromObject(o);
    if (b.isEmpty()) return;
    const cx = { x0: +b.min.x.toFixed(2), x1: +b.max.x.toFixed(2),
                 z0: +b.min.z.toFixed(2), z1: +b.max.z.toFixed(2) };
    if (n === "ecra-plano") pano = cx;
    if (n === "projecao-imagem") imgs.push(cx);
  });
  return { pano, imgs };
});

console.log("\n== antes de rodar, a luz cai no ecrã ==");
const antes = await medir();
const dentro = (i, p) => p && i.x0 >= p.x0 - 0.05 && i.x1 <= p.x1 + 0.05;
conferir(!!antes.pano && antes.imgs.length === 3,
  "um pano e três imagens (" + antes.imgs.length + ")");
conferir(antes.imgs.every((i) => dentro(i, antes.pano)),
  "e todas dentro do pano (" + antes.pano.x0 + " a " + antes.pano.x1 + " m)");

console.log("\n== e depois de tentar rodar, continua a cair ==");
const depois = await pagina.evaluate(async () => {
  const w = window.preview;
  w.selecaoDeGrupo.clear();
  ["ecra-plano", "projetor-0", "projetor-1"].forEach((n) => w.selecaoDeGrupo.add(n));
  w.criarGrupo();
  await new Promise((r) => setTimeout(r, 900));
  w.rodarGrupo(30);
  await new Promise((r) => setTimeout(r, 1400));
  return true;
});
const agora = await medir();
conferir(agora.pano && agora.pano.x0 === antes.pano.x0 && agora.pano.x1 === antes.pano.x1,
  "o pano fica onde estava (" + agora.pano.x0 + " a " + agora.pano.x1 + " m)");
conferir(agora.imgs.length === 3 && agora.imgs.every((i) => dentro(i, agora.pano)),
  "E AS IMAGENS CONTINUAM NO ECRÃ — era aqui que a luz ia parar ao lado dele");
conferir(agora.pano.z0 === agora.pano.z1,
  "e o pano continua paralelo à parede, que é a única coisa que ele sabe ser");

console.log("\n== mas um grupo SEM projeção roda como sempre rodou ==");
const semProjecao = await pagina.evaluate(async () => {
  const w = window.preview;
  w.ajustes.grupos = []; w.guardarAjustes(w.ajustes);
  w.selecaoDeGrupo.clear();
  const nomes = w.objetosArrastaveis()
    .map((a) => a.obj.name)
    .filter((n) => /^zona /.test(n) || /^palco/.test(n));
  if (nomes.length < 1) return { semPecas: true };
  nomes.forEach((n) => w.selecaoDeGrupo.add(n));
  const antesXZ = w.alvosSelecionados().map((a) => +a.getXZ().x.toFixed(2));
  w.rodarGrupo(90);
  await new Promise((r) => setTimeout(r, 1200));
  return { antesXZ, depoisXZ: w.alvosSelecionados().map((a) => +a.getXZ().x.toFixed(2)),
           rot: w.alvosSelecionados().map((a) => (a.ajuste || {}).rot) };
});
conferir(!semProjecao.semPecas, "há peças sem projeção para rodar");
conferir(semProjecao.rot && semProjecao.rot.some((r) => Number(r) === 90),
  "rodar 90 graus escreve a rotação na peça (" + JSON.stringify(semProjecao.rot) + ")");

conferir(erros.length === 0, erros.length ? "erro de JavaScript: " + erros[0] : "sem erros de JavaScript");

await browser.close();
s.close();
console.log(falhas ? `\n${falhas} a corrigir.` : "\nUma projeção não roda — e o que não é projeção continua a rodar.");
process.exit(falhas ? 1 : 0);
