/**
 * A POSIÇÃO DE UM ECRÃ É UM NÚMERO SÓ, E ESCREVE-SE DOS DOIS LADOS.
 *
 * Reportado com três fotografias seguidas: mexer o ↔ de um ecrã no 3D, ver o
 * número mudar na lista dos Calculadores -- e o DESENHO ficar quieto, com as
 * medidas entre ecrãs todas iguais às de antes. *"A calculadora não actualiza
 * a posição para dar medidas."*
 *
 * A causa: o ↔/altura viviam num sítio à parte (`ajustes.delays`), como um
 * ajuste só do 3D, enquanto a posição que os Calculadores desenham e medem é a
 * da zona. Dois números para a mesma coisa, e só um deles atravessava.
 *
 * A decisão foi dele: *"o 3D manda"*, e a seguir *"deve ser bidirecional para
 * ajuste mais preciso"* -- arrastar aqui por alto, escrever o número ao
 * milímetro do lado de lá. É isso que este teste guarda, nos DOIS sentidos e
 * com as duas apps na mesma origem, como em produção:
 *
 *   1. mexer o ↔ no 3D move mesmo a zona nos Calculadores, e as MEDIDAS entre
 *      ecrãs mudam com ela -- que era o que faltava;
 *   2. escrever o Centro X nos Calculadores move a zona no 3D;
 *   3. e o ecrã não se mexe sozinho no meio disto: comprometer o ajuste na
 *      posição não pode deslocar o que já estava montado.
 *
 *   node scripts/verificar-posicao-bidirecional.mjs
 */

import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = fileURLToPath(new URL("../..", import.meta.url));   // /home/user

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
      const ficheiro = join(RAIZ, normalize(caminho).replace(/^(\.\.[/\\])+/, ""));
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
const ctx = await browser.newContext({ viewport: { width: 1300, height: 900 }, serviceWorkers: "block" });

let falhas = 0;
const conferir = (ok, texto) => { console.log((ok ? "  ✓ " : "  ✗ ") + texto); if (!ok) falhas++; };
const perto = (a, b, folga) => Math.abs(a - b) <= folga;

const erros = [];
const calc = await ctx.newPage();
calc.on("pageerror", (e) => erros.push("Calculadores: " + e.message));
await calc.goto(`http://127.0.0.1:${porta}/calculadores/index.html`, { waitUntil: "networkidle" });
await calc.waitForTimeout(2500);
await calc.evaluate(() => localStorage.setItem("mikeapps-sincronizacao-v1", JSON.stringify("ligada")));

// Duas zonas lado a lado, com uma folga conhecida entre elas.
// Cada zona nova abre o popup de edição, e com o popup aberto o botão de
// adicionar fica travado de propósito -- por isso fecha-se entre uma e outra,
// como se faz à mão.
await calc.evaluate(async () => {
  const fechar = () => {
    const d = document.querySelector(".lz-details-dialog[open]");
    if (d) { try { d.close(); } catch (_) { d.removeAttribute("open"); } }
  };
  for (let i = 0; i < 2; i++) {
    document.getElementById("lz-add").click();
    await new Promise((r) => setTimeout(r, 1100));
    fechar();
    await new Promise((r) => setTimeout(r, 700));
  }
});

const noPapel = () => calc.evaluate(() => {
  const cartoes = [...document.querySelectorAll("#lz-list .card")];
  const svg = document.getElementById("lz-diagram");
  return {
    x: cartoes.map((c) => parseFloat(c.querySelector(".lz-posx").value)),
    cotas: svg ? [...svg.querySelectorAll("text")].map((t) => t.textContent.trim())
                   .filter((t) => /m$/.test(t)) : []
  };
});

const prev = await ctx.newPage();
prev.on("pageerror", (e) => erros.push("Preview: " + e.message));
await prev.goto(`http://127.0.0.1:${porta}/preview/index.html`, { waitUntil: "networkidle" });
await prev.waitForFunction(() => window.preview && window.preview.montar, null, { timeout: 30000 });
await prev.waitForTimeout(1500);
await prev.evaluate(async () => {
  document.getElementById("btTrazerProjeto").click();
  await new Promise((r) => setTimeout(r, 2200));
});

const naCena = () => prev.evaluate(() => {
  const p = window.preview.projeto;
  const nomes = p ? p.zonas.map((z) => z.nome) : [];
  const alvo = {};
  window.preview.desenhado.traverse((o) => {
    // As peças da cena chamam-se "zona <nome>" (ver fazerZonas em cena.js).
    const dela = o.name && o.name.indexOf("zona ") === 0 ? o.name.slice(5) : null;
    if (dela && nomes.indexOf(dela) >= 0 && alvo[dela] === undefined) {
      const v = new window.preview.THREE.Vector3();
      o.getWorldPosition(v);
      alvo[dela] = +v.x.toFixed(3);
    }
  });
  return { nomes, x: p ? p.zonas.map((z) => +(z.x || 0).toFixed(3)) : [],
           ajustes: p ? p.zonas.map((z) => {
             const a = window.preview.ajustes.delays[z.nome];
             return a ? +(Number(a.dx) || 0).toFixed(3) : 0;
           }) : [], mundo: alvo };
});

const antes = await naCena();
const papelAntes = await noPapel();
console.log("\n== duas zonas, antes de se mexer em nada ==");
console.log("   no 3D: x " + JSON.stringify(antes.x) + " · ajustes " + JSON.stringify(antes.ajustes));
console.log("   no papel: centro X " + JSON.stringify(papelAntes.x) + " · cotas " + JSON.stringify(papelAntes.cotas));
conferir(antes.nomes.length === 2, "as duas zonas atravessaram para o 3D");

// ---- 1. O 3D MANDA ----------------------------------------------------
console.log("\n== mexer a segunda zona 4,20 m para o lado, no 3D ==");
const nome = antes.nomes[1];
await prev.evaluate(async ([nome, quanto]) => {
  const a = window.preview.ajustes;
  a.delays[nome] = Object.assign({}, a.delays[nome], { dx: quanto });
  window.preview.guardarAjustes(a);
  window.preview.montar(false);
  await new Promise((r) => setTimeout(r, 2600));
}, [nome, 4.2]);

const depois = await naCena();
console.log("   no 3D: x " + JSON.stringify(depois.x) + " · ajustes " + JSON.stringify(depois.ajustes));
conferir(perto(depois.x[1] - antes.x[1], 4.2, 0.001),
  "o ajuste passou para a POSIÇÃO da zona (x += 4,20)");
conferir(depois.ajustes[1] === 0,
  "e o ajuste voltou a zero — deixou de haver dois números para a mesma coisa");
// O QUE É MESMO INVARIANTE É A DISTÂNCIA ENTRE OS DOIS.
//
// A minha primeira versão disto exigia que o ecrã movido ficasse no mesmo
// sítio do mundo -- e falhou, com razão. O conjunto está SEMPRE centrado na
// sala (ver ctx.meio em contextoDeZonas): alargá-lo 4,20 m recentra-o, e cada
// ecrã desliza metade disso. Não é o compromisso a mexer no desenho, é o
// modelo da app, e vale para os dois lados da ponte -- escrever o Centro X nos
// Calculadores faz exactamente o mesmo. O que não pode mudar é o que se mexeu:
// a distância entre os dois ecrãs.
const distanciaAntes = antes.mundo[antes.nomes[1]] - antes.mundo[antes.nomes[0]];
const distanciaDepois = depois.mundo[nome] - depois.mundo[antes.nomes[0]];
console.log("   entre os dois ecrãs: " + distanciaAntes.toFixed(2) +
            " m → " + distanciaDepois.toFixed(2) + " m");
conferir(perto(distanciaDepois - distanciaAntes, 4.2, 0.02),
  "os dois ecrãs afastaram-se exactamente o que se mexeu (4,20 m)");

await calc.waitForTimeout(2600);
const papelDepois = await noPapel();
console.log("   no papel: centro X " + JSON.stringify(papelDepois.x) + " · cotas " + JSON.stringify(papelDepois.cotas));
conferir(perto(papelDepois.x[1] - papelAntes.x[1], 4.2, 0.02),
  "os Calculadores moveram a zona — era isto que faltava");
conferir(JSON.stringify(papelDepois.cotas) !== JSON.stringify(papelAntes.cotas),
  "e as MEDIDAS entre ecrãs mudaram com ela — \"para dar medidas\"");

// ---- 2. E O NÚMERO EXACTO ESCREVE-SE DO OUTRO LADO --------------------
//
// "deve ser bidirecional para ajuste mais preciso": arrasta-se aqui por alto,
// escreve-se lá o número ao milímetro.
console.log("\n== escrever o Centro X à mão nos Calculadores ==");
const escrito = await calc.evaluate(async () => {
  const cartao = [...document.querySelectorAll("#lz-list .card")][1];
  const campo = cartao.querySelector(".lz-posx");
  const novo = (parseFloat(campo.value) || 0) - 2.5;
  campo.value = novo.toFixed(2);
  campo.dispatchEvent(new Event("input", { bubbles: true }));
  campo.dispatchEvent(new Event("change", { bubbles: true }));
  await new Promise((r) => setTimeout(r, 2600));
  return novo;
});
await prev.waitForTimeout(2600);
const voltou = await prev.evaluate(async () => {
  document.getElementById("btSincronizar").click();
  await new Promise((r) => setTimeout(r, 2200));
  const p = window.preview.projeto;
  return { x: p ? p.zonas.map((z) => +(z.x || 0).toFixed(2)) : [] };
});
console.log("   escrito " + escrito.toFixed(2) + " → no 3D x " + JSON.stringify(voltou.x));
conferir(perto(voltou.x[1] - depois.x[1], -2.5, 0.05),
  "o número escrito à mão chegou ao 3D — os dois lados escrevem no mesmo sítio");

conferir(erros.length === 0, erros.length ? "erro de JavaScript: " + erros[0] : "sem erros de JavaScript");

await browser.close();
s.close();
console.log("\n" + (falhas ? falhas + " FALHA(S)"
  : "A posição é um número só, e os dois lados escrevem nele."));
process.exit(falhas ? 1 : 0);
