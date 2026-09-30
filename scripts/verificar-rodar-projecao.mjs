/**
 * UM PANO DE VIÉS, COM AS MÁQUINAS AGARRADAS A ELE.
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
 * A v4.14 travou a rotação para não desenhar um projetor a iluminar o ar. A
 * v4.15 faz o que ele pediu a seguir — *"faz o pano e o resto"*: a projeção
 * roda INTEIRA, pendurada numa moldura que gira em torno do centro do pano. A
 * geometria interna não muda uma vírgula; o que muda é onde o conjunto está
 * na sala.
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
  const maqs = [];
  w.desenhado.traverse((o) => {
    if (!/^projetor-\d+$/.test(o.name || "")) return;
    const q = o.getWorldPosition(new THREE.Vector3());
    maqs.push({ n: o.name, x: +q.x.toFixed(2), z: +q.z.toFixed(2) });
  });
  const fichas = (w.montagemProjetores || []).map((f) => ({
    nome: f.nome, pos: { x: +f.pos.x.toFixed(2), z: +f.pos.z.toFixed(2) } }));
  return { pano, imgs, maqs, fichas, rot: w.ajustes.panoRotDaViva || 0 };
});

console.log("\n== antes de rodar, a luz cai no ecrã ==");
const antes = await medir();
const dentro = (i, p) => p && i.x0 >= p.x0 - 0.05 && i.x1 <= p.x1 + 0.05;
conferir(!!antes.pano && antes.imgs.length === 3,
  "um pano e três imagens (" + antes.imgs.length + ")");
conferir(antes.imgs.every((i) => dentro(i, antes.pano)),
  "e todas dentro do pano (" + antes.pano.x0 + " a " + antes.pano.x1 + " m)");

console.log("\n== rodar o grupo põe a projeção de viés, inteira ==");

// O caminho dele: marcar o pano e as máquinas, fazer grupo, rodar.
await pagina.evaluate(async () => {
  const w = window.preview;
  w.selecaoDeGrupo.clear();
  ["ecra-plano", "projetor-0", "projetor-1"].forEach((n) => w.selecaoDeGrupo.add(n));
  w.criarGrupo();
  await new Promise((r) => setTimeout(r, 900));
  w.rodarGrupo(30);
  await new Promise((r) => setTimeout(r, 1500));
});
const agora = await medir();
conferir(agora.pano && agora.pano.z0 !== agora.pano.z1,
  "O PANO FICA DE VIÉS: z de " + agora.pano.z0 + " a " + agora.pano.z1 + " m (era plano)");
conferir(agora.imgs.length === 3 && agora.imgs.every((i) => dentro(i, agora.pano)),
  "E AS IMAGENS CONTINUAM NO ECRÃ — era aqui que a luz ia parar ao lado dele");
conferir(Math.round(Number(agora.rot)) === 30,
  "o ângulo fica guardado na projeção, não espalhado pelas peças (" + agora.rot + "°)");

// A FICHA DE MONTAGEM TEM DE RODAR COM O DESENHO. Um 3D de viés com
// coordenadas de frente manda a equipa montar a máquina no sítio errado --
// a pior espécie de erro que esta app pode ter.
conferir(agora.fichas.length === 3, "há ficha para cada máquina (" + agora.fichas.length + ")");
const batem = agora.fichas.every((f) => agora.maqs.some((m) =>
  Math.abs(m.x - f.pos.x) < 0.5 && Math.abs(m.z - f.pos.z) < 0.5));
conferir(batem,
  "E AS COORDENADAS BATEM COM O DESENHO — ficha " +
  agora.fichas.map((f) => f.pos.x + "/" + f.pos.z).join(" · ") + " vs máquinas " +
  agora.maqs.map((m) => m.x + "/" + m.z).join(" · "));

// Rodar outra vez acumula, e não recomeça.
await pagina.evaluate(async () => {
  window.preview.rodarProjecao(0, 15);
  window.preview.montar(false);
  await new Promise((r) => setTimeout(r, 1300));
});
const maisQuinze = await medir();
conferir(Math.round(Number(maisQuinze.rot)) === 45,
  "e mais 15 graus dão 45, não 15 (" + maisQuinze.rot + "°)");
conferir(maisQuinze.imgs.every((i) => dentro(i, maisQuinze.pano)),
  "com a luz ainda no ecrã");

console.log("\n== e arrastar um pano de viés segue o rato, não o eixo da sala ==");

// O pano guarda-se no referencial em que a projeção é construída — de frente
// para a parede. Com ela de viés, esse referencial já não é o da sala: sem
// conversão, empurrar o pano 3 m para o lado movia-o pelo eixo DELE e a peça
// fugia do rato.
const arrasto = await pagina.evaluate(async () => {
  const w = window.preview;
  const pano = w.objetosArrastaveis().find((a) => a.obj.name === "ecra-plano");
  if (!pano) return { semPano: true };
  const antes = pano.getXZ();
  pano.setXZ(antes.x + 3, antes.z);
  w.guardarAjustes(w.ajustes);
  w.montar(false);
  await new Promise((r) => setTimeout(r, 1300));
  const outra = w.objetosArrastaveis().find((a) => a.obj.name === "ecra-plano");
  return { antes: { x: +antes.x.toFixed(2), z: +antes.z.toFixed(2) },
           depois: outra ? { x: +outra.getXZ().x.toFixed(2), z: +outra.getXZ().z.toFixed(2) } : null };
});
conferir(!arrasto.semPano, "o pano continua agarrável com a projeção de viés");
conferir(arrasto.depois && Math.abs(arrasto.depois.x - arrasto.antes.x - 3) < 0.05,
  "empurrá-lo 3 m para o lado anda 3 m PARA O LADO DA SALA (" +
  arrasto.antes.x + " → " + arrasto.depois.x + " m)");
conferir(arrasto.depois && Math.abs(arrasto.depois.z - arrasto.antes.z) < 0.05,
  "e não se desvia em profundidade pelo caminho (" +
  arrasto.antes.z + " → " + arrasto.depois.z + " m)");

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
console.log(falhas ? `\n${falhas} a corrigir.` : "\nO pano fica de viés e as máquinas vão com ele.");
process.exit(falhas ? 1 : 0);
