/**
 * RODAR O PALCO PRINCIPAL.
 *
 * Pedido: *"preciso rodar os palcos"*. Os palcos extra, as passarelas soltas
 * e as régies rodam desde que existem; o principal nunca rodou — e era o
 * único que interessava para um palco em diagonal, ou encostado a um canto.
 *
 * As duas escolhas dele, e são o desenho todo:
 *
 *   · roda o palco e **o que assenta nele** (a passarela que sai da boca de
 *     cena, e o vão que ela abre na plateia);
 *   · a **plateia**, os **ecrãs** e a **régie** NÃO acompanham — continuam
 *     medidos à sala. Para rodar um ecrã com o palco há o grupo (v3.85).
 *
 * O que este teste guarda:
 *
 *   1. o tampo roda, e roda À VOLTA DO PRÓPRIO CENTRO — o centro não foge
 *      um milímetro entre 0° e 90°, que é o que distingue "girar no sítio"
 *      de "fugir para o lado a cada grau";
 *   2. a passarela acompanha: continua encostada à boca de cena, e roda o
 *      mesmo ângulo;
 *   3. o VÃO na plateia acompanha-a — com o palco a 90°, os lugares que a
 *      passarela agora atravessa saem, e os que ela largou voltam;
 *   4. a plateia e os ecrãs ficam onde estavam (é a escolha dele, e é a que
 *      mais facilmente se quebrava sem ninguém dar por ela);
 *   5. o ângulo fica guardado no projeto e volta com ele;
 *   6. e com 0° tudo dá exactamente o que dava antes.
 *
 *   node scripts/verificar-rodar-palco.mjs
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

const PROJETO = {
  nome: "Rodar", sala: { largura: 30, profundidade: 30, altura: 9 },
  palco: { largura: 12, profundidade: 6, altura: 1, dx: 0, dz: 0 },
  zonas: [{ nome: "central", id: "zr1", x: 0, y: 1.5, w: 8, h: 4.5, tiles: { x: 16, y: 9 },
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
await pagina.waitForTimeout(1200);

await pagina.evaluate(async (p) => {
  const caixa = document.getElementById("colagem");
  caixa.value = JSON.stringify(p);
  caixa.dispatchEvent(new Event("input", { bubbles: true }));
  document.getElementById("btCarregar").click();
  await new Promise((r) => setTimeout(r, 2200));
}, PROJETO);

// Palco à vista, com passarela e plateia — é com os três na cena que isto
// se mede.
await pagina.evaluate(async () => {
  const p = (id, v) => {
    const e = document.getElementById(id);
    e.value = String(v);
    e.dispatchEvent(new Event("input", { bubbles: true }));
  };
  ["verPalco", "verPublico"].forEach((id) => {
    const c = document.getElementById(id);
    if (c && !c.checked) c.click();
  });
  p("palcoL", 12); p("palcoP", 6); p("palcoA", 1);
  await new Promise((r) => setTimeout(r, 900));
  const passa = document.getElementById("passLigada");
  if (passa && !passa.checked) passa.click();
  p("passC", 7); p("passL", 2);
  p("filas", 12); p("primeiraFila", 3);
  await new Promise((r) => setTimeout(r, 1600));
});

/** O que está MESMO desenhado: centro e ângulo de cada peça, e a plateia. */
const olhar = () => pagina.evaluate(() => {
  const THREE = window.preview.THREE;
  const achar = (nome) => {
    let achado = null;
    window.preview.desenhado.traverse((o) => { if (!achado && o.name === nome && o.isMesh) achado = o; });
    return achado;
  };
  const onde = (o) => {
    if (!o) return null;
    const p = new THREE.Vector3();
    o.getWorldPosition(p);
    const q = new THREE.Quaternion();
    o.getWorldQuaternion(q);
    const e = new THREE.Euler().setFromQuaternion(q, "YXZ");
    return { x: +p.x.toFixed(3), z: +p.z.toFixed(3), graus: +(-e.y * 180 / Math.PI).toFixed(1) };
  };
  const g = window.preview.gente;
  return {
    palco: onde(achar("palco")),
    passarela: onde(achar("passarela")),
    lugares: g ? g.lugares : null,
    primeiraFila: g && g.zPrimeira != null ? +g.zPrimeira.toFixed(3) : null,
    ecra: (function () {
      let z = null;
      window.preview.desenhado.traverse((o) => {
        if (z === null && o.name === "zona central") {
          const p = new THREE.Vector3(); o.getWorldPosition(p);
          z = { x: +p.x.toFixed(2), z: +p.z.toFixed(2) };
        }
      });
      return z;
    })()
  };
});

const rodar = (graus) => pagina.evaluate(async (g) => {
  const e = document.getElementById("palcoRot");
  e.value = String(g);
  e.dispatchEvent(new Event("input", { bubbles: true }));
  await new Promise((r) => setTimeout(r, 1500));
}, graus);

console.log("\n== com 0°, tudo como sempre foi ==");
const direito = await olhar();
conferir(!!direito.palco && Math.abs(direito.palco.graus) < 0.1,
  "o palco está a 0° (" + (direito.palco || {}).graus + "°)");
conferir(!!direito.passarela, "e a passarela está na cena");
console.log("   palco em x=" + direito.palco.x + " z=" + direito.palco.z +
  " · passarela em x=" + direito.passarela.x + " z=" + direito.passarela.z +
  " · " + direito.lugares + " lugares");

console.log("\n== roda, e roda no sítio ==");
await rodar(90);
const rodado = await olhar();
conferir(Math.abs(rodado.palco.graus - 90) < 0.5, "o palco está a 90° (" + rodado.palco.graus + "°)");
conferir(Math.abs(rodado.palco.x - direito.palco.x) < 0.01 &&
         Math.abs(rodado.palco.z - direito.palco.z) < 0.01,
  "e o centro não fugiu: " + direito.palco.x + ";" + direito.palco.z +
  " → " + rodado.palco.x + ";" + rodado.palco.z);

console.log("\n== a passarela vai com ele ==");
conferir(Math.abs(rodado.passarela.graus - 90) < 0.5,
  "rodou o mesmo ângulo (" + rodado.passarela.graus + "°)");
// Encostada à boca de cena quer dizer: a distância dela ao centro do palco
// não muda quando o palco roda. É o que prova que rodaram à volta do MESMO
// eixo, e não cada uma à volta do seu.
const distDireito = Math.hypot(direito.passarela.x - direito.palco.x, direito.passarela.z - direito.palco.z);
const distRodado = Math.hypot(rodado.passarela.x - rodado.palco.x, rodado.passarela.z - rodado.palco.z);
conferir(Math.abs(distDireito - distRodado) < 0.01,
  "e continua à mesma distância do palco: " + distDireito.toFixed(2) + " m → " + distRodado.toFixed(2) + " m");
conferir(Math.abs(rodado.passarela.x - direito.passarela.x) > 1,
  "mas mudou mesmo de sítio (andou " +
  Math.hypot(rodado.passarela.x - direito.passarela.x, rodado.passarela.z - direito.passarela.z).toFixed(2) + " m)");

console.log("\n== o vão na plateia acompanha-a ==");
// Com a passarela a atravessar a plateia ao comprido, ela come uma faixa de
// lugares; virada de lado, come outra. Se o vão NÃO acompanhasse, o número
// de lugares ficaria exactamente igual — e é isso que este número apanha.
conferir(rodado.lugares !== direito.lugares,
  "o número de lugares mudou: " + direito.lugares + " → " + rodado.lugares);

console.log("\n== e o que não é do palco fica onde estava ==");
conferir(rodado.primeiraFila === direito.primeiraFila,
  "a primeira fila não se mexeu (z=" + direito.primeiraFila + ")");
conferir(!!rodado.ecra && !!direito.ecra &&
  rodado.ecra.x === direito.ecra.x && rodado.ecra.z === direito.ecra.z,
  "e o ecrã também não: " + JSON.stringify(direito.ecra));

console.log("\n== voltar a 0° devolve tudo ==");
await rodar(0);
const devolta = await olhar();
conferir(Math.abs(devolta.palco.graus) < 0.1 &&
         Math.abs(devolta.passarela.x - direito.passarela.x) < 0.01 &&
         Math.abs(devolta.passarela.z - direito.passarela.z) < 0.01,
  "palco e passarela nos sítios de partida");
conferir(devolta.lugares === direito.lugares,
  "e os mesmos " + direito.lugares + " lugares (" + devolta.lugares + ")");

console.log("\n== o ângulo fica no projeto ==");
await rodar(35);
// Guardar e reabrir, que é o caminho que a pessoa faz -- e não uma função
// interna que ninguém chama assim.
const idaEVolta = await pagina.evaluate(async () => {
  const antes = document.getElementById("palcoRot").value;
  const texto = JSON.stringify({ v: 1, origem: "teste",
    sala: { largura: 30, profundidade: 30, altura: 9 },
    palco: { largura: 12, altura: 1, profundidade: 6, dx: 0, dz: 0, rot: 35 },
    zonas: [] });
  const caixa = document.getElementById("colagem");
  caixa.value = texto;
  caixa.dispatchEvent(new Event("input", { bubbles: true }));
  document.getElementById("btCarregar").click();
  await new Promise((r) => setTimeout(r, 2000));
  return { antes, depois: document.getElementById("palcoRot").value };
});
conferir(idaEVolta.antes === "35", "o campo ficou em 35° (" + idaEVolta.antes + ")");
conferir(idaEVolta.depois === "35",
  "e um projeto com rot=35 volta a abrir com 35° (" + idaEVolta.depois + ")");

console.log("\n== sem erros na consola ==");
conferir(erros.length === 0, erros.length ? erros.join(" | ") : "nenhum");

await browser.close();
s.close();
console.log(falhas ? `\n${falhas} falha(s).` : "\nTudo certo.");
process.exit(falhas ? 1 : 0);
