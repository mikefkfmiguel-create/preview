/**
 * MEXER NO 3D E OS CALCULADORES ACOMPANHAREM — E, QUANDO NÃO, DIZÊ-LO.
 *
 * Reportado assim: *"deixaram de estar em sinc: eu movo no 3D e a calculadora
 * não actualiza para me dar as medidas"*.
 *
 * Medido antes de mexer em nada: **a ponte está inteira**. Com a sincronização
 * automática ligada, mudar o ecrã aqui chega aos Calculadores sozinho, em
 * segundos. O que estava desligado era o interruptor -- e está desligado de
 * propósito desde a v3.80, a pedido: *"abre sempre dos dois lados com o sync
 * desligado e em projeto limpo até eu abrir um"*.
 *
 * Nascer calado foi o que se pediu. Ficar calado DEPOIS de alguém mexer já não
 * é: do lado de quem mexeu, o outro lado está simplesmente errado, e não há
 * nada no ecrã que explique porquê. É isso que esta versão acrescenta, e é
 * isso que este teste guarda -- as duas metades:
 *
 *   1. LIGADA: mexer aqui chega lá sozinho (a ponte a sério, duas páginas na
 *      mesma origem, como em produção);
 *   2. DESLIGADA: mexer aqui DIZ que não vai, uma vez, com os dois caminhos ao
 *      lado -- enviar agora, ou ligar a automática.
 *
 * As duas apps têm de ser servidas da MESMA origem, que é o que elas são em
 * produção — por isso este teste serve /home/user inteiro.
 *
 *   node scripts/verificar-sincronizacao.mjs
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

const erros = [];
const calc = await ctx.newPage();
calc.on("pageerror", (e) => erros.push("Calculadores: " + e.message));
await calc.goto(`http://127.0.0.1:${porta}/calculadores/index.html`, { waitUntil: "networkidle" });
await calc.waitForTimeout(2500);

const sincronizacao = (ligada) => calc.evaluate((ligada) => {
  localStorage.setItem("mikeapps-sincronizacao-v1", JSON.stringify(ligada ? "ligada" : "desligada"));
}, ligada);

// Uma zona, marcada para o projeto — é o que atravessa a ponte.
await sincronizacao(true);
await calc.evaluate(async () => {
  document.getElementById("lz-add").click();
  await new Promise((r) => setTimeout(r, 1200));
});

const prev = await ctx.newPage();
prev.on("pageerror", (e) => erros.push("Preview: " + e.message));
await prev.goto(`http://127.0.0.1:${porta}/preview/index.html`, { waitUntil: "networkidle" });
await prev.waitForFunction(() => window.preview && window.preview.montar, null, { timeout: 30000 });
await prev.waitForTimeout(1500);

const trouxe = await prev.evaluate(async () => {
  document.getElementById("btTrazerProjeto").click();
  await new Promise((r) => setTimeout(r, 2200));
  return { zonas: window.preview.projeto ? window.preview.projeto.zonas.length : 0 };
});
console.log("\n== o projeto atravessou para o 3D ==");
console.log("   zonas no Preview: " + trouxe.zonas);
conferir(trouxe.zonas > 0, "o Preview tem o projeto dos Calculadores");

// ---- 1. COM A SINCRONIZAÇÃO LIGADA ------------------------------------
console.log("\n== com a sincronização LIGADA, mexer aqui chega lá ==");
const mexido = await prev.evaluate(async () => {
  const el = document.getElementById("ecraL");
  const antes = parseFloat(el.value) || 6;
  el.value = String(antes + 2);
  el.dispatchEvent(new Event("change", { bubbles: true }));
  await new Promise((r) => setTimeout(r, 2500));
  let devolvido = null;
  try { devolvido = JSON.parse(localStorage.getItem("mikeapps-ecra-v1") || "null"); } catch (_) {}
  return { antes, agora: parseFloat(el.value), largura: devolvido ? devolvido.largura : null,
           aviso: (document.getElementById("aviso") || {}).textContent || "" };
});
console.log("   ecrã " + mexido.antes + " → " + mexido.agora +
            " m · na ponte: " + mexido.largura + " m");
conferir(mexido.largura !== null && Math.abs(mexido.largura - mexido.agora) < 0.02,
  "o que se mexeu no 3D está na ponte, sem se ter carregado em nada");
conferir(!/sincronização automática está desligada/i.test(mexido.aviso),
  "e não se queixa de nada — porque não há de que");

await calc.waitForTimeout(2500);
const naCalc = await calc.evaluate(() => ({
  toast: (document.getElementById("app-toast") || {}).textContent || ""
}));
console.log("   nos Calculadores: " + naCalc.toast.slice(0, 90));
conferir(/trazido do preview/i.test(naCalc.toast),
  "e os Calculadores receberam-no sozinhos — a ponte está inteira");

// ---- 2. COM A SINCRONIZAÇÃO DESLIGADA ---------------------------------
//
// É o estado por omissão desde a v3.80, a pedido. O que não pode é ser mudo.
console.log("\n== com a sincronização DESLIGADA, mexer aqui DIZ que não vai ==");
await sincronizacao(false);
await prev.reload({ waitUntil: "networkidle" });
await prev.waitForFunction(() => window.preview && window.preview.montar, null, { timeout: 30000 });
await prev.waitForTimeout(1500);
await prev.evaluate(async () => {
  document.getElementById("btTrazerProjeto").click();
  await new Promise((r) => setTimeout(r, 2000));
});

const calado = await prev.evaluate(async () => {
  const antes = localStorage.getItem("mikeapps-ecra-v1");
  const el = document.getElementById("ecraL");
  el.value = String((parseFloat(el.value) || 6) + 3);
  el.dispatchEvent(new Event("change", { bubbles: true }));
  await new Promise((r) => setTimeout(r, 2200));
  const aviso = document.getElementById("aviso");
  return { texto: aviso.classList.contains("mostra") ? aviso.textContent : "",
           temEnviar: !!aviso.querySelector("[data-devolver-agora]"),
           temLigar: !!aviso.querySelector("[data-ligar-sinc]"),
           pontesIguais: localStorage.getItem("mikeapps-ecra-v1") === antes };
});
console.log("   " + calado.texto.replace(/\s+/g, " ").slice(0, 150));
conferir(/sincronização automática está desligada/i.test(calado.texto),
  "a app diz que o que se mexeu NÃO foi — antes não dizia nada");
conferir(calado.temEnviar && calado.temLigar,
  "com os dois caminhos ao lado: enviar agora, ou ligar a automática");
conferir(calado.pontesIguais,
  "e não mandou nada às escondidas — desligada é desligada");

// O botão de enviar agora manda mesmo.
const enviou = await prev.evaluate(async () => {
  document.querySelector("#aviso [data-devolver-agora]").click();
  await new Promise((r) => setTimeout(r, 1200));
  let d = null;
  try { d = JSON.parse(localStorage.getItem("mikeapps-ecra-v1") || "null"); } catch (_) {}
  return { largura: d ? d.largura : null,
           ecra: parseFloat(document.getElementById("ecraL").value) };
});
console.log("   depois de «Enviar agora»: ponte " + enviou.largura + " m · ecrã " + enviou.ecra + " m");
conferir(enviou.largura !== null && Math.abs(enviou.largura - enviou.ecra) < 0.02,
  "«Enviar agora» manda mesmo o que está no ecrã");

// E o aviso não se repete a cada ajuste — um aviso que aparece sempre deixa de
// se ler.
const segundaVez = await prev.evaluate(async () => {
  const aviso = document.getElementById("aviso");
  aviso.classList.remove("mostra");
  aviso.innerHTML = "";
  const el = document.getElementById("ecraL");
  el.value = String((parseFloat(el.value) || 6) + 1);
  el.dispatchEvent(new Event("change", { bubbles: true }));
  await new Promise((r) => setTimeout(r, 2200));
  return aviso.classList.contains("mostra") ? aviso.textContent : "";
});
conferir(!/sincronização automática está desligada/i.test(segundaVez),
  "e diz-se UMA vez por sessão — um aviso que aparece sempre deixa de se ler");

conferir(erros.length === 0, erros.length ? "erro de JavaScript: " + erros[0] : "sem erros de JavaScript");

await browser.close();
s.close();
console.log("\n" + (falhas ? falhas + " FALHA(S)"
  : "A ponte leva o que se mexe — e quando está desligada, diz que está."));
process.exit(falhas ? 1 : 0);
