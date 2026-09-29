/**
 * VÁRIOS ECRÃS DE PROJEÇÃO NO MESMO PROJETO.
 *
 * Pedido dele: *"preciso poder adicionar mais ecrãs de projeção e projetores
 * neste projeto"*.
 *
 * Até aqui havia UM pano e UMA fila de máquinas, e a carga seguinte dos
 * Calculadores substituía a anterior — calcular o segundo ecrã apagava o
 * primeiro. Está escrito nas duas apps: *"um projeto só tem um tipo de ecrã de
 * cada vez"*.
 *
 * Agora uma projeção é um OBJETO DE DADOS (tela, máquinas, posição) e
 * desenham-se tantas quantas houver: a viva, que é a dos campos e a que se
 * edita, e as guardadas ao lado dela. Cada uma é uma peça própria no 3D —
 * agarra-se, move-se e agrupa-se por si.
 *
 *   node scripts/verificar-varias-projecoes.mjs
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

await pagina.goto(`http://127.0.0.1:${porta}/index.html`, { waitUntil: "networkidle" });
await pagina.evaluate((a) => {
  localStorage.clear();
  localStorage.setItem("mikeapps-sincronizacao-v1", JSON.stringify("ligada"));
  localStorage.setItem("mikeapps-projeto-v1", a[0]);
  localStorage.setItem("mikeapps-projetor-v1", a[1]);
}, [PROJETO, blend(0, 18)]);
await pagina.reload({ waitUntil: "networkidle" });
await pagina.waitForFunction(() => window.preview && window.preview.montar, null, { timeout: 30000 });
await pagina.waitForTimeout(1600);

const sincronizar = () => pagina.evaluate(async () => {
  document.getElementById("btSincronizar").click();
  await new Promise((r) => setTimeout(r, 2500));
});
const medir = () => pagina.evaluate(() => {
  const w = window.preview, THREE = w.THREE;
  const panos = [], maquinas = [];
  w.desenhado.traverse((o) => {
    if (!o.isMesh && !o.isGroup) return;
    if (/(^|:)ecra-plano$/.test(o.name || "")) {
      const b = new THREE.Box3().setFromObject(o);
      if (!b.isEmpty()) panos.push({ nome: o.name, x: +(((b.min.x + b.max.x) / 2)).toFixed(2),
                                     largura: +((b.max.x - b.min.x)).toFixed(2) });
    }
    if (/(^|:)projetor-\d+$/.test(o.name || "")) maquinas.push(o.name);
  });
  return { panos, maquinas: maquinas.length,
           guardadas: (w.ajustes.projecoesExtra || []).length,
           rotulos: w.objetosArrastaveis().map((a) => a.rotulo) };
});

console.log("\n== guardar uma projeção e trazer a seguinte ==");

// A carga só entra a pedido: é decisão tomada nesta app que ninguém leva uma
// projeção ligada sem a pedir (ver o arranque em app.js).
await sincronizar();
const uma = await medir();
conferir(uma.panos.length === 1 && uma.maquinas === 3,
  "uma projeção: um pano e três máquinas (" + uma.panos.length + " / " + uma.maquinas + ")");

await pagina.evaluate(async () => {
  document.getElementById("btGuardarProjecao").click();
  await new Promise((r) => setTimeout(r, 1500));
});
const guardada = await medir();
conferir(guardada.guardadas === 1, "guardar põe-na de lado (" + guardada.guardadas + ")");
conferir(guardada.panos.length === 1 && guardada.panos[0].nome === "p2:ecra-plano",
  "e ela CONTINUA desenhada — guardar não é congelar (" + (guardada.panos[0] || {}).nome + ")");
conferir(guardada.rotulos.includes("Pano 2") && guardada.rotulos.includes("Projetor 2.1"),
  "com nome próprio na lista de peças agarráveis");

// A SEGUNDA, vinda dos Calculadores. Antes desta versão, substituía a primeira.
await pagina.evaluate((x) => localStorage.setItem("mikeapps-projetor-v1", x), blend(12, 14));
await sincronizar();
const duas = await medir();
conferir(duas.panos.length === 2,
  "a segunda carga ENTRA AO LADO da primeira, em vez de a apagar (" + duas.panos.length + " panos)");
conferir(duas.maquinas === 6, "e as seis máquinas estão todas na sala (" + duas.maquinas + ")");
conferir(duas.panos.some((p) => p.nome === "ecra-plano") &&
         duas.panos.some((p) => p.nome === "p2:ecra-plano"),
  "uma é a viva (a que se edita), a outra a guardada");
conferir(duas.panos.length === 2 && duas.panos[0].largura !== duas.panos[1].largura,
  "cada pano tem a medida das SUAS imagens, e não a de todas somadas (" +
  duas.panos.map((p) => p.largura + " m").join(" e ") + ")");

console.log("\n== cada uma anda por si ==");

const mexer = await pagina.evaluate(async () => {
  const w = window.preview, THREE = w.THREE;
  const x = (n) => { const o = w.desenhado.getObjectByName(n); if (!o) return null;
    const b = new THREE.Box3().setFromObject(o);
    return b.isEmpty() ? null : +(((b.min.x + b.max.x) / 2)).toFixed(2); };
  const antes = { guardada: x("p2:ecra-plano"), viva: x("ecra-plano") };
  w.selecaoDeGrupo.clear();
  w.selecaoDeGrupo.add("p2:ecra-plano");
  w.moverGrupo(-8, 0, 0);
  await new Promise((r) => setTimeout(r, 1300));
  return { antes, depois: { guardada: x("p2:ecra-plano"), viva: x("ecra-plano") } };
});
conferir(perto(mexer.depois.guardada - mexer.antes.guardada, -8, 0.05),
  "mover a projeção guardada leva-a a ela (" +
  (mexer.depois.guardada - mexer.antes.guardada).toFixed(2) + " m)");
conferir(perto(mexer.depois.viva, mexer.antes.viva, 0.05),
  "e deixa a outra onde estava — não escrevem nos mesmos campos");

// TROCAR: voltar a mexer nos números de uma guardada sem perder a que está viva.
const troca = await pagina.evaluate(async () => {
  const w = window.preview;
  const antes = (w.ajustes.projecoesExtra || []).length;
  const botoes = Array.from(document.querySelectorAll("#listaProjecoesExtra button"));
  const editar = botoes.find((b) => b.textContent === "editar");
  if (editar) editar.click();
  await new Promise((r) => setTimeout(r, 1500));
  return { antes, depois: (w.ajustes.projecoesExtra || []).length,
           distancia: document.getElementById("projDist").value };
});
conferir(troca.depois === troca.antes,
  "\"editar\" TROCA com a viva em vez de carregar por cima — continuam a ser duas (" +
  troca.antes + " → " + troca.depois + ")");
conferir(Number(troca.distancia) === 18,
  "e é a guardada que passa a estar nos campos (" + troca.distancia + " m, a da primeira)");

// E de um dia para o outro.
await pagina.reload({ waitUntil: "networkidle" });
await pagina.waitForFunction(() => window.preview && window.preview.montar, null, { timeout: 30000 });
await pagina.waitForTimeout(1800);
const amanha = await medir();
conferir(amanha.panos.length === 2 && amanha.maquinas === 6,
  "e as duas sobrevivem a fechar e reabrir (" + amanha.panos.length + " panos, " +
  amanha.maquinas + " máquinas) — passaram pela lista branca do projeto.js");

console.log("\n== mexer na ALTURA de uma máquina mexe mesmo na máquina ==");

// Reparo dele: *"assim que mudo a posição dos projetores e tento editar o
// novo, sai fora o blend original"*.
//
// Medido: escrevia-se 9 no campo da altura de um projetor do blend e a
// máquina ficava nos 6. O campo guardava `pe.altura` e o desenho lê
// `pe.alturaOffset` — que continuava a zero. Um campo que aceita um número e
// o ignora é pior do que um que o recusa: quem escreve fica a pensar que a
// app está a desobedecer, e a avaria muda de sítio na cabeça de quem a
// reporta.
const altura = await pagina.evaluate(async () => {
  const w = window.preview;
  const y = () => { let v = null;
    w.desenhado.traverse((o) => { if (/^projetor-1$/.test(o.name || "")) v = +o.position.y.toFixed(2); });
    return v; };
  const antes = y();
  const c = document.querySelector('#listaProjetoresExtra input[data-campo$="-altura"]');
  if (!c) return { semCampo: true };
  const mostrava = Number(c.value);
  c.value = "9";
  c.dispatchEvent(new Event("input", { bubbles: true }));
  await new Promise((r) => setTimeout(r, 1600));
  return { antes, mostrava, depois: y(),
           offset: (w.ajustes.projetoresExtra[0] || {}).alturaOffset,
           absolutaVelha: (w.ajustes.projetoresExtra[0] || {}).altura };
});
conferir(!altura.semCampo, "cada máquina do blend tem campo de altura");
conferir(altura.mostrava === altura.antes,
  "o campo mostra METROS ACIMA DO CHÃO, o mesmo que a máquina está (" +
  altura.mostrava + " m = " + altura.antes + " m)");
conferir(altura.depois === 9,
  "escrever 9 PÕE A MÁQUINA A 9 m — era aqui que o número se perdia (" +
  altura.antes + " → " + altura.depois + " m)");
conferir(Number.isFinite(altura.offset) && altura.absolutaVelha === undefined,
  "e guarda-se como offset, que é o que faz a fila subir com o ecrã (offset " +
  altura.offset + ")");

conferir(erros.length === 0, erros.length ? "erro de JavaScript: " + erros[0] : "sem erros de JavaScript");

await browser.close();
s.close();
console.log(falhas ? `\n${falhas} a corrigir.` : "\nVárias projeções na mesma sala, cada uma por si.");
process.exit(falhas ? 1 : 0);
