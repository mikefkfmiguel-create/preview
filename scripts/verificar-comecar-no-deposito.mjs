/**
 * COMEÇAR UM PROJETO AQUI MESMO — o atalho tem de levar ao botão.
 *
 * Pedido: *"quando no 3D abro e escolho fazer um projeto direto nele,
 * [devia] saltar para a aba dos meus ecrãs, do depósito"*.
 *
 * O aviso da sala vazia oferece três caminhos, e o terceiro — "Montar um
 * ecrã aqui mesmo" — levava à secção **Ecrãs na sala**. Numa app acabada de
 * abrir essa secção está vazia e não tem um único botão: quem escolhia
 * começar ali aterrava num sítio sem nada para carregar. O "+ Ecrã" vive no
 * **Depósito**, que é onde todo o material entra.
 *
 * E o segundo caminho — "Ligar o palco, o público ou a régie" — ficou a
 * apontar para a secção Vista no dia em que os interruptores saíram de lá
 * para a barra do topo (v3.89). Um atalho que aponta para o sítio errado é
 * pior do que não existir.
 *
 * O que este teste guarda:
 *
 *   1. "Montar um ecrã aqui mesmo" abre o DEPÓSITO e põe o "+ Ecrã" à vista;
 *   2. e o botão onde ele aterra FUNCIONA: carregar nele acrescenta mesmo um
 *      ecrã (é o que distingue aterrar no sítio certo de aterrar noutro sítio
 *      vazio);
 *   3. "Ligar o palco..." pisca a pastilha na barra, em vez de abrir uma
 *      secção que já não tem interruptor nenhum;
 *   4. nenhum texto da app manda ninguém à "secção Vista", que já não tem o
 *      que lá procurava;
 *   5. "Limpar tudo" não desfaz a escolha do que se vê — é feitio de
 *      trabalhar, como o cadeado e a largura do painel.
 *
 *   node scripts/verificar-comecar-no-deposito.mjs
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
await pagina.waitForTimeout(1400);

console.log("\n== a sala vazia oferece os três caminhos ==");
const oferta = await pagina.evaluate(() => {
  const a = document.getElementById("avisoVazio");
  return {
    mostra: a.classList.contains("mostra"),
    botoes: [...a.querySelectorAll("button")].map((b) => ({
      texto: b.textContent.trim(), secao: b.dataset.secao || null,
      foco: b.dataset.foco || null, barra: b.dataset.barra || null
    }))
  };
});
conferir(oferta.mostra, "o aviso da sala vazia está à vista");
conferir(oferta.botoes.length === 3, "com três caminhos (" + oferta.botoes.length + ")");
oferta.botoes.forEach((b) => console.log("     " + b.texto +
  "  →  " + (b.barra ? "barra:" + b.barra : b.secao + (b.foco ? "/" + b.foco : ""))));

console.log("\n== \"Ligar o palco...\" aponta para a barra, não para uma secção ==");
const pisca = await pagina.evaluate(async () => {
  const bt = [...document.querySelectorAll("#avisoVazio button")]
    .find((b) => /Ligar o palco/i.test(b.textContent));
  if (!bt) return { botao: false };
  bt.click();
  await new Promise((r) => setTimeout(r, 200));
  const chip = document.getElementById("verPalco").closest(".chip");
  return {
    botao: true,
    apontada: chip.classList.contains("apontada"),
    // O erro que isto guarda: mandar para uma secção que já não tem os
    // interruptores. Se voltar a haver um data-secao aqui, é sinal disso.
    paraSeccao: bt.dataset.secao || null
  };
});
conferir(pisca.botao, "o botão existe");
conferir(pisca.apontada === true, "e pisca a pastilha do Palco na barra");
conferir(pisca.paraSeccao === null, "sem mandar ninguém para secção nenhuma");

console.log("\n== \"Montar um ecrã aqui mesmo\" leva ao Depósito ==");
const montar = oferta.botoes.find((b) => /Montar um ecrã/i.test(b.texto));
conferir(!!montar && montar.secao === "deposito",
  "aponta para o depósito (" + (montar ? montar.secao : "não há botão") + ")");
conferir(!!montar && montar.foco === "btNovaZona",
  "e leva a vista até ao próprio \"+ Ecrã\"");

await pagina.evaluate(() => {
  [...document.querySelectorAll("#avisoVazio button")]
    .find((b) => /Montar um ecrã/i.test(b.textContent)).click();
});
await pagina.waitForTimeout(900);

const aterragem = await pagina.evaluate(() => {
  const sec = document.getElementById("deposito");
  const bt = document.getElementById("btNovaZona");
  const painel = document.getElementById("painel");
  const rBt = bt.getBoundingClientRect(), rP = painel.getBoundingClientRect();
  return {
    painelAberto: !document.body.classList.contains("fechado"),
    secaoAberta: !sec.classList.contains("fechada"),
    // Dentro da janela do painel, e não uns milhares de píxeis acima ou
    // abaixo: "abriu a secção" sem se ver o botão não é aterrar no sítio.
    botaoAVista: rBt.top >= rP.top - 1 && rBt.bottom <= rP.bottom + 1 && rBt.width > 0,
    zonasAberta: !document.getElementById("zonas").classList.contains("fechada")
  };
});
conferir(aterragem.painelAberto, "o painel abre-se");
conferir(aterragem.secaoAberta, "a secção Depósito desdobra-se");
conferir(aterragem.botaoAVista, "e o \"+ Ecrã\" fica mesmo visível dentro do painel");

console.log("\n== e o botão onde ele aterra funciona ==");
// Isto é o que separa "aterrou no sítio certo" de "aterrou noutro sítio
// vazio": lá, carregar no que está à mão acrescenta mesmo um ecrã.
const antes = await pagina.evaluate(() => document.querySelectorAll("#listaDeposito .linha, #listaDeposito .item").length);
await pagina.evaluate(() => document.getElementById("btNovaZona").click());
await pagina.waitForTimeout(1200);
const depois = await pagina.evaluate(() => ({
  zonas: (window.preview.projeto && window.preview.projeto.zonas) ? window.preview.projeto.zonas.length : 0,
  contador: (document.getElementById("depositoContador") || {}).textContent || "",
  vazioSumiu: !document.getElementById("avisoVazio").classList.contains("mostra")
}));
conferir(depois.zonas === 1,
  "carregar no \"+ Ecrã\" acrescenta um ecrã ao projeto (" + antes + " → " + depois.zonas + ")");
conferir(depois.contador.trim() !== "" || depois.vazioSumiu,
  "e a app dá por isso (depósito: «" + depois.contador.trim() + "»)");

console.log("\n== nenhum texto manda à \"secção Vista\" ==");
// Lido do ficheiro e não do ecrã: uma frase destas pode estar num aviso que
// só aparece num caso raro, e é precisamente aí que ninguém a apanha.
const fontes = await Promise.all(["index.html", "js/app.js", "js/cena.js"]
  .map(async (f) => [f, await readFile(join(RAIZ, f), "utf8")]));
fontes.forEach(([nome, texto]) => {
  const linhas = texto.split("\n")
    .map((l, i) => (/secção Vista|seccao Vista/.test(l) ? (i + 1) + ": " + l.trim().slice(0, 80) : null))
    .filter(Boolean);
  conferir(linhas.length === 0, nome + " não manda ninguém à secção Vista" +
    (linhas.length ? " — " + linhas.join(" | ") : ""));
});

console.log("\n== a limpeza a fundo não desfaz a escolha do que se vê ==");
// O botão vermelho que apaga tudo nas duas apps. A escolha do que se vê é
// feitio de trabalhar, como o cadeado e a largura do painel: limpar um
// projeto não pode voltar a ligar a grelha que alguém desligou.
const antesDaLimpeza = await pagina.evaluate(async () => {
  const medidas = document.getElementById("verMedidas");
  if (!medidas.checked) medidas.click();
  await new Promise((r) => setTimeout(r, 900));
  return medidas.checked;
});
conferir(antesDaLimpeza === true, "liga-se \"Medidas e grelha\"");

pagina.once("dialog", (d) => d.accept());
await pagina.evaluate(() => { document.getElementById("btLimpar").click(); });
await pagina.waitForFunction(() => window.preview && window.preview.montar, null, { timeout: 30000 });
await pagina.waitForTimeout(1600);

const depoisDaLimpeza = await pagina.evaluate(() => {
  let guardado = null;
  try { guardado = JSON.parse(localStorage.getItem("preview-vista-v1") || "null"); } catch (_) {}
  const chip = document.getElementById("verMedidas").closest(".chip");
  return {
    ligada: document.getElementById("verMedidas").checked,
    acesa: chip.classList.contains("ligado"),
    guardado: guardado ? guardado.verMedidas : null,
    salaVazia: document.getElementById("avisoVazio").classList.contains("mostra")
  };
});
conferir(depoisDaLimpeza.salaVazia, "a limpeza correu mesmo (a sala voltou a estar vazia)");
conferir(depoisDaLimpeza.ligada === true, "e \"Medidas e grelha\" continua ligada");
conferir(depoisDaLimpeza.acesa === true, "com a pastilha acesa");
conferir(depoisDaLimpeza.guardado === true,
  "e a escolha guardada no aparelho (preview-vista-v1)");

console.log("\n== sem erros na consola ==");
conferir(erros.length === 0, erros.length ? erros.join(" | ") : "nenhum");

await browser.close();
s.close();
console.log(falhas ? `\n${falhas} falha(s).` : "\nQuem escolhe começar aqui aterra em cima do botão.");
process.exit(falhas ? 1 : 0);
