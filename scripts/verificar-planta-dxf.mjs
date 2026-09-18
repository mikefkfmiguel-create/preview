/**
 * AS MEDIDAS DA PLANTA TÊM DE BATER CERTO — É PARA ISSO QUE ELA SERVE.
 *
 * Pedido: *"seria para exportar e enviar para a engenharia de desenho, que
 * confere e envia para o cliente"*, e logo a seguir o critério, com todas as
 * letras: *"medidas correctas para conferência"*.
 *
 * Portanto o que este teste mede não é se o ficheiro abre, nem se está bonito:
 * é se o que o desenhador MEDIR no Vectorworks dá o número que a app diz. Uma
 * planta bonita com meio metro a menos é pior do que planta nenhuma -- vai
 * para o cliente com a assinatura de alguém por baixo.
 *
 * E mede-se da melhor maneira que havia à mão, que não fui eu que inventei:
 * a app JÁ TEM UM LEITOR DE DXF (js/dxf.js, que lê as plantas que entram). O
 * teste escreve a planta, lê-a de volta com esse leitor, e compara com o que a
 * app diz no painel. Escrever um segundo leitor aqui para conferir o primeiro
 * seria conferir a minha cópia da conta.
 *
 * As três coisas que não podem falhar:
 *
 *   1. as UNIDADES -- o ficheiro tem de declarar metros, senão tudo o resto é
 *      um erro de escala à espera de acontecer;
 *   2. as MEDIDAS -- sala, palco, ecrã, distância à primeira fila;
 *   3. as CAMADAS -- é o que deixa o desenhador ligar e desligar e desenhar
 *      por cima, e é a diferença entre um desenho e uma mancha.
 *
 *   node scripts/verificar-planta-dxf.mjs
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
// Um milímetro de tolerância. Numa planta de sala, um milímetro é o ruído do
// arredondamento; um centímetro já é uma diferença que alguém nota.
const bate = (a, b, tol) => Math.abs(a - b) <= (tol || 0.001);

const pagina = await ctx.newPage();
const erros = [];
pagina.on("pageerror", (e) => erros.push(e.message));

// A SALA DO TESTE, com números redondos de propósito: assim qualquer engano
// salta à vista em vez de se esconder numa casa decimal.
const SALA = { largura: 24, profundidade: 30, altura: 9 };
const ECRA = { largura: 8, altura: 4.5 };

await pagina.goto(`http://127.0.0.1:${porta}/index.html`, { waitUntil: "networkidle" });
await pagina.evaluate(([sala, ecra]) => {
  localStorage.setItem("mikeapps-sincronizacao-v1", JSON.stringify("ligada"));
  localStorage.setItem("mikeapps-projeto-v1", JSON.stringify({
    nome: "Planta", origem: "calculadores", sala,
    zonas: [{ nome: "Ecrã principal", id: "z1", x: 0, y: 0,
              w: ecra.largura, h: ecra.altura, cor: "#2e7bff", tipo: "led" }]
  }));
}, [SALA, ECRA]);
await pagina.reload({ waitUntil: "networkidle" });
await pagina.waitForFunction(() => window.preview && window.preview.plantaEmDXF, null, { timeout: 30000 });
await pagina.waitForTimeout(1200);

const PALCO = { largura: 12, profundidade: 6, altura: 1 };
const PRIMEIRA_FILA = 4;

const resultado = await pagina.evaluate(async ([sala, palco, primeiraFila]) => {
  const por = (id, v) => { const el = document.getElementById(id);
    if (!el) return;
    if (el.type === "checkbox") el.checked = !!v; else el.value = String(v);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true })); };
  por("salaL", sala.largura); por("salaP", sala.profundidade); por("salaA", sala.altura);
  por("palcoL", palco.largura); por("palcoP", palco.profundidade); por("palcoA", palco.altura);
  por("palcoX", 0); por("palcoZ", 0);
  por("filas", 10); por("primeiraFila", primeiraFila); por("entreFilas", 0.9);
  por("entreLugares", 0.5); por("corredores", 1); por("larguraCorredor", 1.2);
  por("verPalco", true); por("verPublico", true);
  await new Promise((r) => setTimeout(r, 1500));
  const dxf = window.preview.plantaEmDXF();
  const g = window.preview.gente;
  return {
    dxf,
    primeiraFilaZ: g && g.filasInfo && g.filasInfo.length ? g.filasInfo[0].z : null,
    frentePalcoZ: window.preview.frenteDoPalco(sala, {
      largura: palco.largura, profundidade: palco.profundidade,
      altura: palco.altura, dx: 0, dz: 0 }).z
  };
}, [SALA, PALCO, PRIMEIRA_FILA]);

const dxf = resultado.dxf;
console.log("\n== o ficheiro ==");
console.log("   " + dxf.length.toLocaleString("pt-PT") + " caracteres");

// ---- 1. As unidades, antes de tudo o resto ------------------------------
console.log("\n== as unidades ==");
const insunits = (dxf.match(/\$INSUNITS\s*\n\s*70\s*\n\s*(\d+)/) || [])[1];
console.log("   $INSUNITS = " + insunits);
conferir(insunits === "6",
  "o ficheiro declara METROS ($INSUNITS 6) — sem isto, tudo o resto é um erro de escala à espera");
conferir(/\$MEASUREMENT\s*\n\s*70\s*\n\s*1/.test(dxf), "e declara-se métrico");

// ---- 2. Lê-se de volta com o leitor da própria app ----------------------
//
// O leitor que já cá estava, o mesmo que abre as plantas que entram.
console.log("\n== lido de volta pelo leitor da app ==");
const lido = await pagina.evaluate(async (texto) => {
  const { lerDXF } = await import("./js/dxf.js");
  const d = lerDXF(texto);
  return {
    segmentos: d.segmentos, insunits: d.insunits,
    camadas: d.camadas.map((c) => c.nome).sort(),
    minX: d.minX, maxX: d.maxX, minY: d.minY, maxY: d.maxY,
    // Os segmentos de cada camada, para se poder medir peça a peça.
    porCamada: d.camadas.map((c) => {
      const seg = [];
      for (let i = 0; i < d.segmentos; i++) {
        if (d.deQuemE[i] !== c.indice) continue;
        seg.push([d.pontos[i * 4], d.pontos[i * 4 + 1], d.pontos[i * 4 + 2], d.pontos[i * 4 + 3]]);
      }
      return { nome: c.nome, seg };
    })
  };
}, dxf);
console.log("   " + lido.segmentos + " segmentos · camadas: " + lido.camadas.join(", "));
conferir(lido.segmentos > 0, "o leitor da app lê o que a app escreveu");
conferir(lido.insunits === 6, "e vê os metros no cabeçalho");

// ---- 3. AS MEDIDAS -------------------------------------------------------
//
// O que o desenhador vai medir.
console.log("\n== as medidas ==");
// SÓ A PARTE DA PLANTA -- e agora basta pedir a camada, porque o alçado tem as
// suas (ALCADO-PALCO, ALCADO-ECRAS…).
//
// Aqui havia um corte em Y para separar as duas vistas, porque elas
// partilhavam camada e medir "PALCO" dava a caixa das duas juntas. Isso deixou
// de ser preciso -- e deixou de ser preciso por causa de um defeito que só
// apareceu do outro lado: com camadas partilhadas, reabrir este DXF na app
// punha o alçado deitado no chão da sala e o desenho fora do sítio. Ver
// scripts/verificar-planta-de-volta.mjs.
const caixaDe = (nome) => {
  const c = lido.porCamada.find((x) => x.nome === nome);
  if (!c || !c.seg.length) return null;
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const [x1, y1, x2, y2] of c.seg) {
    minX = Math.min(minX, x1, x2); maxX = Math.max(maxX, x1, x2);
    minY = Math.min(minY, y1, y2); maxY = Math.max(maxY, y1, y2);
  }
  return { minX, maxX, minY, maxY, largura: maxX - minX, profundidade: maxY - minY };
};

const cSala = caixaDe("SALA");
console.log("   SALA:  " + (cSala ? cSala.largura.toFixed(3) + " x " + cSala.profundidade.toFixed(3) : "—"));
conferir(cSala && bate(cSala.largura, SALA.largura) && bate(cSala.profundidade, SALA.profundidade),
  "a sala mede exactamente " + SALA.largura + " x " + SALA.profundidade + " m");

const cPalco = caixaDe("PALCO");
console.log("   PALCO: " + (cPalco ? cPalco.largura.toFixed(3) + " x " + cPalco.profundidade.toFixed(3) : "—"));
conferir(cPalco && bate(cPalco.largura, PALCO.largura) && bate(cPalco.profundidade, PALCO.profundidade),
  "o palco mede " + PALCO.largura + " x " + PALCO.profundidade + " m");
conferir(cPalco && bate(cPalco.maxY, SALA.profundidade / 2),
  "e está encostado ao fundo da sala, no sítio certo da folha");

const cEcra = caixaDe("ECRAS");
console.log("   ECRAS: " + (cEcra ? cEcra.largura.toFixed(3) : "—"));
conferir(cEcra && bate(cEcra.largura, ECRA.largura, 0.002),
  "o ecrã mede os " + ECRA.largura + " m de largura que a app diz");

// A distância do palco à primeira fila, que é a medida mais conferida de
// todas numa planta destas. Compara-se com o que a app tem por dentro.
const distanciaApp = resultado.primeiraFilaZ - resultado.frentePalcoZ;
console.log("   palco → 1ª fila, pela app: " + distanciaApp.toFixed(3) + " m");
conferir(bate(distanciaApp, PRIMEIRA_FILA, 0.002),
  "a app tem a primeira fila a " + PRIMEIRA_FILA + " m da boca de cena");
const cPlateia = caixaDe("PLATEIA");
if (cPlateia && cPalco) {
  const noDesenho = cPalco.minY - cPlateia.maxY;
  console.log("   palco → 1ª fila, no desenho: " + noDesenho.toFixed(3) + " m");
  // Sem tolerância folgada: é a medida que o desenhador tira com a fita, e
  // tem de dar o número que está no campo. A primeira versão disto aceitava
  // 30 cm de diferença e passou a verde com o desenho a dizer 3,75 -- uma
  // tolerância generosa num teste de conferência é o mesmo que não o ter.
  conferir(bate(noDesenho, PRIMEIRA_FILA, 0.002),
    "e no desenho mede EXACTAMENTE o mesmo — é a medida que se confere com a fita");
}

// ---- 4. As camadas -------------------------------------------------------
console.log("\n== as camadas ==");
["SALA", "PALCO", "ECRAS", "PLATEIA", "COTAS"].forEach((nome) => {
  conferir(lido.camadas.includes(nome),
    "há uma camada " + nome + " — o desenhador liga e desliga o que quer");
});
conferir(!lido.camadas.includes("0") || lido.camadas.length > 4,
  "e o desenho não caiu todo na camada 0");

// ---- 5. E o palco deslocado continua a bater certo ----------------------
//
// O palco passou a mover-se (v3.68). Se a planta o desenhasse na posição
// antiga, a conferência dava uma diferença sem ninguém saber de onde vinha.
console.log("\n== com o palco deslocado 3 m para dentro ==");
const movido = await pagina.evaluate(async () => {
  const por = (id, v) => { const el = document.getElementById(id);
    el.value = String(v);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true })); };
  por("palcoZ", 3);
  await new Promise((r) => setTimeout(r, 1500));
  const texto = window.preview.plantaEmDXF();
  const { lerDXF } = await import("./js/dxf.js");
  const d = lerDXF(texto);
  const i = d.camadas.find((c) => c.nome === "PALCO");
  if (!i) return null;
  let maxY = -Infinity, minY = Infinity;
  for (let k = 0; k < d.segmentos; k++) {
    if (d.deQuemE[k] !== i.indice) continue;
    maxY = Math.max(maxY, d.pontos[k * 4 + 1], d.pontos[k * 4 + 3]);
    minY = Math.min(minY, d.pontos[k * 4 + 1], d.pontos[k * 4 + 3]);
  }
  return { maxY, minY };
});
console.log("   PALCO no desenho: y " + (movido ? movido.minY.toFixed(2) + " .. " + movido.maxY.toFixed(2) : "—"));
conferir(movido && bate(movido.maxY, SALA.profundidade / 2 - 3, 0.002),
  "o palco no desenho está 3 m mais para dentro — a planta acompanha o que se mexeu");

// ---- 6. O ALÇADO ---------------------------------------------------------
//
// Pedido a seguir à planta: *"podes pôr o alçado sim"*, com a condição *"se
// existir"*. Por isso mede-se as duas coisas: que ele lá está com as alturas
// certas, e que NÃO aparece quando não há nada com altura para mostrar.
console.log("\n== o alçado ==");
const comAlcado = await pagina.evaluate(async () => {
  const por = (id, v) => { const el = document.getElementById(id);
    if (!el) return;
    if (el.type === "checkbox") el.checked = !!v; else el.value = String(v);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true })); };
  por("palcoZ", 0); por("verPalco", true); por("ecraOffset", 1.5);
  await new Promise((r) => setTimeout(r, 1500));
  const texto = window.preview.plantaEmDXF();
  const { lerDXF } = await import("./js/dxf.js");
  const d = lerDXF(texto);
  // O alçado tem camadas suas, por isso pede-se pelo nome em vez de se cortar
  // o desenho ao meio em Y. O corte que aqui estava era um remendo à volta de
  // camadas partilhadas -- e camadas partilhadas eram o defeito.
  const caixa = (camada) => {
    const c = d.camadas.find((x) => x.nome === camada);
    if (!c) return null;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, houve = false;
    for (let k = 0; k < d.segmentos; k++) {
      if (d.deQuemE[k] !== c.indice) continue;
      houve = true;
      minX = Math.min(minX, d.pontos[k * 4], d.pontos[k * 4 + 2]);
      maxX = Math.max(maxX, d.pontos[k * 4], d.pontos[k * 4 + 2]);
      minY = Math.min(minY, d.pontos[k * 4 + 1], d.pontos[k * 4 + 3]);
      maxY = Math.max(maxY, d.pontos[k * 4 + 1], d.pontos[k * 4 + 3]);
    }
    return houve ? { minX, maxX, minY, maxY,
                     largura: maxX - minX, altura: maxY - minY } : null;
  };
  return { temTexto: /ALÇADO FRONTAL/.test(texto),
           camadas: d.camadas.map((c) => c.nome),
           palco: caixa("ALCADO-PALCO"), ecras: caixa("ALCADO-ECRAS") };
});
console.log("   " + JSON.stringify(comAlcado));
conferir(comAlcado.temTexto, "o desenho leva um alçado, identificado");
conferir(comAlcado.palco && bate(comAlcado.palco.altura, PALCO.altura),
  "o palco mede " + PALCO.altura + " m de altura no alçado");
conferir(comAlcado.ecras && bate(comAlcado.ecras.altura, ECRA.altura, 0.002),
  "e o ecrã mede os " + ECRA.altura + " m de altura que a app diz");
conferir(comAlcado.ecras && bate(comAlcado.ecras.largura, ECRA.largura, 0.002),
  "com a mesma largura da planta — os dois desenhos alinham em X");
// As camadas do alçado são dele: é o que deixa desligá-lo para conferir só a
// planta, e é o que impede o alçado de entrar deitado no chão ao reabrir este
// ficheiro na app.
conferir(comAlcado.camadas.some((n) => /^ALCADO-/.test(n)),
  "e vive em camadas próprias (ALCADO-…), que se desligam sem levar a planta atrás");

// E agora o "se existir": sem palco e sem ecrãs, não há alçado.
console.log("\n== uma sala sem nada com altura ==");
// Tirar o projeto do localStorage não chega: ele já está em memória. A app
// tem de abrir de raiz sem nada, que é o estado que se quer medir.
await pagina.evaluate(() => localStorage.removeItem("mikeapps-projeto-v1"));
await pagina.reload({ waitUntil: "networkidle" });
await pagina.waitForFunction(() => window.preview && window.preview.plantaEmDXF, null, { timeout: 30000 });
await pagina.waitForTimeout(1200);
const semAlcado = await pagina.evaluate(async () => {
  const por = (id, v) => { const el = document.getElementById(id);
    if (!el) return;
    if (el.type === "checkbox") el.checked = !!v; else el.value = String(v);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true })); };
  por("verPalco", false);
  await new Promise((r) => setTimeout(r, 1200));
  const texto = window.preview.plantaEmDXF();
  return { temAlcado: /ALÇADO FRONTAL/.test(texto),
           zonas: (window.preview.gente ? 1 : 0), tamanho: texto.length };
});
console.log("   " + JSON.stringify(semAlcado));
conferir(!semAlcado.temAlcado,
  "sem palco e sem ecrãs não sai alçado nenhum — «se existir», como foi pedido");

conferir(erros.length === 0, erros.length ? "erro de JavaScript: " + erros[0] : "sem erros de JavaScript");

await browser.close();
s.close();
console.log("\n" + (falhas ? falhas + " FALHA(S)"
  : "A planta mede o que a app diz — dá para conferir."));
process.exit(falhas ? 1 : 0);
