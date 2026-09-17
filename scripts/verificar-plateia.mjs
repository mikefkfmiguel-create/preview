/**
 * A PLATEIA TEM NOME, E OS CORREDORES ESCOLHEM-SE POR ELE.
 *
 * Pedido: *"no 3D a plateia já tem os corredores. Nos gomos para rodar
 * preciso de ter corredores horizontais também além dos verticais, e poder
 * dar número de lugares por fila em cada bloco"*. E, quando perguntei como
 * indicar o corredor horizontal, veio uma resposta melhor do que as duas
 * opções que eu tinha dado: *"poder escolher onde entra o corredor, marca os
 * lugares com números e letras, para escolher a encruzilhada"*.
 *
 * São três coisas que se seguram umas às outras -- as letras são o que torna
 * possível apontar para o corredor -- e por isso medem-se juntas:
 *
 *   1. os lugares por fila são os PEDIDOS, um número por bloco, e a lotação
 *      sai desses números (é o que alguém leva para a obra);
 *   2. a fila A é a da frente, o alfabeto continua depois do Z, e o campo
 *      aceita as letras como se escrevem (minúsculas, espaços);
 *   3. "corredor depois da fila H" abre MESMO um vão em H, e o vão empurra
 *      as filas de trás em vez de as apagar.
 *
 * E três coisas que não podem partir-se pelo caminho: a contagem de filas
 * (que se derivava de uma distância, e passou a levar a largura dos
 * corredores somada), os gomos (é onde isto foi pedido), e a app a dizer
 * quando os lugares pedidos não cabem na sala.
 *
 *   node scripts/verificar-plateia.mjs
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
const ctx = await browser.newContext({ viewport: { width: 1500, height: 1000 }, serviceWorkers: "block" });

let falhas = 0;
const conferir = (ok, texto) => { console.log((ok ? "  ✓ " : "  ✗ ") + texto); if (!ok) falhas++; };

const pagina = await ctx.newPage();
const erros = [];
pagina.on("pageerror", (e) => erros.push(e.message));
await pagina.goto(`http://127.0.0.1:${porta}/index.html`, { waitUntil: "networkidle" });
await pagina.waitForFunction(() => window.preview && window.preview.montar, null, { timeout: 30000 });
await pagina.waitForTimeout(800);

/** Põe a sala e a plateia, e devolve o que a app construiu. */
const montarPlateia = (campos, lugares, corredores) => pagina.evaluate(async ([campos, lugares, corredores]) => {
  const por = (id, v) => { const el = document.getElementById(id);
    if (!el) return;
    if (el.type === "checkbox") el.checked = !!v; else el.value = String(v);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true })); };
  Object.keys(campos).forEach((k) => por(k, campos[k]));
  await new Promise((r) => setTimeout(r, 300));
  // As caixas por bloco nascem do campo "Corredores" -- por isso só se
  // preenchem DEPOIS de ele estar posto.
  const caixas = [...document.querySelectorAll("#lugaresPorBloco input")];
  caixas.forEach((el, i) => {
    el.value = (lugares && lugares[i] != null) ? String(lugares[i]) : "";
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
  if (corredores != null) por("corredoresHorizontais", corredores);
  await new Promise((r) => setTimeout(r, 900));
  const g = window.preview.gente;
  return {
    caixas: caixas.length,
    lugares: g ? g.lugares : null,
    porFila: g ? g.porFila : null,
    filas: g ? g.filas : null,
    blocos: g ? g.blocos : null,
    blocosInfo: g ? g.blocosInfo : null,
    zDasFilas: g && g.filasInfo ? g.filasInfo.map((f) => Math.round(f.z * 1000) / 1000) : null,
    cortes: g ? g.cortesHorizontais : null,
    apertado: g ? g.apertado : null,
    avisoLugares: (() => { const el = document.getElementById("avisoLugares");
      return el && !el.hidden ? el.textContent : ""; })(),
    notaFilas: (document.getElementById("notaFilas") || {}).textContent || ""
  };
}, [campos, lugares, corredores]);

const SALA = { salaL: 30, salaP: 30, salaA: 8, filas: 10, primeiraFila: 3,
               entreFilas: 0.9, entreLugares: 0.5, larguraCorredor: 1.2,
               inclinacao: 0.12, verPublico: true, palcoL: 10, palcoP: 4 };

// ---- 1. Os lugares por fila são os que se pedem -------------------------
console.log("\n== lugares por fila, um número por bloco ==");
const pedidos = await montarPlateia({ ...SALA, corredores: 2 }, [8, 16, 8], "");
console.log("   " + JSON.stringify({ caixas: pedidos.caixas, porFila: pedidos.porFila,
  filas: pedidos.filas, lugares: pedidos.lugares }));
conferir(pedidos.caixas === 3, "2 corredores dão 3 caixas de lugares (uma por bloco)");
conferir(pedidos.porFila === 32, "8 + 16 + 8 = 32 lugares por fila — os pedidos, não os que caberiam");
conferir(pedidos.lugares === 32 * pedidos.filas,
  "e a lotação é esse número vezes as filas (" + pedidos.lugares + ")");

const larguras = (pedidos.blocosInfo || []).map((b) => Math.round((b.x1 - b.x0) * 100) / 100);
console.log("   larguras dos blocos: " + JSON.stringify(larguras));
conferir(larguras.length === 3 && larguras[1] > larguras[0] && larguras[0] === larguras[2],
  "o bloco do meio fica mais largo do que os dos lados, como foi pedido");
const numeracao = (pedidos.blocosInfo || []).map((b) => b.primeiroLugar + "–" + (b.primeiroLugar + b.lugares - 1));
console.log("   numeração: " + JSON.stringify(numeracao));
conferir(numeracao.join(" ") === "1–8 9–24 25–32",
  "os lugares numeram-se de ponta a ponta da fila — «lugar 12» é UM lugar");

// ---- 2. Em branco = como era antes ---------------------------------------
console.log("\n== em branco continua automático ==");
const auto = await montarPlateia({ ...SALA, corredores: 2 }, [null, null, null], "");
console.log("   porFila: " + auto.porFila);
conferir(auto.porFila > 0 && auto.porFila !== 32,
  "sem números escritos, a app volta a contar os que cabem (" + auto.porFila + ")");
conferir(!auto.avisoLugares, "e não se queixa de nada");

// ---- 3. O corredor depois da fila H --------------------------------------
//
// O vão tem de EMPURRAR as filas de trás, não apagá-las: o que se pede é um
// corredor no meio da plateia, não menos lugares.
console.log("\n== corredor depois da fila C ==");
const semCorte = await montarPlateia({ ...SALA, corredores: 1, filas: 8 }, [10, 10], "");
const comCorte = await montarPlateia({ ...SALA, corredores: 1, filas: 8 }, [10, 10], "C");
console.log("   sem corredor: " + JSON.stringify(semCorte.zDasFilas));
console.log("   com corredor: " + JSON.stringify(comCorte.zDasFilas));
conferir(JSON.stringify(comCorte.cortes) === "[2]",
  "a letra C vira a fila 2 (A=0) — o campo fala em letras, por dentro são índices");
conferir(comCorte.filas === semCorte.filas,
  "as filas continuam todas lá (" + comCorte.filas + ") — o corredor abre um vão, não apaga gente");
if (comCorte.zDasFilas && semCorte.zDasFilas && comCorte.zDasFilas.length > 3) {
  const saltoAntes = Math.round((semCorte.zDasFilas[3] - semCorte.zDasFilas[2]) * 100) / 100;
  const saltoDepois = Math.round((comCorte.zDasFilas[3] - comCorte.zDasFilas[2]) * 100) / 100;
  console.log("   entre C e D: " + saltoAntes + " m → " + saltoDepois + " m");
  conferir(Math.abs(saltoDepois - (saltoAntes + 1.2)) < 0.01,
    "entre a fila C e a D entra mesmo a largura do corredor (1,20 m)");
  conferir(Math.abs(comCorte.zDasFilas[0] - semCorte.zDasFilas[0]) < 1e-6,
    "e as filas ANTES do corredor não se mexem");
}

// ---- 4. As letras ---------------------------------------------------------
console.log("\n== as letras das filas ==");
const letras = await pagina.evaluate(() => {
  const l = window.preview.letraDaFila, f = window.preview.filaDaLetra;
  return { a: l(0), h: l(7), z: l(25), aa: l(26), ab: l(27),
           deH: f("H"), deAA: f("AA"), minusculas: f(" h "), lixo: f("3"), vazio: f("") };
});
console.log("   " + JSON.stringify(letras));
conferir(letras.a === "A" && letras.h === "H" && letras.z === "Z",
  "A é a fila da frente, H é a oitava");
conferir(letras.aa === "AA" && letras.ab === "AB",
  "depois do Z segue AA — uma sala de congressos passa dos 26 sem esforço");
conferir(letras.deH === 7 && letras.deAA === 26, "e lê-se no sentido contrário");
conferir(letras.minusculas === 7, "aceita como se escreve: minúsculas e espaços");
conferir(letras.lixo === null && letras.vazio === null,
  "o que não é uma letra não vira fila nenhuma (não abre um corredor no sítio errado)");
console.log("   nota no painel: " + comCorte.notaFilas);
conferir(/A a H/.test(comCorte.notaFilas),
  "e o painel diz as letras que EXISTEM — numa sala de 8 filas, escrever «P» não abre nada");

// ---- 5. Quando não cabe, diz ---------------------------------------------
console.log("\n== lugares a mais para a sala ==");
const demais = await montarPlateia({ ...SALA, salaL: 10, corredores: 1 }, [40, 40], "");
console.log("   " + (demais.avisoLugares || "(sem aviso)"));
conferir(!!demais.apertado, "a app repara que os lugares pedidos não cabem à largura");
conferir(/não cabe|só dá|mais larga/.test(demais.avisoLugares),
  "e diz — em vez de encolher em silêncio e dar uma lotação que não é a escrita");
conferir(demais.porFila === 80,
  "e desenha os 80 pedidos: a lotação escrita é a que alguém leva para a obra");

// ---- 6. Os gomos, que é onde isto foi pedido -----------------------------
console.log("\n== e nos gomos ==");
const nosGomos = await pagina.evaluate(async () => {
  const por = (id, v) => { const el = document.getElementById(id);
    if (!el) return;
    if (el.type === "checkbox") el.checked = !!v; else el.value = String(v);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true })); };
  const circular = document.querySelector('#formatoPlateia [data-forma="circular"]');
  if (circular) circular.click();
  await new Promise((r) => setTimeout(r, 400));
  por("gomos", 3);
  por("filas", 8);
  const antes = window.preview.gente ? window.preview.gente.lugares : null;
  por("corredoresHorizontais", "C");
  await new Promise((r) => setTimeout(r, 1000));
  const g = window.preview.gente;
  return { lugares: g ? g.lugares : null, antes,
           formato: document.getElementById("formatoPlateia").dataset.valor };
});
console.log("   " + JSON.stringify(nosGomos));
conferir(nosGomos.formato === "circular", "a plateia está em gomos");
conferir(nosGomos.lugares > 0,
  "com um corredor horizontal, os gomos continuam a ter gente (" + nosGomos.lugares + " lugares)");

// ---- 7. A Cobertura diz QUE lugares ficam sem ver -----------------------
//
// *"Assim serve de coordenadas"*. E serve: até aqui a Cobertura dizia "bloco
// 2: 14 lugares sem ecrã", que conta mas não localiza -- ninguém vai à sala
// tirar catorze cadeiras que não sabe quais são.
//
// O caso é um ecrã pequeno numa sala funda: a regra da distância corta as
// filas de trás, e essas são as que têm de aparecer pelo nome.
console.log("\n== a Cobertura pelo nome dos lugares ==");
// O projeto entra pela ponte (localStorage), como vem dos Calculadores — é
// por aí que um ecrã chega ao 3D, e não pela caixa de colagem.
await pagina.evaluate(() => {
  localStorage.setItem("mikeapps-sincronizacao-v1", JSON.stringify("ligada"));
  localStorage.setItem("mikeapps-projeto-v1", JSON.stringify({
    nome: "Cobertura", origem: "calculadores",
    sala: { largura: 20, profundidade: 40, altura: 8 },
    // Um ecrã PEQUENO numa sala funda: a regra da distância corta as filas de
    // trás, e são essas que têm de aparecer pelo nome.
    zonas: [{ nome: "Ecrã", id: "z1", x: 0, y: 0, w: 1.6, h: 0.9,
              cor: "#2e7bff", tipo: "led" }]
  }));
});
await pagina.reload({ waitUntil: "networkidle" });
await pagina.waitForFunction(() => window.preview && window.preview.montar, null, { timeout: 30000 });
await pagina.waitForTimeout(1200);

const cobertura = await pagina.evaluate(async () => {
  const por = (id, v) => { const el = document.getElementById(id);
    if (!el) return;
    if (el.type === "checkbox") el.checked = !!v; else el.value = String(v);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true })); };
  const reto = document.querySelector('#formatoPlateia [data-forma="reto"]');
  if (reto) reto.click();
  await new Promise((r) => setTimeout(r, 400));
  por("salaL", 20); por("salaP", 40); por("palcoL", 8); por("palcoP", 3);
  por("filas", 14); por("corredores", 1); por("entreLugares", 0.5);
  por("primeiraFila", 3); por("entreFilas", 1.0);
  por("verPublico", true); por("verCobertura", true);
  await new Promise((r) => setTimeout(r, 300));
  [...document.querySelectorAll("#lugaresPorBloco input")].forEach((el) => {
    el.value = "6"; el.dispatchEvent(new Event("input", { bubbles: true }));
  });
  por("corredoresHorizontais", "");
  await new Promise((r) => setTimeout(r, 1800));
  return {
    resumo: (document.getElementById("resumoCobertura") || {}).textContent || "",
    onde: (window.preview.ultimaCobertura || {}).semCoberturaOnde || null
  };
});
console.log("   " + cobertura.resumo.replace(/\s+/g, " ").slice(0, 300));
conferir(/Sem ver:/.test(cobertura.resumo),
  "o painel diz QUE lugares ficam sem ver, e não só quantos");
conferir(/fila [A-Z]+ lugar/.test(cobertura.resumo),
  "e diz a morada como se fala na sala: «fila N lugares 1–6»");
// Esta passava por acaso antes de eu a apertar: /–|, / dava verdade com
// qualquer travessão do painel, mesmo sem lista nenhuma. Agora exige o
// feitio do intervalo colado ao "lugares".
conferir(/lugares \d+–\d+/.test(cobertura.resumo),
  "os lugares seguidos juntam-se num intervalo («lugares 1–12»), em vez de doze números em fila");

// A conta por trás, sem o texto pelo meio.
const moradas = await pagina.evaluate(() => {
  const g = window.preview.gente;
  const c = window.preview.ultimaCobertura;
  if (!g || !c) return null;
  // Quantos lugares a lista nomeia, contra quantos a contagem diz que há.
  let nomeados = 0;
  const vistos = new Set();
  for (let i = 0; i < c.corPorLugar.length; i++) {
    if (c.corPorLugar[i] === 0) { nomeados++; vistos.add(g.filaPorLugar[i]); }
  }
  return { semCobertura: c.semCobertura, nomeados, filas: vistos.size,
           listadas: (c.semCoberturaOnde || []).length };
});
console.log("   " + JSON.stringify(moradas));
if (moradas) {
  conferir(moradas.semCobertura === moradas.nomeados,
    "o número que o painel conta e os lugares que têm morada são os MESMOS");
  conferir(moradas.listadas > 0 && moradas.listadas <= 7,
    "a lista corta-se nas primeiras filas (+ «e mais N filas») — meia plateia escrita não se lê");
}

conferir(erros.length === 0, erros.length ? "erro de JavaScript: " + erros[0] : "sem erros de JavaScript");

await browser.close();
s.close();
console.log("\n" + (falhas ? falhas + " FALHA(S)"
  : "A plateia tem nome, e o corredor entra onde se lhe manda."));
process.exit(falhas ? 1 : 0);
