/**
 * OS NÚMEROS DO PAINEL E A POSIÇÃO REAL DA PEÇA.
 *
 * Reportado com o painel do Palco aberto: *"não bate certo nas medidas para a
 * posição"*. Estava certo, e era a mesma palavra a querer dizer duas coisas.
 * Medido numa sala de 30 m, antes:
 *
 *     peça          painel "fundo"     onde estava (z)     diferença
 *     Palco               0                −12,00            12,00 m
 *     ecrã                0                −14,65            14,65 m
 *     Palco 1 (extra)   −12                −12,00             0
 *     Passarela 1        −6                 −6,00             0
 *
 * Nos palcos extra, passarelas soltas e régies extra o `dz` É a coordenada da
 * sala; no palco principal e nos ecrãs é um DESLOCAMENTO a partir de onde a
 * app os põe. Duas famílias de campos com o mesmo nome em cima.
 *
 * E, pelo caminho, uma segunda: o campo "altura" (`dy`) do painel flutuante
 * não era lido por ninguém nos palcos extra, passarelas e régies extra --
 * escrever 2 m não mexia a peça um milímetro (y 0 → 0). Era precisamente o
 * campo de que o cenário de *"vários palcos a alturas diferentes para fazer
 * escadas"* precisava.
 *
 * O que este teste guarda:
 *
 *   1. o painel diz sempre ONDE A PEÇA ESTÁ, lido da cena, em todas as
 *      famílias -- e o número bate com o getWorldPosition() ao centímetro;
 *   2. a palavra "fundo" só aparece onde o campo é mesmo a coordenada da
 *      sala; onde é deslocamento, o campo é "↕";
 *   3. a medida acompanha o que se escreve E o que se arrasta;
 *   4. "subir" sobe mesmo: palco extra, passarela solta e régie extra;
 *   5. no grupo, a medida é o meio das peças -- o mesmo ponto à volta do qual
 *      elas rodam.
 *
 *   node scripts/verificar-posicao-real.mjs
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

// Sala funda de propósito: quanto mais funda, maior a diferença entre um
// deslocamento e uma coordenada -- é onde um engano destes se vê.
const PROJETO = {
  nome: "Posição", sala: { largura: 24, profundidade: 30, altura: 8 },
  palco: { largura: 12, profundidade: 6, altura: 1, dx: 0, dz: 0 },
  zonas: [
    { nome: "central", id: "zp1", x: 0, y: 1.5, w: 6, h: 3, tiles: { x: 12, y: 6 },
      res: { x: 2304, y: 1152 }, peso: 300, amp: 30, tipo: "led", cor: "#2E7BFF" }
  ]
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
await pagina.waitForTimeout(1200);

await pagina.evaluate(async (p) => {
  const caixa = document.getElementById("colagem");
  caixa.value = JSON.stringify(p);
  caixa.dispatchEvent(new Event("input", { bubbles: true }));
  document.getElementById("btCarregar").click();
  await new Promise((r) => setTimeout(r, 2200));
}, PROJETO);

// Palco, régie e uma peça de cada família extra na cena.
await pagina.evaluate(async () => {
  const p = (id, v) => {
    const e = document.getElementById(id);
    e.value = String(v);
    e.dispatchEvent(new Event("input", { bubbles: true }));
  };
  ["verPalco", "verRegie"].forEach((id) => {
    const c = document.getElementById(id);
    if (c && !c.checked) c.click();
  });
  p("palcoL", 12); p("palcoP", 6); p("palcoA", 1);
  await new Promise((r) => setTimeout(r, 1400));
  document.getElementById("btAddPalco").click();
  await new Promise((r) => setTimeout(r, 700));
  document.getElementById("btAddPassarela").click();
  await new Promise((r) => setTimeout(r, 700));
  document.getElementById("btAddRegie").click();
  await new Promise((r) => setTimeout(r, 1400));
});

/** Abre o painel de uma peça pelo rótulo e devolve o que lá está escrito. */
const abrir = (rotulo) => pagina.evaluate(async (r) => {
  const alvo = window.preview.objetosArrastaveis().find((a) => a.rotulo === r);
  if (!alvo) return { falta: true };
  window.preview.abrirPainelDeAjuste(alvo);
  await new Promise((x) => setTimeout(x, 200));
  const caixa = document.getElementById("painelAjuste");
  const medida = caixa.querySelector(".ajuste-posicao");
  const onde = new window.preview.THREE.Vector3();
  // Lido da cena viva, não do alvo que o painel guardou.
  let obj = null;
  window.preview.desenhado.traverse((o) => {
    if (!obj && o.name === alvo.obj.name && (!alvo.obj.isMesh || o.isMesh)) obj = o;
  });
  (obj || alvo.obj).getWorldPosition(onde);
  return {
    rotulos: [...caixa.querySelectorAll(".ajuste-campo .ajuste-rotulo")].map((e) => e.textContent),
    medida: medida ? medida.textContent : null,
    mundo: { x: +onde.x.toFixed(3), z: +onde.z.toFixed(3) }
  };
}, rotulo);

// A medida escreve-se com o mesmo nsin() das etiquetas da cena: "+3,00",
// "−12,00", "0". Aqui faz-se a conta ao contrário, para comparar números e
// não textos.
function lerMedida(texto) {
  if (!texto) return null;
  const nums = texto.match(/[+−-]?\d+(?:,\d+)?/g);
  if (!nums || nums.length < 2) return null;
  const n = (t) => parseFloat(t.replace("−", "-").replace(",", "."));
  return { x: n(nums[0]), z: n(nums[1]) };
}

console.log("\n== a medida do painel é a posição real, em todas as famílias ==");
const familias = ["Palco", "central", "Palco 1", "Passarela 1", "Régie 1", "Régie"];
const vistos = {};
for (const nome of familias) {
  const r = await abrir(nome);
  vistos[nome] = r;
  if (r.falta) { conferir(false, nome + ": não está na cena"); continue; }
  const m = lerMedida(r.medida);
  const bate = m && Math.abs(m.x - r.mundo.x) <= 0.01 && Math.abs(m.z - r.mundo.z) <= 0.01;
  conferir(bate, `${nome.padEnd(12)} painel «${r.medida}» · cena x=${r.mundo.x} z=${r.mundo.z}`);
}

console.log("\n== «fundo» só onde o campo é mesmo a coordenada da sala ==");
// Nestas, o campo escreve a coordenada do mundo: o nome dele pode dizer fundo.
["Palco 1", "Passarela 1", "Régie 1", "Régie"].forEach((nome) => {
  const r = vistos[nome];
  if (!r || r.falta) return;
  conferir(r.rotulos.includes("fundo") && r.rotulos.includes("lado"),
    `${nome.padEnd(12)} campos: ${r.rotulos.join(" · ")}`);
});
// Nestas é um deslocamento -- e aí a palavra "fundo" seria uma mentira.
["Palco", "central"].forEach((nome) => {
  const r = vistos[nome];
  if (!r || r.falta) return;
  conferir(!r.rotulos.includes("fundo") && r.rotulos.includes("↕"),
    `${nome.padEnd(12)} campos: ${r.rotulos.join(" · ")} (deslocamento)`);
});

console.log("\n== a medida acompanha o que se escreve ==");
// O ecrã é o pior caso: o campo fica a 0 e a peça anda na mesma.
const escrito = await pagina.evaluate(async () => {
  const antes = document.querySelector("#painelAjuste .ajuste-posicao").textContent;
  const alvo = window.preview.objetosArrastaveis().find((a) => a.rotulo === "central");
  window.preview.abrirPainelDeAjuste(alvo);
  await new Promise((r) => setTimeout(r, 200));
  const campo = [...document.querySelectorAll("#painelAjuste .ajuste-campo")]
    .find((c) => c.querySelector(".ajuste-rotulo").textContent === "↕");
  const input = campo.querySelector("input");
  input.value = "4";
  input.dispatchEvent(new Event("input", { bubbles: true }));
  await new Promise((r) => setTimeout(r, 1400));
  const onde = new window.preview.THREE.Vector3();
  let obj = null;
  window.preview.desenhado.traverse((o) => { if (!obj && o.name === "zona central") obj = o; });
  obj.getWorldPosition(onde);
  return { antes, depois: document.querySelector("#painelAjuste .ajuste-posicao").textContent,
           campo: input.value, mundo: +onde.z.toFixed(2) };
});
const mEscrito = lerMedida(escrito.depois);
conferir(escrito.campo === "4", "escreveu-se 4 no campo ↕ do ecrã");
conferir(mEscrito && Math.abs(mEscrito.z - escrito.mundo) <= 0.01,
  `a medida diz «${escrito.depois}» e a peça está em z=${escrito.mundo}`);
conferir(Math.abs(mEscrito.z - 4) > 1,
  "e não é o 4 que se escreveu — é por isso que a medida faz falta (" + mEscrito.z + ")");

console.log("\n== a medida acompanha o arrasto ==");
const arrasto = await pagina.evaluate(async () => {
  const alvo = window.preview.objetosArrastaveis().find((a) => a.rotulo === "Palco 1");
  window.preview.abrirPainelDeAjuste(alvo);
  await new Promise((r) => setTimeout(r, 200));
  const antes = document.querySelector("#painelAjuste .ajuste-posicao").textContent;
  alvo.setXZ(alvo.getXZ().x + 3, alvo.getXZ().z + 2);
  window.preview.montar(false);
  await new Promise((r) => setTimeout(r, 1200));
  return { antes, depois: document.querySelector("#painelAjuste .ajuste-posicao").textContent };
});
const a1 = lerMedida(arrasto.antes), a2 = lerMedida(arrasto.depois);
conferir(a1 && a2 && Math.abs((a2.x - a1.x) - 3) <= 0.01 && Math.abs((a2.z - a1.z) - 2) <= 0.01,
  `«${arrasto.antes}» → «${arrasto.depois}»`);

console.log("\n== «subir» sobe mesmo ==");
const subiu = await pagina.evaluate(async () => {
  const THREE = window.preview.THREE;
  const alturaDe = (rotulo) => {
    const a = window.preview.objetosArrastaveis().find((x) => x.rotulo === rotulo);
    if (!a) return null;
    const w = new THREE.Vector3();
    let obj = null;
    window.preview.desenhado.traverse((o) => {
      if (!obj && o.name === a.obj.name && (!a.obj.isMesh || o.isMesh)) obj = o;
    });
    (obj || a.obj).getWorldPosition(w);
    return +w.y.toFixed(3);
  };
  const quais = ["Palco 1", "Passarela 1", "Régie 1"];
  const antes = {}; quais.forEach((q) => { antes[q] = alturaDe(q); });
  window.preview.objetosArrastaveis().forEach((a) => {
    if (quais.includes(a.rotulo)) a.ajuste.dy = 1.5;
  });
  window.preview.montar(false);
  await new Promise((r) => setTimeout(r, 1400));
  const depois = {}; quais.forEach((q) => { depois[q] = alturaDe(q); });
  return { antes, depois };
});
Object.keys(subiu.antes).forEach((q) => {
  const d = subiu.depois[q] - subiu.antes[q];
  conferir(Math.abs(d - 1.5) <= 0.01, `${q.padEnd(12)} y ${subiu.antes[q]} → ${subiu.depois[q]} (subir 1,5)`);
});

console.log("\n== no grupo, a medida é o meio das peças — e o eixo da rotação ==");
const grupo = await pagina.evaluate(async () => {
  const nomes = ["Palco 1", "Passarela 1"];
  const alvos = window.preview.objetosArrastaveis().filter((a) => nomes.includes(a.rotulo));
  window.preview.limparSelecao();
  alvos.forEach((a) => window.preview.selecaoDeGrupo.add(a.obj.name));
  window.preview.abrirPainelDeGrupo();
  await new Promise((r) => setTimeout(r, 300));
  const texto = document.querySelector("#painelAjuste .ajuste-posicao").textContent;
  const c = window.preview.centroDoGrupo(window.preview.alvosSelecionados());
  const antes = { x: +c.x.toFixed(3), z: +c.z.toFixed(3) };
  window.preview.rodarGrupo(90);
  await new Promise((r) => setTimeout(r, 1400));
  const c2 = window.preview.centroDoGrupo(window.preview.alvosSelecionados());
  return { texto, antes, depois: { x: +c2.x.toFixed(3), z: +c2.z.toFixed(3) },
           depoisTexto: document.querySelector("#painelAjuste .ajuste-posicao").textContent };
});
const mg = lerMedida(grupo.texto);
conferir(mg && Math.abs(mg.x - grupo.antes.x) <= 0.01 && Math.abs(mg.z - grupo.antes.z) <= 0.01,
  `«${grupo.texto}» é o meio das duas peças (x=${grupo.antes.x} z=${grupo.antes.z})`);
conferir(Math.abs(grupo.depois.x - grupo.antes.x) <= 0.02 &&
         Math.abs(grupo.depois.z - grupo.antes.z) <= 0.02,
  `rodar 90° não arrasta o eixo: ${grupo.antes.x};${grupo.antes.z} → ${grupo.depois.x};${grupo.depois.z}`);

console.log("\n== sem erros na consola ==");
conferir(erros.length === 0, erros.length ? erros.join(" | ") : "nenhum");

await browser.close();
s.close();
console.log(falhas ? `\n${falhas} falha(s).` : "\nTudo certo.");
process.exit(falhas ? 1 : 0);
