/**
 * O "GUARDAR PROJETO" TEM DE LEVAR A PLANTA DA SALA.
 *
 * Reportado assim: *"o guardar não está a levar a planta da sala"*. E não
 * levava: o ficheiro gravava a sala, o palco, a plateia, os ecrãs e até as
 * imagens que vão nos ecrãs -- tudo menos o desenho que está por baixo de
 * tudo isso. Reabrir um projeto obrigava a ir buscar o DXF outra vez, a
 * confirmar as unidades outra vez e a pô-lo no sítio outra vez.
 *
 * O que este teste mede não é só "o desenho voltou". São as três coisas que
 * juntas fazem a planta servir para alguma coisa:
 *
 *   1. o DESENHO volta -- e volta igual, medido pelos vértices que a cena tem,
 *      não pelo que o ficheiro diz que tem;
 *   2. volta NO SÍTIO: o deslocamento, a rotação, a opacidade e as unidades.
 *      Um desenho que volta fora do sítio dá quase o mesmo trabalho que ter-se
 *      perdido;
 *   3. as CAMADAS escondidas continuam escondidas. Quem apagou a camada das
 *      cotas fê-lo porque ela estorva, e reabrir o projeto com o tapete todo
 *      outra vez é desfazer-lhe o trabalho.
 *
 * E mede o tamanho, que é a razão de o CAD ir em base64 e não em números: em
 * JSON cada número gasta uma dúzia de caracteres, e um desenho a sério punha o
 * ficheiro em dezenas de MB.
 *
 * A prova é feita com a app a MORRER pelo meio -- recarrega-se a página entre
 * gravar e abrir. Sem isso estaria a medir o que ficou em memória, que é
 * exactamente o que já funcionava antes desta correção.
 *
 *   node scripts/verificar-planta-guardada.mjs
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

/**
 * Uma planta de mentira, mas com a forma de uma a sério: duas camadas, uma com
 * as paredes e outra com as cotas, e segmentos que cheguem para o tamanho do
 * ficheiro dizer alguma coisa.
 *
 * EM MILÍMETROS E COM DECIMAIS SUJAS, de propósito. A primeira versão disto
 * era uma grelha de meio em meio metro -- e a medição do tamanho deu ao
 * contrário, com o JSON mais pequeno do que o base64. Estava certa: números
 * redondos ("-10", "6") escrevem-se em dois ou três caracteres, enquanto o
 * base64 gasta sempre 5⅓ por número. Só que planta nenhuma sai assim de um
 * CAD: o que o Vectorworks exporta são milímetros com casas decimais
 * ("-9502.683"), que é o que está aqui. Uma planta de mentira demasiado bem
 * comportada não mede o que se está a usar.
 */
function dxfDeMentira() {
  const par = (c, v) => c + "\n" + v + "\n";
  // 4 = milímetros, que é o que estes números são.
  let fora = par(0, "SECTION") + par(2, "HEADER") +
             par(9, "$INSUNITS") + par(70, 4) + par(0, "ENDSEC");
  fora += par(0, "SECTION") + par(2, "ENTITIES");
  const linha = (camada, x1, y1, x2, y2) =>
    par(0, "LINE") + par(8, camada) +
    par(10, x1.toFixed(3)) + par(20, y1.toFixed(3)) + par(30, "0.0") +
    par(11, x2.toFixed(3)) + par(21, y2.toFixed(3)) + par(31, "0.0");

  let paredes = 0, cotas = 0;
  const CIMA = 6043.217, BAIXO = -5981.744;
  // Uma grelha à volta de 20 × 12 m, com as "paredes" a fazer os compartimentos.
  for (let i = 0; i <= 40; i++) {
    const x = -9987.451 + i * 497.317;
    fora += linha("PAREDES", x, BAIXO, x, CIMA); paredes++;
  }
  for (let j = 0; j <= 24; j++) {
    const y = BAIXO + j * 501.039;
    fora += linha("PAREDES", -9987.451, y, 10003.826, y); paredes++;
  }
  // E a camada que estorva, que é a que se vai esconder.
  for (let k = 0; k < 300; k++) {
    const x = -9987.451 + k * 63.729;
    fora += linha("COTAS", x, BAIXO - 940.118, x, BAIXO - 320.557); cotas++;
  }
  fora += par(0, "ENDSEC") + par(0, "EOF");
  return { texto: fora, paredes, cotas, segmentos: paredes + cotas };
}

const { s, porta } = await servidor();
const { chromium } = await carregarPlaywright();
const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM || "/opt/pw-browsers/chromium"
});
const ctx = await browser.newContext({ viewport: { width: 1400, height: 950 },
                                       serviceWorkers: "block", acceptDownloads: true });

let falhas = 0;
const conferir = (ok, texto) => { console.log((ok ? "  ✓ " : "  ✗ ") + texto); if (!ok) falhas++; };

const pagina = await ctx.newPage();
const erros = [];
pagina.on("pageerror", (e) => erros.push(e.message));

async function esperarApp() {
  await pagina.waitForFunction(() => window.preview && window.preview.montar, null, { timeout: 30000 });
  await pagina.waitForTimeout(1200);
}

await pagina.goto(`http://127.0.0.1:${porta}/index.html`, { waitUntil: "networkidle" });
await esperarApp();

// O que a cena tem MESMO desenhado de planta: os vértices das linhas, não o
// que o ficheiro diz que tem. É esta a medida que não se deixa enganar.
const verticesDaPlanta = () => pagina.evaluate(() => {
  let v = 0;
  window.preview.desenhado.traverse((o) => {
    if (o.name === "planta-cad" && o.geometry && o.geometry.getAttribute("position")) {
      v += o.geometry.getAttribute("position").count;
    }
  });
  return v;
});

// ---- 1. Abrir a planta e pô-la no sítio --------------------------------
const desenho = dxfDeMentira();
console.log(`\n== uma planta em DXF, ${desenho.segmentos} segmentos em 2 camadas ==`);

await pagina.evaluate(async (texto) => {
  const dt = new DataTransfer();
  dt.items.add(new File([texto], "sala.dxf", { type: "application/dxf" }));
  const input = document.getElementById("ficheiroPlanta");
  input.files = dt.files;
  input.dispatchEvent(new Event("change", { bubbles: true }));
  await new Promise((r) => setTimeout(r, 1800));
}, desenho.texto);

const lida = await pagina.evaluate(() => ({
  segmentos: window.preview.plantaCad ? window.preview.plantaCad.segmentos : 0,
  camadas: window.preview.plantaCad ? window.preview.plantaCad.camadas.map((c) => c.nome) : []
}));
console.log("   " + JSON.stringify(lida));
conferir(lida.segmentos === desenho.segmentos,
  `o DXF entrou inteiro (${lida.segmentos} de ${desenho.segmentos})`);

// Esconder a camada das cotas, e arrumar o desenho onde ele serve.
await pagina.evaluate(async () => {
  const linhas = [...document.querySelectorAll("#listaCamadas .camada")];
  const cotas = linhas.find((l) => l.querySelector(".nome").textContent === "COTAS");
  cotas.querySelectorAll("input")[0].click();      // o "ver" desta camada
  const por = (id, v) => {
    const el = document.getElementById(id);
    if (el.tagName === "SELECT") el.value = v; else el.value = String(v);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  };
  por("plantaX", 2.5); por("plantaZ", -1.75); por("plantaR", 15); por("plantaO", 0.45);
  await new Promise((r) => setTimeout(r, 1500));
});

const antes = {
  vertices: await verticesDaPlanta(),
  campos: await pagina.evaluate(() => ({
    x: document.getElementById("plantaX").value,
    z: document.getElementById("plantaZ").value,
    r: document.getElementById("plantaR").value,
    o: document.getElementById("plantaO").value,
    u: document.getElementById("plantaU").value
  }))
};
console.log("   na cena: " + antes.vertices + " vértices · " + JSON.stringify(antes.campos));
conferir(antes.vertices === desenho.paredes * 2,
  "só as paredes estão desenhadas — a camada das cotas ficou escondida");

// ---- 2. Gravar ---------------------------------------------------------
console.log("\n== gravar o projeto ==");
const descarga = await Promise.all([
  pagina.waitForEvent("download", { timeout: 20000 }),
  pagina.evaluate(() => document.getElementById("btGuardarProjeto").click())
]).then(([d]) => d);

const conteudo = await readFile(await descarga.path(), "utf8");
const gravado = JSON.parse(conteudo);
console.log("   " + descarga.suggestedFilename() + " · " +
  (conteudo.length / 1024).toFixed(0) + " KB");
conferir(!!gravado.planta, "o ficheiro leva a planta — era isto que faltava");
conferir(gravado.planta && gravado.planta.tipo === "cad" &&
         typeof gravado.planta.pontos === "string",
  "o desenho vai lá dentro, em base64");
conferir(gravado.planta && Array.isArray(gravado.planta.escondidas) &&
         gravado.planta.escondidas.length === 1,
  "e a camada escondida vai com ele");

// O tamanho, que é a razão do base64. Os mesmos números escritos em JSON.
const emJson = await pagina.evaluate(() =>
  JSON.stringify(Array.from(window.preview.plantaCad.pontos)).length);
const emBase64 = gravado.planta.pontos.length;
console.log(`   os mesmos ${desenho.segmentos} segmentos: ` +
  `${(emBase64 / 1024).toFixed(0)} KB em base64, ${(emJson / 1024).toFixed(0)} KB em JSON`);
conferir(emBase64 < emJson,
  "o base64 é mais pequeno do que os números por extenso — é para isso que lá está");

// ---- 3. A APP MORRE, e o ficheiro é que tem de trazer tudo -------------
console.log("\n== recarregar a página (a planta não sobrevive em memória) ==");
await pagina.reload({ waitUntil: "networkidle" });
await esperarApp();
const vazia = await pagina.evaluate(() => ({
  cad: !!window.preview.plantaCad, vertices: 0
}));
conferir(!vazia.cad, "a app abre sem planta nenhuma, como é suposto");

const depois = await pagina.evaluate(async (texto) => {
  const dt = new DataTransfer();
  dt.items.add(new File([texto], "sala.pvw", { type: "application/json" }));
  const input = document.getElementById("ficheiroProjeto");
  input.files = dt.files;
  input.dispatchEvent(new Event("change", { bubbles: true }));
  await new Promise((r) => setTimeout(r, 2500));
  const linhas = [...document.querySelectorAll("#listaCamadas .camada")];
  const cotas = linhas.find((l) => l.querySelector(".nome").textContent === "COTAS");
  return {
    segmentos: window.preview.plantaCad ? window.preview.plantaCad.segmentos : 0,
    campos: {
      x: document.getElementById("plantaX").value,
      z: document.getElementById("plantaZ").value,
      r: document.getElementById("plantaR").value,
      o: document.getElementById("plantaO").value,
      u: document.getElementById("plantaU").value
    },
    cotasVisiveis: cotas ? cotas.querySelectorAll("input")[0].checked : null,
    aviso: (document.getElementById("aviso") || {}).textContent || ""
  };
}, conteudo);

console.log("   " + JSON.stringify(depois));
conferir(depois.segmentos === desenho.segmentos,
  `a planta voltou inteira (${depois.segmentos} segmentos)`);
conferir(await verticesDaPlanta() === antes.vertices,
  "e está desenhada na cena com os mesmos vértices de antes de gravar");
conferir(JSON.stringify(depois.campos) === JSON.stringify(antes.campos),
  "voltou no sítio: deslocar, rodar, opacidade e unidades");
conferir(depois.cotasVisiveis === false,
  "e a camada das cotas continua escondida — quem a apagou não a quer de volta");

// ---- 4. Uma planta em IMAGEM faz a mesma volta -------------------------
console.log("\n== e uma planta em imagem (PNG) ==");
const imagem = await pagina.evaluate(async () => {
  const tela = document.createElement("canvas");
  tela.width = 64; tela.height = 40;
  const p = tela.getContext("2d");
  p.fillStyle = "#FFFFFF"; p.fillRect(0, 0, 64, 40);
  p.strokeStyle = "#000000"; p.strokeRect(4, 4, 56, 32);
  const url = tela.toDataURL("image/png");
  const bytes = await (await fetch(url)).blob();
  const dt = new DataTransfer();
  dt.items.add(new File([bytes], "planta.png", { type: "image/png" }));
  const input = document.getElementById("ficheiroPlanta");
  input.files = dt.files;
  input.dispatchEvent(new Event("change", { bubbles: true }));
  await new Promise((r) => setTimeout(r, 1600));
  const largura = document.getElementById("plantaL");
  largura.value = "18"; largura.dispatchEvent(new Event("input", { bubbles: true }));
  await new Promise((r) => setTimeout(r, 1000));
  return { temImagem: !!window.preview.plantaImagem, temCad: !!window.preview.plantaCad };
});
console.log("   " + JSON.stringify(imagem));
conferir(imagem.temImagem && !imagem.temCad, "a imagem entrou, e largou o DXF que lá estava");

const descarga2 = await Promise.all([
  pagina.waitForEvent("download", { timeout: 20000 }),
  pagina.evaluate(() => document.getElementById("btGuardarProjeto").click())
]).then(([d]) => d);
const conteudo2 = await readFile(await descarga2.path(), "utf8");
const gravado2 = JSON.parse(conteudo2);
conferir(gravado2.planta && gravado2.planta.tipo === "imagem" &&
         /^data:image\/png/.test(gravado2.planta.imagem || ""),
  "e vai no ficheiro como imagem, em data URL");

await pagina.reload({ waitUntil: "networkidle" });
await esperarApp();
const voltou = await pagina.evaluate(async (texto) => {
  const dt = new DataTransfer();
  dt.items.add(new File([texto], "sala.pvw", { type: "application/json" }));
  const input = document.getElementById("ficheiroProjeto");
  input.files = dt.files;
  input.dispatchEvent(new Event("change", { bubbles: true }));
  await new Promise((r) => setTimeout(r, 2500));
  let no3d = 0;
  window.preview.desenhado.traverse((o) => { if (o.name === "aux:planta") no3d++; });
  return { temImagem: !!window.preview.plantaImagem, no3d,
           largura: document.getElementById("plantaL").value };
}, conteudo2);
console.log("   " + JSON.stringify(voltou));
conferir(voltou.temImagem && voltou.no3d > 0,
  "a imagem voltou e está deitada no chão da sala");
conferir(voltou.largura === "18", "com a largura real que lhe foi dada");

conferir(erros.length === 0, erros.length ? "erro de JavaScript: " + erros[0] : "sem erros de JavaScript");

await browser.close();
s.close();
console.log("\n" + (falhas ? falhas + " FALHA(S)"
  : "O ficheiro guardado leva a planta — o desenho, o sítio e as camadas."));
process.exit(falhas ? 1 : 0);
