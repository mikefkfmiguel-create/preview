/**
 * UMA IMAGEM REPARTIDA POR TODAS AS MÁQUINAS DO BLEND.
 *
 * Reparo dele, a olhar para uma fila de três: *"nos projetores não está a
 * preencher por todos — fica sempre uma imagem em cada um"*.
 *
 * E ficava: o `fazerProjecao()` punha a textura INTEIRA em cada imagem, por
 * isso uma fila de três mostrava o mesmo desenho três vezes lado a lado. Um
 * blend existe exactamente para o contrário — uma imagem só, repartida, com as
 * juntas sobrepostas.
 *
 * O mecanismo já cá estava, para os ecrãs LED (ver fazerZona() em cena.js): a
 * textura clona-se e cada peça leva o seu `repeat`/`offset`. Nunca tinha
 * chegado aos projetores, e o interruptor do painel — "Uma imagem por todos" /
 * "A mesma em cada" — não os governava.
 *
 * Pelo caminho apanhou-se um espelho que já lá estava no ecrã CURVO: a
 * geometria do cilindro põe o u = 0 do lado +x da sala (a direita de quem
 * olha), por isso a imagem lia-se ao contrário. Com a textura inteira em cada
 * fatia ninguém dava por isso — uma imagem repetida não tem princípio nem fim
 * visíveis. Visto ao vivo com o padrão de teste, as barras saíam azul,
 * vermelho, magenta, verde, ciano, amarelo, branco.
 *
 *   node scripts/verificar-imagem-repartida.mjs
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

const ARCO = 2 * 20 * Math.asin(15 / 20);
const PLANO = JSON.stringify({
  v: 2, retro: false, curva: null, alturaLente: 6, shiftV: -50,
  projetores: [-1, 0, 1].map((k) => ({ lateral: +(k * 3.4).toFixed(2), alturaOffset: 0,
    largura: 5.05, altura: 2.84, racio: 3.563, distancia: 18 })),
  quando: new Date().toISOString()
});
const CURVO = JSON.stringify({
  v: 2, retro: false, alturaLente: 4, shiftV: 0,
  curva: { raio: 20, corda: 30, arco: +ARCO.toFixed(3), altura: 8,
           alturaLente: 4, shiftV: 0, montagem: "arco", retro: false },
  projetores: [-1, 0, 1].map((k) => ({ lateral: +(k * ARCO / 3).toFixed(2), alturaOffset: 0,
    largura: 14.28, altura: 8, racio: 1.197, distancia: 18 })),
  quando: new Date().toISOString()
});
const PROJETO = JSON.stringify({
  nome: "Sala", origem: "calculadores", alturaDoChao: 1,
  sala: { largura: 40, profundidade: 40, altura: 12 }, zonas: []
});

async function montarCom(ponte) {
  await pagina.goto(`http://127.0.0.1:${porta}/index.html`, { waitUntil: "networkidle" });
  await pagina.evaluate((a) => {
    localStorage.clear();
    localStorage.setItem("mikeapps-sincronizacao-v1", JSON.stringify("ligada"));
    localStorage.setItem("mikeapps-projeto-v1", a[0]);
    localStorage.setItem("mikeapps-projetor-v1", a[1]);
  }, [PROJETO, ponte]);
  await pagina.reload({ waitUntil: "networkidle" });
  await pagina.waitForFunction(() => window.preview && window.preview.montar, null, { timeout: 30000 });
  await pagina.waitForTimeout(1500);
  await pagina.evaluate(async () => {
    document.getElementById("btSincronizar").click();
    await new Promise((r) => setTimeout(r, 2500));
  });
  // Uma imagem que se lê: as barras vão de branco (esquerda) a azul (direita).
  await pagina.evaluate(async () => {
    document.getElementById("btPadrao").click();
    await new Promise((r) => setTimeout(r, 2000));
  });
}
// Cada máquina, e o pedaço da imagem que lhe toca -- do princípio ao fim, já
// com o sinal do `repeat` resolvido (num ecrã curvo ele é negativo).
const pedacos = () => pagina.evaluate(() => {
  const w = window.preview, saida = [];
  w.desenhado.traverse((o) => {
    if (!o.isMesh || !/projecao-imagem/.test(o.name || "")) return;
    const m = o.material && o.material.map;
    if (!m) { saida.push(null); return; }
    const a = m.offset.x, b = m.offset.x + m.repeat.x;
    saida.push({ de: +Math.min(a, b).toFixed(3), ate: +Math.max(a, b).toFixed(3) });
  });
  return saida;
});
const escolher = (modo) => pagina.evaluate(async (m) => {
  document.querySelector('[data-conteudo="' + m + '"]').click();
  await new Promise((r) => setTimeout(r, 1800));
}, modo);

console.log("\n== num pano plano ==");

await montarCom(PLANO);
const plano = await pedacos();
conferir(plano.length === 3 && plano.every(Boolean),
  "as três imagens têm textura (" + plano.length + ")");
conferir(plano[0] && perto(plano[0].de, 0, 0.01),
  "a primeira máquina começa no PRINCÍPIO da imagem (u = " + (plano[0] || {}).de + ")");
conferir(plano[2] && perto(plano[2].ate, 1, 0.01),
  "e a última acaba no FIM (u = " + (plano[2] || {}).ate + ")");
conferir(plano[0] && plano[1] && plano[0].ate > plano[1].de,
  "as juntas SOBREPÕEM-SE, que é o que um blend é (" +
  (plano[0] || {}).ate + " > " + (plano[1] || {}).de + ")");
conferir(plano.every((p) => p && p.ate - p.de < 0.5),
  "e nenhuma leva a imagem toda — era este o defeito: três cópias lado a lado");

await escolher("cada");
const cada = await pedacos();
conferir(cada.every((p) => p && perto(p.de, 0, 0.01) && perto(p.ate, 1, 0.01)),
  '"A mesma em cada" volta a pôr a imagem inteira em cada uma, como promete');

await escolher("espalhado");
const devolta = await pedacos();
conferir(devolta[0] && perto(devolta[0].de, 0, 0.01) && devolta.every((p) => p.ate - p.de < 0.5),
  "e o interruptor faz o caminho de volta");

console.log("\n== num ecrã curvo ==");

await montarCom(CURVO);
const curvo = await pedacos();
conferir(curvo.length === 3 && curvo.every(Boolean),
  "as três fatias do arco têm textura (" + curvo.length + ")");
// A ORDEM. A máquina 0 é a do lado −x, que é a ESQUERDA de quem está na
// plateia: tem de apanhar o princípio da imagem. Ao contrário disto, o padrão
// de teste saía azul → branco em vez de branco → azul.
conferir(curvo[0] && perto(curvo[0].de, 0, 0.01),
  "a máquina do lado esquerdo leva o PRINCÍPIO da imagem (u = " + (curvo[0] || {}).de + ")");
conferir(curvo[2] && perto(curvo[2].ate, 1, 0.01),
  "e a do lado direito o FIM (u = " + (curvo[2] || {}).ate + ") — sem isto, a imagem lia-se ao contrário");
conferir(curvo[0] && curvo[1] && curvo[0].ate > curvo[1].de,
  "com as juntas sobrepostas, como no plano");

console.log("\n== e a app diz quando a fila se abre ==");

// Reparo dele, com uma foto de três imagens pequenas e separadas: *"algo não
// está bem"*. Reproduzido e medido: estava tudo CERTO menos o silêncio.
//
// O pano fora da parede encurta o tiro, as imagens encolhem com ele (v3.98, e
// é o que acontece na sala) e as máquinas ficam à distância umas das outras a
// que foram calculadas. Resultado: banda preta entre elas.
//
//   pano na parede → imagens de 5,06 m, sobrepostas 1,66 m (é o blend)
//   pano 6 m para dentro → 3,37 m, a tocarem-se à justa
//   pano 9 m para dentro → 2,52 m, com 0,88 m de preto no meio
await montarCom(PLANO);
const juntas = await pagina.evaluate(() =>
  ((document.getElementById("coordsNota") || {}).textContent || ""));
conferir(!/fila abriu-se/.test(juntas),
  "com o pano na parede a fila está fechada, e a app não inventa aviso nenhum");

const aberta = await pagina.evaluate(async () => {
  const e = document.getElementById("projDz");
  e.value = "9";
  e.dispatchEvent(new Event("input", { bubbles: true }));
  await new Promise((r) => setTimeout(r, 1500));
  const w = window.preview, THREE = w.THREE;
  const xs = [];
  w.desenhado.traverse((o) => {
    if (o.isMesh && /projecao-imagem/.test(o.name || "")) {
      const b = new THREE.Box3().setFromObject(o);
      if (!b.isEmpty()) xs.push({ x0: b.min.x, x1: b.max.x });
    }
  });
  xs.sort((a, b) => a.x0 - b.x0);
  const folga = xs.length > 1 ? +(xs[1].x0 - xs[0].x1).toFixed(2) : null;
  return { folga, nota: (document.getElementById("coordsNota") || {}).textContent || "" };
});
conferir(aberta.folga > 0.5,
  "com o pano 9 m para dentro as imagens deixam mesmo de se tocar (" + aberta.folga + " m)");
conferir(/fila abriu-se/.test(aberta.nota),
  "E A APP DI-LO — era só isto que faltava: o desenho estava certo, o silêncio é que não");
conferir(/tiro/.test(aberta.nota) && /pano/.test(aberta.nota),
  "com o porquê ao lado: o tiro que ficou, e o pano que o encurtou");

conferir(erros.length === 0, erros.length ? "erro de JavaScript: " + erros[0] : "sem erros de JavaScript");

await browser.close();
s.close();
console.log(falhas ? `\n${falhas} a corrigir.` : "\nUma imagem só, repartida por todas as máquinas.");
process.exit(falhas ? 1 : 0);
