/**
 * O PALCO VAI PARA ONDE A PLANTA MANDA — E LEVA CONSIGO O QUE ASSENTA NELE.
 *
 * Pedido: *"eu não tinha modo de mover livre o palco... tenho uma planta e
 * quero pô-lo no sítio certo"*. E estava certo: os palcos EXTRA já se
 * arrastavam desde que existem, o principal nunca -- nascia sempre encostado
 * ao fundo da sala e centrado à largura.
 *
 * A razão de nunca se ter mexido é o que este teste guarda. O palco principal
 * não é uma peça como as outras: é O REFERENCIAL da cena. Saem dele a primeira
 * fila da plateia, o ponto à volta do qual os gomos rodam, onde a passarela
 * começa, onde o orador se põe e onde os DSM assentam. Movê-lo sem mais nada
 * era mover o palco e deixar tudo isso para trás -- gente sentada em cima do
 * tampo, uma passarela a sair do nada, monitores a flutuar.
 *
 * A regra, e é o que se mede aqui:
 *
 *   o que ASSENTA no palco ou se MEDE a partir dele anda com ele;
 *   o que está preso à SALA fica onde estava.
 *
 * Do lado que anda: a plateia em Z (a "primeira fila a X m" é medida ao
 * palco), a passarela, o orador, os DSM. Do lado que fica: os ecrãs, que
 * nascem da parede do fundo, e a plateia na LARGURA, que se centra na sala
 * porque é aí que as cadeiras cabem.
 *
 *   node scripts/verificar-palco.mjs
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

// Um projeto com ecrã, para os ecrãs também entrarem na conta.
await pagina.goto(`http://127.0.0.1:${porta}/index.html`, { waitUntil: "networkidle" });
await pagina.evaluate(() => {
  localStorage.setItem("mikeapps-sincronizacao-v1", JSON.stringify("ligada"));
  localStorage.setItem("mikeapps-projeto-v1", JSON.stringify({
    nome: "Palco", origem: "calculadores",
    sala: { largura: 24, profundidade: 30, altura: 9 },
    zonas: [{ nome: "Ecrã", id: "z1", x: 0, y: 0, w: 8, h: 4.5, cor: "#2e7bff", tipo: "led" }]
  }));
});
await pagina.reload({ waitUntil: "networkidle" });
await pagina.waitForFunction(() => window.preview && window.preview.montar, null, { timeout: 30000 });
await pagina.waitForTimeout(1200);

/** Põe o palco num sítio e devolve onde ficou tudo o que depende dele. */
const comOPalcoEm = (dx, dz) => pagina.evaluate(async ([dx, dz]) => {
  const por = (id, v) => { const el = document.getElementById(id);
    if (!el) return;
    if (el.type === "checkbox") el.checked = !!v; else el.value = String(v);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true })); };
  por("salaL", 24); por("salaP", 30); por("salaA", 9);
  por("palcoL", 12); por("palcoA", 1); por("palcoP", 6);
  por("filas", 10); por("primeiraFila", 4); por("entreFilas", 0.9);
  por("verPublico", true); por("verPalco", true);
  por("passLigada", true); por("passL", 1.5); por("passC", 4); por("passX", 0);
  por("palcoX", dx); por("palcoZ", dz);
  await new Promise((r) => setTimeout(r, 1500));

  const onde = (nome) => {
    let achado = null;
    window.preview.cena.traverse((o) => {
      if (achado || o.name !== nome || !o.isMesh) return;
      const v = new window.preview.THREE.Vector3();
      o.getWorldPosition(v);
      achado = { x: +v.x.toFixed(3), z: +v.z.toFixed(3) };
    });
    return achado;
  };
  const g = window.preview.gente;
  let ecra = null;
  window.preview.cena.traverse((o) => {
    if (ecra || o.name !== "zona Ecrã") return;
    const v = new window.preview.THREE.Vector3();
    o.getWorldPosition(v);
    ecra = { x: +v.x.toFixed(3), z: +v.z.toFixed(3) };
  });
  return {
    palco: onde("palco"),
    passarela: onde("passarela"),
    primeiraFila: g && g.filasInfo && g.filasInfo.length ? +g.filasInfo[0].z.toFixed(3) : null,
    lugares: g ? g.lugares : null,
    ecra: ecra
  };
}, [dx, dz]);

// ---- 1. Onde sempre nasceu -----------------------------------------------
console.log("\n== o palco no sítio de sempre (0, 0) ==");
const base = await comOPalcoEm(0, 0);
console.log("   " + JSON.stringify(base));
conferir(base.palco && perto(base.palco.x, 0),
  "centrado na largura da sala");
conferir(base.palco && perto(base.palco.z, -30 / 2 + 6 / 2),
  "e encostado ao fundo (z = −P/2 + profundidade/2 = −12,00)");
conferir(base.primeiraFila != null && perto(base.primeiraFila, -30 / 2 + 6 + 4),
  "a primeira fila a 4 m da boca de cena (z = −5,00)");

// ---- 2. Movido de lado ---------------------------------------------------
//
// Em X: o palco anda, e com ele o que assenta nele. A plateia NÃO -- as
// cadeiras centram-se na sala, que é onde elas cabem.
console.log("\n== 3 m para o lado ==");
const lado = await comOPalcoEm(3, 0);
console.log("   " + JSON.stringify(lado));
conferir(lado.palco && perto(lado.palco.x, 3), "o palco andou os 3 m");
conferir(lado.passarela && perto(lado.passarela.x, 3),
  "a passarela foi com ele — sai da boca de cena, não da sala");
conferir(lado.primeiraFila != null && perto(lado.primeiraFila, base.primeiraFila),
  "a plateia não se mexeu em Z (nada mudou na distância ao palco)");
// A primeira versão desta linha exigia EXACTAMENTE os mesmos lugares, e
// falhou por um: 358 -> 357. E a app tinha razão -- a passarela andou com o
// palco, e o vão que ela abre na plateia passou a comer outra cadeira. O que
// aqui interessa é que a plateia não se APERTOU contra parede nenhuma, não
// que o número fique cravado.
conferir(Math.abs(lado.lugares - base.lugares) <= 2,
  "e a plateia não se apertou contra parede nenhuma (" + base.lugares + " -> " +
  lado.lugares + ": o vão da passarela mudou de sítio com o palco)");
conferir(lado.ecra && base.ecra && perto(lado.ecra.z, base.ecra.z),
  "o ecrã ficou onde estava: nasce da parede do fundo, não do palco");

// ---- 3. Trazido para dentro da sala --------------------------------------
//
// É AQUI QUE ESTÁ O RISCO TODO. Em Z o palco é o referencial: se a plateia
// não o acompanhar, fica gente sentada em cima do tampo.
console.log("\n== 4 m para dentro da sala ==");
const dentro = await comOPalcoEm(0, 4);
console.log("   " + JSON.stringify(dentro));
conferir(dentro.palco && perto(dentro.palco.z, base.palco.z + 4),
  "o palco veio os 4 m para dentro");
conferir(dentro.primeiraFila != null && perto(dentro.primeiraFila, base.primeiraFila + 4),
  "a plateia acompanhou — a «primeira fila a 4 m» continua a ser 4 m AO PALCO");
const folga = dentro.primeiraFila - (dentro.palco.z + 6 / 2);
console.log("   entre a boca de cena e a primeira fila: " + folga.toFixed(2) + " m");
conferir(perto(folga, 4, 0.05),
  "ninguém ficou sentado em cima do tampo — a folga é a que se pediu");
conferir(dentro.passarela && perto(dentro.passarela.z, base.passarela.z + 4),
  "a passarela também veio (começa na boca de cena)");

// ---- 4. E os dois ao mesmo tempo, que é o caso real ----------------------
console.log("\n== os dois juntos (−2,5 · 3) ==");
const ambos = await comOPalcoEm(-2.5, 3);
console.log("   " + JSON.stringify(ambos));
conferir(ambos.palco && perto(ambos.palco.x, -2.5) && perto(ambos.palco.z, base.palco.z + 3),
  "o palco foi para onde se lhe mandou");
conferir(ambos.passarela && perto(ambos.passarela.x, -2.5)
  && perto(ambos.passarela.z, base.passarela.z + 3),
  "e a passarela continua colada a ele nos dois eixos");

// ---- 5. Um projeto de ANTES disto existir --------------------------------
console.log("\n== um projeto guardado antes disto ==");
const antigo = await pagina.evaluate(async () => {
  // Um palco sem dx/dz nenhum, como todos os que estão gravados.
  const p = { largura: 12, altura: 1, profundidade: 6, acimaDoPalco: 0, raio: 0 };
  const sala = { largura: 24, profundidade: 30, altura: 9 };
  const f = window.preview.frenteDoPalco
    ? window.preview.frenteDoPalco(sala, p) : null;
  return f;
});
console.log("   frente do palco: " + JSON.stringify(antigo));
conferir(antigo && antigo.x === 0 && Math.abs(antigo.z - (-15 + 6)) < 1e-9,
  "sem deslocamento nenhum fica exactamente onde sempre esteve — nada muda debaixo dos pés");

// ---- 6. E arrasta-se na cena --------------------------------------------
console.log("\n== agarrável com o cadeado aberto ==");
const agarravel = await pagina.evaluate(() => {
  const alvos = window.preview.objetosArrastaveis();
  const palcos = alvos.filter((a) => a.rotulo === "Palco");
  return { quantos: palcos.length,
           campos: palcos.length ? palcos[0].campos.map((c) => c.chave) : [] };
});
console.log("   " + JSON.stringify(agarravel));
conferir(agarravel.quantos === 1,
  "o palco principal está na lista dos agarráveis — e UMA vez só");
// Desde a v3.88 o palco principal também RODA (*"preciso rodar os palcos"*),
// por isso o painel dele tem três campos e não dois.
conferir(agarravel.campos.join(",") === "dx,dz,rot",
  "com os dois eixos e o ângulo para ajustar à mão");

conferir(erros.length === 0, erros.length ? "erro de JavaScript: " + erros[0] : "sem erros de JavaScript");

await browser.close();
s.close();
console.log("\n" + (falhas ? falhas + " FALHA(S)"
  : "O palco vai para onde se lhe manda, e leva consigo o que assenta nele."));
process.exit(falhas ? 1 : 0);
