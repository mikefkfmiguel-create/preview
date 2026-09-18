/**
 * UMA FILA PODE FUGIR À REGRA DO BLOCO.
 *
 * Pedido a olhar para uma plateia desenhada: *"se quiser ter números
 * diferentes de lugares por fila"*, e logo com o caso a sério, a apontar para
 * a planta de um teatro: *"na imagem a fila A tem apenas 5 lugares nas
 * margens"*.
 *
 * A forma foi escolha dele, entre quatro: **por bloco E por fila**. Escreve-se
 * como se diz -- `1,3: A = 5` -- uma por linha.
 *
 * O que este teste guarda, além de a conta bater certo:
 *
 *   1. os CORREDORES NÃO SE MEXEM. A fila curta desenha-se centrada dentro do
 *      bloco dela; recentrar cada fila pela largura dela punha os corredores em
 *      ziguezague, e um corredor que serpenteia não é um corredor;
 *   2. uma linha que não se percebe é DITA, não comida. Comer uma linha mal
 *      escrita deixava a lotação antiga no ecrã e alguém levava esse número
 *      para a obra;
 *   3. e sem excepções nenhumas a plateia é exactamente a de antes -- isto não
 *      pode mudar as salas de quem nunca vai usar o campo.
 *
 *   node scripts/verificar-excecoes-de-lugares.mjs
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
await pagina.waitForTimeout(1200);

const montar = (campos) => pagina.evaluate(async (campos) => {
  Object.keys(campos).forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    const v = campos[id];
    if (el.type === "checkbox") el.checked = !!v; else el.value = String(v);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await new Promise((r) => setTimeout(r, 1600));
}, campos);

// O que a app desenhou MESMO, fila a fila e bloco a bloco: lê-se das moradas
// que ela dá a cada lugar, não de uma cópia da conta escrita aqui.
const plateia = () => pagina.evaluate(() => {
  const g = window.preview.gente;
  if (!g) return null;
  const porFila = {};
  const xPorFilaBloco = {};
  for (let i = 0; i < g.filaPorLugar.length; i++) {
    const f = g.filaPorLugar[i], b = g.blocoPorLugar[i];
    porFila[f] = porFila[f] || {};
    porFila[f][b] = (porFila[f][b] || 0) + 1;
    const x = g.corpos[i * 4];
    const chave = f + "/" + b;
    if (!xPorFilaBloco[chave]) xPorFilaBloco[chave] = { min: x, max: x };
    xPorFilaBloco[chave].min = Math.min(xPorFilaBloco[chave].min, x);
    xPorFilaBloco[chave].max = Math.max(xPorFilaBloco[chave].max, x);
  }
  return { lugares: g.lugares, filas: g.filas, porFila, xPorFilaBloco,
           nota: (document.getElementById("notaExcecoes") || {}).textContent || "" };
});

// Uma sala com três blocos (2 corredores), 12/18/12 como a dele -- e LARGA o
// suficiente para os 42 lugares e os dois corredores caberem com folga
// (42 x 0,55 + 2 x 1,2 = 25,5 m). A primeira versão deste teste pôs 26 m de
// sala: os lugares das pontas caíam fora das margens, as filas pares e ímpares
// perdiam lugares diferentes (o desencontro de meio lugar), e o que eu estava a
// medir deixava de ser a excepção -- era a sala a não dar.
const SALA = { salaL: 30, salaP: 22, salaA: 8, verPalco: true, palcoL: 10, palcoP: 4, palcoA: 1,
               verPublico: true, filas: 8, corredores: 2, entreLugares: 0.55,
               larguraCorredor: 1.2, primeiraFila: 3.5, entreFilas: 0.95, inclinacao: 0 };

console.log("\n== sem excepções nenhumas: a plateia de sempre ==");
await montar(SALA);
await pagina.evaluate(async () => {
  const caixas = [...document.querySelectorAll("#lugaresPorBloco input")];
  [12, 18, 12].forEach((n, i) => {
    if (!caixas[i]) return;
    caixas[i].value = String(n);
    caixas[i].dispatchEvent(new Event("input", { bubbles: true }));
  });
  await new Promise((r) => setTimeout(r, 1800));
});
const antes = await plateia();
const filaA = antes ? antes.porFila[0] : null;
console.log("   fila A: " + JSON.stringify(filaA) + " · total " + (antes ? antes.lugares : "—"));
conferir(!!filaA && filaA[0] === 12 && filaA[1] === 18 && filaA[2] === 12,
  "a fila A leva 12 / 18 / 12, como os blocos dizem");

// ---- 1. O CASO DELE: a fila A com 5 lugares nas margens ---------------
console.log("\n== «na imagem a fila A tem apenas 5 lugares nas margens» ==");
await montar({ excecoesLugares: "1,3: A = 5" });
const comExcecao = await plateia();
console.log("   fila A: " + JSON.stringify(comExcecao.porFila[0]));
console.log("   fila B: " + JSON.stringify(comExcecao.porFila[1]));
conferir(comExcecao.porFila[0][0] === 5 && comExcecao.porFila[0][2] === 5,
  "a fila A leva 5 nos blocos das margens");
conferir(comExcecao.porFila[0][1] === 18,
  "e o bloco do meio fica como estava — a excepção é só de quem foi nomeado");
conferir(comExcecao.porFila[1][0] === 12 && comExcecao.porFila[1][2] === 12,
  "a fila B continua com 12 — a excepção é de UMA fila");
conferir(antes.lugares - comExcecao.lugares === 14,
  "e a lotação desce exactamente 14 (7 + 7 que a fila A perdeu)");

// ---- 2. OS CORREDORES NÃO SE MEXEM ------------------------------------
//
// É o que separa isto de "cada fila centrada por si": os blocos ficam onde a
// fila cheia os pôs, e a fila curta encolhe pelas duas pontas.
console.log("\n== e os corredores continuam a direito ==");
const meioA = comExcecao.xPorFilaBloco["0/1"];
const meioB = comExcecao.xPorFilaBloco["1/1"];
console.log("   bloco do meio — fila A: " + meioA.min.toFixed(2) + ".." + meioA.max.toFixed(2) +
            " · fila B: " + meioB.min.toFixed(2) + ".." + meioB.max.toFixed(2));
conferir(Math.abs((meioA.min + meioA.max) / 2 - (meioB.min + meioB.max) / 2) < 0.3,
  "o bloco do meio está no mesmo sítio nas duas filas");
const esqA = comExcecao.xPorFilaBloco["0/0"], esqB = comExcecao.xPorFilaBloco["1/0"];
console.log("   bloco da esquerda — fila A: " + esqA.min.toFixed(2) + ".." + esqA.max.toFixed(2) +
            " · fila B: " + esqB.min.toFixed(2) + ".." + esqB.max.toFixed(2));
conferir(esqA.min > esqB.min + 0.5 && esqA.max < esqB.max + 0.5,
  "e a fila curta encolheu pelas duas pontas, centrada no bloco dela");

// ---- 3. Um intervalo de filas, e a última linha a mandar --------------
console.log("\n== «2: A-C = 14», e uma linha a corrigir a anterior ==");
await montar({ excecoesLugares: "2: A-C = 14\n2: B = 16" });
const intervalo = await plateia();
console.log("   bloco do meio nas filas A, B, C: " +
  [0, 1, 2].map((f) => intervalo.porFila[f][1]).join(", "));
conferir(intervalo.porFila[0][1] === 14 && intervalo.porFila[2][1] === 14,
  "A e C levam os 14 do intervalo");
conferir(intervalo.porFila[1][1] === 16,
  "e a B leva 16 — a última linha que apanha a fila é a que manda");
conferir(intervalo.porFila[3][1] === 18,
  "a fila D, que ninguém nomeou, fica com os 18 do bloco");

// ---- 4. Uma linha que não se percebe é DITA ----------------------------
console.log("\n== uma linha mal escrita ==");
await montar({ excecoesLugares: "1,3: A = 5\nisto não é uma excepção" });
const comErro = await plateia();
console.log("   " + comErro.nota.slice(0, 150));
conferir(/não percebi/i.test(comErro.nota),
  "a app diz que não percebeu — comer a linha deixava a lotação antiga no ecrã");
conferir(/isto não é uma excepção/.test(comErro.nota),
  "e diz QUAL é a linha, para se poder emendar");
conferir(comErro.porFila[0][0] === 5,
  "e a linha boa continua a valer — uma má não deita fora as outras");

// ---- 5. Tirar tudo devolve a plateia de sempre -------------------------
console.log("\n== apagar as excepções ==");
await montar({ excecoesLugares: "" });
const voltou = await plateia();
conferir(voltou.lugares === antes.lugares,
  "a lotação volta ao que era (" + voltou.lugares + ")");
conferir(!/não percebi/i.test(voltou.nota), "e a nota volta a explicar, em vez de se queixar");

conferir(erros.length === 0, erros.length ? "erro de JavaScript: " + erros[0] : "sem erros de JavaScript");

await browser.close();
s.close();
console.log("\n" + (falhas ? falhas + " FALHA(S)"
  : "Uma fila pode fugir à regra do bloco — e os corredores continuam a direito."));
process.exit(falhas ? 1 : 0);
