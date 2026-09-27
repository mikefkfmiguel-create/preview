/**
 * A BARRA DO QUE SE VÊ, no topo da janela do 3D.
 *
 * Pedido: *"podemos mudar os players da vista para o topo da janela sempre
 * visíveis e tirar do menu, pois abre sempre com a grelha e identificação
 * das pessoas e fica confuso, assim será mais rápido selecionar o que
 * ver"*, e a seguir *"grelha desligada e escolha guardada"*.
 *
 * O que este teste guarda:
 *
 *   1. os interruptores saíram MESMO do menu e estão na janela — e vêem-se
 *      com o painel fechado, que é o caso que motivou a mudança;
 *   2. a grelha e as medidas nascem DESLIGADAS: nem grelha no chão nem
 *      etiquetas por cima dos ecrãs, numa app acabada de abrir;
 *   3. uma pastilha liga e desliga mesmo o que promete — o palco aparece e
 *      desaparece da cena — e acende-se quando está ligada;
 *   4. a escolha sobrevive a fechar e reabrir a app;
 *   5. o desfazer continua a apanhar estes interruptores (saíram de dentro
 *      do "#painel input" que o alimentava — foi a avaria mais provável de
 *      toda esta mudança, e a mais calada);
 *   6. as pastilhas da cúpula só aparecem quando o projeto tem uma.
 *
 *   node scripts/verificar-barra-de-vista.mjs
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

/** Um projeto com ecrãs — as etiquetas das medidas são deles. */
const PROJETO = {
  nome: "Barra", sala: { largura: 30, profundidade: 22, altura: 9 },
  palco: { largura: 12, profundidade: 6, altura: 1, dx: 0, dz: 0 },
  zonas: [{ nome: "central", id: "zb1", x: 0, y: 1.5, w: 8, h: 4.5, tiles: { x: 16, y: 9 },
            res: { x: 3072, y: 1728 }, peso: 600, amp: 60, tipo: "led", cor: "#2E7BFF" }]
};

/** O mesmo projeto, mas com uma cúpula — para as quatro pastilhas dela. */
const COM_CUPULA = {
  nome: "Cúpula", sala: { largura: 30, profundidade: 30, altura: 12 },
  zonas: [],
  dome: { diametro: 18, altura: 9, tipo: "meia", projetores: { n: 4, racio: 0.8 } }
};

const { s, porta } = await servidor();
const { chromium } = await carregarPlaywright();
const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM || "/opt/pw-browsers/chromium"
});
const ctx = await browser.newContext({ viewport: { width: 1400, height: 950 }, serviceWorkers: "block" });

let falhas = 0;
const conferir = (ok, texto) => { console.log((ok ? "  ✓ " : "  ✗ ") + texto); if (!ok) falhas++; };

const erros = [];
const abrir = async () => {
  const p = await ctx.newPage();
  p.on("pageerror", (e) => erros.push(e.message));
  await p.goto(`http://127.0.0.1:${porta}/index.html`, { waitUntil: "networkidle" });
  await p.waitForFunction(() => window.preview && window.preview.montar, null, { timeout: 30000 });
  await p.waitForTimeout(1200);
  return p;
};

const carregar = (pagina, projeto) => pagina.evaluate(async (p) => {
  const caixa = document.getElementById("colagem");
  caixa.value = JSON.stringify(p);
  caixa.dispatchEvent(new Event("input", { bubbles: true }));
  document.getElementById("btCarregar").click();
  await new Promise((r) => setTimeout(r, 2200));
}, projeto);

/** O que está mesmo desenhado, e o que a barra mostra. */
const olhar = (pagina) => pagina.evaluate(() => {
  const achar = (nome) => {
    let achado = null;
    window.preview.desenhado.traverse((o) => { if (!achado && o.name === nome) achado = o; });
    return achado;
  };
  const pastilha = (id) => {
    const caixa = document.getElementById(id);
    if (!caixa) return null;
    const p = caixa.closest(".chip");
    return {
      naBarra: !!(p && p.closest("#barraVista")),
      noPainel: !!caixa.closest("#painel"),
      ligada: !!caixa.checked,
      acesa: !!(p && p.classList.contains("ligado")),
      visivel: !!(p && p.offsetParent !== null)
    };
  };
  return {
    grelha: !!achar("aux:grelha"),
    palco: !!achar("palco"),
    etiquetas: document.getElementById("etiquetas").childElementCount,
    caixas: {
      verMedidas: pastilha("verMedidas"), verPalco: pastilha("verPalco"),
      verEcras: pastilha("verEcras"), verDome: pastilha("verDome"),
      domeSolido: pastilha("domeSolido"), verFatias: pastilha("verFatias"),
      verPessoaDome: pastilha("verPessoaDome")
    }
  };
});

/** Carregar numa pastilha como quem carrega com o dedo, e esperar o desenho. */
const tocar = (pagina, id) => pagina.evaluate(async (i) => {
  document.getElementById(i).click();
  await new Promise((r) => setTimeout(r, 1400));
}, id);

const pagina = await abrir();
await carregar(pagina, PROJETO);

console.log("\n== saíram do menu e estão na janela ==");
const inicio = await olhar(pagina);
["verEcras", "verPalco", "verMedidas"].forEach((id) => {
  const c = inicio.caixas[id];
  conferir(!!c && c.naBarra && !c.noPainel,
    id + " está na barra da janela, e já não dentro do painel");
});

// O caso que motivou a mudança: com o painel fechado — que é como se olha
// para o 3D — os interruptores do menu não existiam de todo.
await pagina.evaluate(() => document.getElementById("btFechar").click());
await pagina.waitForTimeout(400);
const fechado = await pagina.evaluate(() => {
  const barra = document.getElementById("barraVista");
  const r = barra.getBoundingClientRect();
  return {
    painelFechado: document.body.classList.contains("fechado"),
    painelVisivel: document.getElementById("painel").offsetParent !== null,
    barraVisivel: barra.offsetParent !== null && r.width > 100 && r.height > 10,
    dentroDoEcra: r.top >= 0 && r.left >= 0 && r.bottom <= window.innerHeight
  };
});
conferir(fechado.painelFechado && !fechado.painelVisivel, "o painel fecha-se");
conferir(fechado.barraVisivel && fechado.dentroDoEcra,
  "e a barra continua à vista, dentro da janela");

// E não rouba a cena onde não tem botões. Esticada de lado a lado, a faixa
// dela apanhava os cliques no alto da tela -- e clicar no céu é como se
// larga uma selecção. Foi assim que o teste dos grupos partiu.
const noAlto = await pagina.evaluate(() => {
  const tela = document.querySelector("canvas").getBoundingClientRect();
  const x = tela.left + tela.width * 0.85, y = tela.top + tela.height * 0.08;
  const emCima = document.elementFromPoint(x, y);
  return { etiqueta: emCima ? (emCima.id || emCima.tagName) : "nada",
           barra: !!(emCima && emCima.closest && emCima.closest("#barraVista")) };
});
conferir(noAlto.barra === false && noAlto.etiqueta === "tela",
  "e um clique no alto da tela, à direita das pastilhas, chega ao 3D (" +
  noAlto.etiqueta + ")");
await pagina.evaluate(() => document.getElementById("btAbrir").click());
await pagina.waitForTimeout(300);

console.log("\n== a grelha e as medidas nascem desligadas ==");
conferir(inicio.caixas.verMedidas.ligada === false,
  "\"Medidas e grelha\" começa desligada");
conferir(inicio.grelha === false, "não há grelha nenhuma no chão");
conferir(inicio.etiquetas === 0,
  "nem etiquetas por cima dos ecrãs (" + inicio.etiquetas + ")");
conferir(inicio.caixas.verMedidas.acesa === false,
  "e a pastilha está apagada");

console.log("\n== uma pastilha liga mesmo o que promete ==");
conferir(inicio.palco === false, "o palco começa fora da cena");
await tocar(pagina, "verPalco");
const comPalco = await olhar(pagina);
conferir(comPalco.palco === true, "toca-se em \"Palco\" e ele aparece");
conferir(comPalco.caixas.verPalco.acesa === true, "e a pastilha acende");
await tocar(pagina, "verMedidas");
const comMedidas = await olhar(pagina);
conferir(comMedidas.grelha === true, "toca-se em \"Medidas e grelha\" e a grelha volta");
conferir(comMedidas.etiquetas > 0,
  "e as etiquetas dos ecrãs com ela (" + comMedidas.etiquetas + ")");

console.log("\n== o desfazer continua a apanhar estes interruptores ==");
// Saíram de dentro do "#painel input" que alimentava o instantâneo do
// desfazer. Sem o selector novo, isto passava despercebido para sempre.
await pagina.evaluate(async () => {
  document.getElementById("btDesfazer").click();
  await new Promise((r) => setTimeout(r, 1400));
});
const desfeito = await olhar(pagina);
conferir(desfeito.caixas.verMedidas.ligada === false && desfeito.grelha === false,
  "um passo atrás desliga as medidas outra vez");
conferir(desfeito.caixas.verMedidas.acesa === false,
  "e a pastilha apaga-se com elas");

console.log("\n== a escolha fica guardada para a próxima vez ==");
// Estado a guardar: palco LIGADO (mexido à mão), medidas desligadas. O
// desfazer acima recuou os dois de uma vez, por isso liga-se o palco outra
// vez -- é o toque de quem depois fecha a app.
if (desfeito.caixas.verPalco.ligada === false) await tocar(pagina, "verPalco");
const antesDeFechar = await olhar(pagina);
conferir(antesDeFechar.palco === true && antesDeFechar.caixas.verMedidas.ligada === false,
  "deixa-se a app com o palco ligado e as medidas desligadas");
await pagina.close();

const segunda = await abrir();
const reaberta = await olhar(segunda);
conferir(reaberta.caixas.verPalco.ligada === true,
  "reabre com \"Palco\" ainda ligado");
conferir(reaberta.caixas.verPalco.acesa === true, "e com a pastilha acesa");
conferir(reaberta.caixas.verMedidas.ligada === false,
  "e as medidas continuam desligadas");

console.log("\n== as pastilhas da cúpula só existem com uma cúpula ==");
const semCupula = reaberta.caixas;
["verDome", "domeSolido", "verFatias", "verPessoaDome"].forEach((id) => {
  conferir(semCupula[id] && semCupula[id].visivel === false,
    id + " está escondida num projeto sem cúpula");
});
await carregar(segunda, COM_CUPULA);
const comCupula = (await olhar(segunda)).caixas;
["verDome", "domeSolido", "verFatias", "verPessoaDome"].forEach((id) => {
  conferir(comCupula[id] && comCupula[id].visivel === true,
    id + " aparece quando o projeto traz uma");
});

console.log("\n== sem erros na consola ==");
conferir(erros.length === 0, erros.length ? erros.join(" | ") : "nenhum");

await browser.close();
s.close();
console.log(falhas ? `\n${falhas} falha(s).` : "\nTudo certo.");
process.exit(falhas ? 1 : 0);
