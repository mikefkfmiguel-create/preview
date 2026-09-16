/**
 * O QUE A CONTAGEM MANDA, E O QUE NUNCA MANDA.
 *
 * A contagem é a única coisa nesta app que fala com o exterior sem ninguém
 * carregar num botão. Duas promessas estão escritas na secção "O que esta app
 * conta", e uma promessa que não se mede é uma promessa que um dia se parte
 * sem ninguém dar por isso:
 *
 *   1. sai um número, uma versão e nomes de momentos -- e mais NADA;
 *   2. o interruptor desliga mesmo, e um "Link para ver" nunca conta.
 *
 * E há uma terceira coisa, invisível, que parte de fora para dentro: a ficha
 * é a MESMA dos Calculadores (mesmo domínio, mesmo localStorage). Escrever
 * por cima do que é deles fazia-os contar duas vezes no mesmo dia, calados.
 *
 * Nenhum pedido sai desta máquina: o endereço do Worker é interceptado.
 *
 * Correr:  node scripts/verificar-contagem.mjs
 */

import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = fileURLToPath(new URL("..", import.meta.url));
const USO_URL = "https://calculadores-assistente.avkvideoshare.workers.dev/uso";
const FICHA = "calculadores-uso-v1";

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

const PROJETO_COM_DOME = {
  nome: "Sala com cúpula", origem: "calculadores",
  sala: { largura: 20, profundidade: 14, altura: 6 },
  zonas: [{ nome: "Ecrã", id: "z1", x: 0, y: 0, w: 6, h: 3, cor: "#2e7bff", tipo: "led" }],
  dome: { diametro: 12, altura: 6, inclinacao: 0, projetores: { n: 6, anel: 6, racio: 0.8, distancia: 5 } }
};
const BLEND_CURVO = {
  v: 2,
  curva: { raio: 12, corda: 17.3, arco: 18, altura: 4.5, alturaLente: 2.2, shiftV: -25, montagem: "arco", retro: false },
  projetores: [-6, 0, 6].map((x) => ({
    racio: 1.5, distancia: 6, largura: 6, altura: 4.5, modelo: "Projetor", lente: "", lateral: x, alturaOffset: 0
  }))
};

const { s, porta } = await servidor();
const ENDERECO = `http://127.0.0.1:${porta}/index.html`;
const { chromium, devices } = await carregarPlaywright();
const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM || "/opt/pw-browsers/chromium"
});

let falhas = 0;
function verificar(rotulo, problemas) {
  if (problemas.length) {
    falhas++;
    console.log("✗ " + rotulo);
    problemas.forEach((t) => console.log("    " + t));
  } else {
    console.log("✓ " + rotulo);
  }
}

/**
 * Abre a app com o Worker interceptado. Devolve a página e a lista do que lhe
 * foi mandado — nada sai desta máquina.
 */
async function abrir({ ficha, hash } = {}) {
  const ctx = await browser.newContext({ ...devices["Pixel 7"] });
  const p = await ctx.newPage();
  const enviados = [];
  const errosDaPagina = [];
  p.on("pageerror", (e) => errosDaPagina.push(e.message));

  await p.route(USO_URL, async (rota) => {
    try { enviados.push(JSON.parse(rota.request().postData() || "{}")); } catch (_) { enviados.push({ ilegivel: true }); }
    await rota.fulfill({ status: 200, contentType: "application/json", body: '{"ok":true}' });
  });
  // O Worker da partilha, para o "Link para ver" não precisar de rede.
  await p.route("**/partilha", (r) => r.fulfill({ status: 200, contentType: "application/json", body: '{"id":"abc123"}' }));
  await p.route("**/partilha/*", (r) => r.fulfill({
    status: 200, contentType: "application/json",
    body: JSON.stringify({ estado: { tipo: "preview-projeto", projeto: PROJETO_COM_DOME } })
  }));

  // A ficha entra ANTES da primeira navegação, e não com um segundo goto: uma
  // navegação que só muda o "#" não recarrega a página e o módulo não volta a
  // correr (está no CLAUDE.md, e foi exactamente assim que este teste passou
  // a verde sem ter entrado em modo de visualização nenhum).
  if (ficha) {
    await ctx.addInitScript(([k, v]) => {
      try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) {}
    }, [FICHA, ficha]);
  }
  await p.goto(ENDERECO + (hash || ""));
  await p.waitForFunction(() => !!document.getElementById("btExemplo"), null, { timeout: 15000 });
  return { ctx, p, enviados, errosDaPagina };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// O arranque espera 5 s de propósito (não pesar no arranque, não contar um
// toque enganado). Aqui espera-se por ele.
const ESPERA = 6500;

// ---------------------------------------------------------------- 1. arranque
{
  const { ctx, p, enviados, errosDaPagina } = await abrir();
  await p.waitForTimeout(ESPERA);
  const pb = [];
  if (errosDaPagina.length) pb.push("erro de JavaScript: " + errosDaPagina[0]);
  if (enviados.length !== 1) pb.push(`esperava 1 envio, foram ${enviados.length}`);
  const e = enviados[0] || {};
  if (e.app !== "preview") pb.push(`app devia ser "preview", é ${JSON.stringify(e.app)}`);
  if (!UUID.test(e.id || "")) pb.push(`id devia ser um UUID, é ${JSON.stringify(e.id)}`);
  if (!/^v\d/.test(e.versao || "")) pb.push(`versao devia vir preenchida, é ${JSON.stringify(e.versao)}`);
  // A promessa inteira: NADA mais do que estes quatro campos.
  const extra = Object.keys(e).filter((k) => !["app", "id", "versao", "abas"].includes(k));
  if (extra.length) pb.push("campos a mais no que sai daqui: " + extra.join(", "));
  verificar("abrir a app conta o aparelho, e manda só app/id/versão/abas", pb);
  await ctx.close();
}

// ------------------------------------------- 2. o que se lá fez, momento a momento
{
  const { ctx, p, enviados, errosDaPagina } = await abrir();
  // Um projeto com cúpula, um blend, uma exportação e uma partilha.
  await p.evaluate((d) => {
    localStorage.setItem("mikeapps-sincronizacao-v1", JSON.stringify("ligada"));
    localStorage.setItem("mikeapps-projeto-v1", JSON.stringify(d.proj));
    localStorage.setItem("mikeapps-projetor-v1", JSON.stringify(d.blend));
  }, { proj: PROJETO_COM_DOME, blend: BLEND_CURVO });
  await p.evaluate(() => document.getElementById("btSincronizar").click());
  await p.waitForTimeout(800);
  await p.evaluate(() => document.getElementById("btTrazerProjetor").click());
  await p.waitForTimeout(800);
  await p.evaluate(() => document.getElementById("btPartilhar").click());
  await p.waitForTimeout(1200);
  await p.waitForTimeout(ESPERA);

  const pb = [];
  if (errosDaPagina.length) pb.push("erro de JavaScript: " + errosDaPagina[0]);
  const abas = new Set(enviados.flatMap((e) => e.abas || []));
  for (const esperado of ["projeto", "dome", "blend", "partilhar"]) {
    if (!abas.has(esperado)) pb.push(`faltou "${esperado}" — só chegaram [${[...abas].join(", ")}]`);
  }
  verificar("projeto, cúpula, blend e partilha ficam marcados", pb);
  await ctx.close();
}

// ------------------- 2b. o que acontece DEPOIS do envio de arranque conta na mesma
{
  // O envio de arranque sai 5 s depois de abrir; exportar acontece sempre
  // depois disso. Com a regra "um envio por dia" dos Calculadores, o
  // "exportar" ficava adiado para o dia seguinte -- e quem usasse o Preview
  // num dia só nunca o via contado. Era a coluna que mais interessa a mentir.
  const { ctx, p, enviados, errosDaPagina } = await abrir();
  await p.waitForTimeout(ESPERA);                       // o envio de arranque
  const depoisDoArranque = enviados.length;
  await p.evaluate(() => document.getElementById("btGuardar").click());
  await p.waitForTimeout(1200);
  await p.evaluate(() => document.getElementById("btGuardar").click());   // outra vez
  await p.evaluate(() => document.getElementById("btGuardar").click());   // e outra
  await p.waitForTimeout(1500);

  const pb = [];
  if (errosDaPagina.length) pb.push("erro de JavaScript: " + errosDaPagina[0]);
  if (depoisDoArranque !== 1) pb.push(`o arranque devia ser 1 envio, foram ${depoisDoArranque}`);
  const abas = new Set(enviados.flatMap((e) => e.abas || []));
  if (!abas.has("exportar")) pb.push("exportar tem de chegar no MESMO dia, não no seguinte");
  // E o tecto: três cliques no mesmo botão não podem dar três pedidos.
  if (enviados.length !== depoisDoArranque + 1) {
    pb.push(`cada momento manda UMA vez por dia — foram ${enviados.length - depoisDoArranque} envios para três cliques`);
  }
  verificar("exportar depois do arranque conta hoje — e uma vez só", pb);
  await ctx.close();
}

// ----------------------------------------------------------- 3. o interruptor
{
  const { ctx, p, enviados } = await abrir();
  await p.evaluate(() => document.getElementById("uso-ligado").click());   // desliga
  await p.waitForTimeout(400);
  await p.evaluate(() => document.getElementById("btGuardar").click());    // exporta
  await p.waitForTimeout(ESPERA);
  const pb = [];
  if (enviados.length) pb.push(`desligada, não pode sair nada — saíram ${enviados.length}`);
  const guardado = await p.evaluate((k) => JSON.parse(localStorage.getItem(k) || "{}"), FICHA);
  if (guardado.ligado !== false) pb.push("o 'ligado: false' tem de ficar gravado, para os Calculadores o lerem também");
  verificar("desligar desliga mesmo — e desliga nas duas apps", pb);
  await ctx.close();
}

// ------------------------------------------------- 4. um "Link para ver" não conta
{
  const { ctx, p, enviados, errosDaPagina } = await abrir({ hash: "#ver=abc123" });
  await p.waitForTimeout(ESPERA);
  const pb = [];
  if (errosDaPagina.length) pb.push("erro de JavaScript: " + errosDaPagina[0]);
  const emModoVer = await p.evaluate(() => document.body.classList.contains("modo-ver"));
  if (!emModoVer) pb.push("o teste não chegou a entrar em modo de visualização — não testou nada");
  if (enviados.length) pb.push(`quem abre um link só de ver não pode ser contado — saíram ${enviados.length}`);
  verificar("um “Link para ver” não conta ninguém", pb);
  await ctx.close();
}

// --------------------------------------- 5. a ficha é partilhada com os Calculadores
{
  // O que os Calculadores lá deixaram, na forma deles.
  const antes = {
    id: "11111111-2222-4333-8444-555555555555",
    ligado: true,
    abas: ["menu", "led"],
    ultimoEnvio: "2026-09-16"
  };
  const { ctx, p, enviados } = await abrir({ ficha: antes });
  await p.waitForTimeout(ESPERA);
  const depois = await p.evaluate((k) => JSON.parse(localStorage.getItem(k) || "{}"), FICHA);
  const pb = [];
  if ((enviados[0] || {}).id !== antes.id) {
    pb.push("o mesmo aparelho tem de usar o MESMO número nas duas apps, não inventar outro");
  }
  if (JSON.stringify(depois.abas) !== JSON.stringify(antes.abas)) {
    pb.push(`o Preview apagou o que era dos Calculadores: abas ${JSON.stringify(depois.abas)}`);
  }
  if (depois.ultimoEnvio !== antes.ultimoEnvio) {
    pb.push("o Preview apagou o 'ultimoEnvio' dos Calculadores — eles voltariam a contar hoje");
  }
  if (!depois.preview || typeof depois.preview !== "object") {
    pb.push("o Preview tem de guardar o que é dele no seu canto da ficha");
  }
  verificar("a ficha é partilhada: mesmo número, e nada do outro lado se perde", pb);
  await ctx.close();
}

await browser.close();
s.close();

if (falhas) {
  console.log(`\n${falhas} ${falhas === 1 ? "caso falhou" : "casos falharam"}.`);
  process.exit(1);
}
console.log("\nA contagem manda o que diz que manda, e cala-se quando lhe mandam calar.");
