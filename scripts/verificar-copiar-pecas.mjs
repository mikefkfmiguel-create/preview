/**
 * COPIAR ECRÃS, E CONJUNTOS DE ECRÃS.
 *
 * Pedido: *"e no 3D poder fazer cópias de ecrãs e/ou grupos de objetos"*.
 * Havia um ⧉ na lista, mas só para delays (TV/projeção) e um de cada vez — um
 * ecrã LED não se copiava, e um conjunto muito menos.
 *
 * O que este teste guarda:
 *
 *   1. a cópia é MESMO a mesma peça: medidas, tiles, resolução, peso, consumo
 *      e cor vêm todos da original. Uma "cópia" com números redondos
 *      inventados era pior do que não haver cópia;
 *   2. e os AJUSTES desta app vão com ela — copiar um ecrã rodado dá um ecrã
 *      rodado, não um direito;
 *   3. mas o ID é NOVO e o NOME é livre. O id agarra os ajustes à peça certa;
 *      o nome viaja para o Cinema 4D e para a folha de montagem, e dois ecrãs
 *      com o mesmo nome dão uma folha que ninguém confere;
 *   4. a cópia sai AO LADO, não por baixo — por baixo parece que não
 *      aconteceu nada;
 *   5. copiar um CONJUNTO mantém a arrumação entre as peças, e as cópias
 *      ficam marcadas (o movimento seguinte é arrastá-las);
 *   6. e o que não é uma zona do projeto (um gomo, o palco) não ganha um
 *      botão de copiar que não faria nada.
 *
 *   node scripts/verificar-copiar-pecas.mjs
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

// Valores reais de painel (tile de 500 mm com 192 px), para a cópia ter
// alguma coisa a sério para preservar.
const PROJETO = {
  nome: "Copiar", sala: { largura: 24, profundidade: 16, altura: 8 },
  zonas: [
    { nome: "trira", id: "zorig1", x: -4, y: 1.5, w: 1.5, h: 4, tiles: { x: 3, y: 8 },
      res: { x: 576, y: 1536 }, peso: 151.2, amp: 15.6, tipo: "led", cor: "#2E7BFF" },
    { nome: "tiras pequenas", id: "zorig2", x: -1, y: 1.5, w: 1.0, h: 3, tiles: { x: 2, y: 6 },
      res: { x: 384, y: 1152 }, peso: 75.6, amp: 7.8, tipo: "led", cor: "#9085e9" }
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

const zonas = () => pagina.evaluate(() => window.preview.projeto.zonas.map((z) => ({
  nome: z.nome, id: z.id || null, x: +(Number(z.x) || 0).toFixed(2),
  w: z.w, h: z.h, tiles: z.tiles, res: z.res, peso: z.peso, amp: z.amp, cor: z.cor, tipo: z.tipo
})));

const antes = await zonas();
console.log("\n== o projeto, antes ==");
antes.forEach((z) => console.log(`   ${z.nome.padEnd(16)} x=${z.x}  ${z.w}×${z.h} m  ${z.res.x}×${z.res.y} px  ${z.peso} kg`));
conferir(antes.length === 2, "duas zonas para começar");

// ---- 1. Copiar UMA, já rodada -----------------------------------------
//
// Roda-se primeiro: uma cópia que perde a rotação não é uma cópia.
console.log("\n== copiar um ecrã que já está rodado ==");
await pagina.evaluate(async () => {
  const a = window.preview.objetosArrastaveis().find((x) => x.rotulo === "trira");
  a.ajuste.rot = -25;
  a.ajuste.dz = 0.4;
  window.preview.montar(false);
  await new Promise((r) => setTimeout(r, 900));
});
await pagina.evaluate(async () => {
  const a = window.preview.objetosArrastaveis().find((x) => x.rotulo === "trira");
  window.preview.duplicarPecas([a]);
  await new Promise((r) => setTimeout(r, 1200));
});

const depois = await zonas();
depois.forEach((z) => console.log(`   ${z.nome.padEnd(16)} x=${z.x}  ${z.w}×${z.h} m  ${z.res.x}×${z.res.y} px  ${z.peso} kg`));
const original = depois.find((z) => z.nome === "trira");
const copia = depois.find((z) => z.nome === "trira 2");
conferir(depois.length === 3, "há mais uma zona no projeto (" + depois.length + ")");
conferir(!!copia, "e chama-se «trira 2» — nome livre a partir do da original");

// ---- 2. A CÓPIA É A MESMA PEÇA ---------------------------------------
console.log("\n== a cópia leva tudo o que a original tem ==");
conferir(copia.w === original.w && copia.h === original.h, "medidas: " + copia.w + "×" + copia.h + " m");
conferir(JSON.stringify(copia.tiles) === JSON.stringify(original.tiles), "tiles: " + JSON.stringify(copia.tiles));
conferir(JSON.stringify(copia.res) === JSON.stringify(original.res), "resolução: " + copia.res.x + "×" + copia.res.y + " px");
conferir(copia.peso === original.peso && copia.amp === original.amp,
  "peso e consumo: " + copia.peso + " kg, " + copia.amp + " A");
// A COR É A ÚNICA COISA QUE MUDA DE PROPÓSITO. Esta verificação dizia
// "cor e tipo iguais" até 24/09, e passou a falhar no dia em que ele pediu
// *"as cópias devem surgir de cor diferente"* — falhou com razão.
conferir(copia.tipo === original.tipo, "tipo: " + copia.tipo);
conferir(copia.cor && copia.cor !== original.cor,
  "e a cor MUDA de propósito: " + original.cor + " → " + copia.cor);

const ajustes = await pagina.evaluate(() => ({
  original: { ...window.preview.ajustes.delays["trira"] },
  copia: { ...window.preview.ajustes.delays["trira 2"] }
}));
console.log("   ajustes — original: rot=" + ajustes.original.rot + " dz=" + ajustes.original.dz +
            " · cópia: rot=" + ajustes.copia.rot + " dz=" + ajustes.copia.dz);
conferir(ajustes.copia.rot === -25 && Math.abs(ajustes.copia.dz - 0.4) < 0.001,
  "e os ajustes feitos aqui foram com ela — um ecrã rodado copia-se rodado");

// ---- 3. IDENTIDADE PRÓPRIA -------------------------------------------
console.log("\n== mas é uma peça DIFERENTE ==");
// A original TEM de ter id para esta comparação valer alguma coisa: a
// primeira versão deste teste colava um projeto sem ids e comparava o id novo
// com `null`, o que passava sempre sem provar nada.
conferir(original.id === "zorig1", "a original tem o id que lhe foi dado (" + original.id + ")");
conferir(!!copia.id && copia.id !== original.id,
  "e a cópia tem um id NOVO (" + copia.id + " ≠ " + original.id + ") — o id agarra os ajustes à peça certa");
const ids = depois.map((z) => z.id);
conferir(new Set(ids).size === ids.length && ids.every(Boolean), "e nenhum id se repete: " + ids.join(", "));
const nomes = depois.map((z) => z.nome);
conferir(new Set(nomes).size === nomes.length, "e não há dois nomes iguais: " + nomes.join(", "));

// ---- 4. SAI AO LADO ---------------------------------------------------
console.log("\n== e sai ao lado, não por baixo ==");
console.log("   original x=" + original.x + " · cópia x=" + copia.x + " (largura " + original.w + " m)");
conferir(Math.abs(copia.x - original.x) >= original.w,
  "a cópia está ao menos uma largura ao lado — por baixo parecia que nada tinha acontecido");

// ---- 5. COPIAR UM CONJUNTO -------------------------------------------
console.log("\n== copiar as duas de uma vez ==");
const antesDoGrupo = await zonas();
const xAntes = {};
antesDoGrupo.forEach((z) => { xAntes[z.nome] = z.x; });
const feitas = await pagina.evaluate(async () => {
  window.preview.limparSelecao();
  ["trira", "tiras pequenas"].forEach((n) => window.preview.selecaoDeGrupo.add("zona " + n));
  window.preview.marcarSelecao();
  await new Promise((r) => setTimeout(r, 400));
  const n = window.preview.duplicarPecas(window.preview.alvosSelecionados());
  await new Promise((r) => setTimeout(r, 1200));
  return n;
});
const comGrupo = await zonas();
comGrupo.forEach((z) => console.log(`   ${z.nome.padEnd(16)} x=${z.x}`));
conferir(feitas === 2, "duas cópias feitas de uma vez (" + feitas + ")");
conferir(comGrupo.length === antesDoGrupo.length + 2, "e o projeto tem mais duas zonas");

// A ARRUMAÇÃO ENTRE AS PEÇAS mantém-se: as cópias andaram as duas o mesmo.
const c1 = comGrupo.find((z) => z.nome === "trira 3");
const c2 = comGrupo.find((z) => z.nome === "tiras pequenas 2");
if (c1 && c2) {
  const distOriginal = xAntes["tiras pequenas"] - xAntes["trira"];
  const distCopia = c2.x - c1.x;
  console.log("   distância entre as duas — originais: " + distOriginal.toFixed(2) +
              " m · cópias: " + distCopia.toFixed(2) + " m");
  conferir(Math.abs(distCopia - distOriginal) < 0.02,
    "as cópias guardaram a mesma arrumação entre si");
} else {
  conferir(false, "as cópias do conjunto não apareceram com os nomes esperados");
}

const marcadas = await pagina.evaluate(() => [...window.preview.selecaoDeGrupo]);
console.log("   marcadas depois de copiar: " + marcadas.join(", "));
conferir(marcadas.length === 2 && marcadas.every((n) => /trira 3|tiras pequenas 2/.test(n)),
  "e ficaram marcadas as CÓPIAS, não as originais — o passo seguinte é arrastá-las");

// ---- 6. O QUE NÃO É ZONA não ganha botão ------------------------------
// O PALCO E A RÉGIE TÊM DE EXISTIR para estas duas verificações medirem
// alguma coisa. Uma versão anterior deste teste corria sem palco na cena, dava
// "sem palco na cena" e passava — é a terceira vez esta semana que uma
// verificação minha mede o vazio, por isso confirma-se que existem.
await pagina.evaluate(async () => {
  ["verPalco", "verRegie"].forEach((id) => {
    const c = document.getElementById(id);
    if (c && !c.checked) { c.checked = true; c.dispatchEvent(new Event("change", { bubbles: true })); }
  });
  await new Promise((r) => setTimeout(r, 1800));
});

console.log("\n== o que NÃO se pode copiar não ganha botão ==");
// O palco JÁ se copia desde 24/09 ("inclusive os palcos e passarelas"), por
// isso deixou de servir de exemplo. Pergunta-se à app qual é a primeira peça
// que ela própria diz não se poder copiar, e confere-se essa — em vez de
// escolher uma à mão e arriscar escolher outra que entretanto passou a poder.
const naoCopiavel = await pagina.evaluate(() => {
  const a = window.preview.objetosArrastaveis().find((x) => !window.preview.podeCopiar(x));
  return a ? { nome: a.obj.name, rotulo: a.rotulo } : null;
});
conferir(!!naoCopiavel, "há na cena uma peça que não se copia, para conferir" +
  (naoCopiavel ? " (" + naoCopiavel.rotulo + ")" : " — não havia nenhuma, e isto não mediu nada"));

if (naoCopiavel) {
  const botoes = await pagina.evaluate(async (nome) => {
    window.preview.limparSelecao();
    const a = window.preview.objetosArrastaveis().find((x) => x.obj && x.obj.name === nome);
    window.preview.abrirPainelDeAjuste(a);
    await new Promise((r) => setTimeout(r, 300));
    return [...document.querySelectorAll("#painelAjuste .ajuste-flutuante-topo button")]
      .map((b) => b.textContent).join("");
  }, naoCopiavel.nome);
  console.log("   botões no painel de «" + naoCopiavel.rotulo + "»: " + botoes);
  conferir(!botoes.includes("⧉"),
    "não tem ⧉ — um botão que não faria nada é pior do que botão nenhum");
}

// E o contrário: o palco, que AGORA se copia, tem o botão.
const botoesDoPalco = await pagina.evaluate(async () => {
  window.preview.limparSelecao();
  const a = window.preview.objetosArrastaveis().find((x) => x.obj && x.obj.name === "palco");
  if (!a) return null;
  window.preview.abrirPainelDeAjuste(a);
  await new Promise((r) => setTimeout(r, 300));
  return [...document.querySelectorAll("#painelAjuste .ajuste-flutuante-topo button")]
    .map((b) => b.textContent).join("");
});
console.log("   botões no painel do palco: " + botoesDoPalco);
conferir(!!botoesDoPalco && botoesDoPalco.includes("⧉"),
  "e o palco TEM ⧉ — era o que ele pediu: «inclusive os palcos e passarelas»");

conferir(erros.length === 0, erros.length ? "erro de JavaScript: " + erros[0] : "sem erros de JavaScript");

await browser.close();
s.close();
console.log("\n" + (falhas ? falhas + " FALHA(S)"
  : "Copiar dá a mesma peça outra vez, com identidade própria e ao lado."));
process.exit(falhas ? 1 : 0);
