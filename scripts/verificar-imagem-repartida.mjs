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

console.log("\n== e diz quando não desenha o que lhe pediram ==");

// Reparo dele, duas vezes e com foto: *"algo não está bem"*, com a calculadora
// a dizer uma tela de 30 x 8 m e o 3D a mostrar imagens pequenas.
//
// As duas apps tinham os dois números e NUNCA OS COMPARAVAM: a medida pedida
// viaja na ponte desde sempre (o `largura` de cada máquina) e este lado só a
// usava para saber o formato. O que se desenha sai do rácio e da distância
// DESTES campos — e esses podem ter sido mexidos à mão, ou ter ficado de outra
// montagem.
const conferido = await pagina.evaluate(async () => {
  const w = window.preview;
  // O PANO DE VOLTA À PAREDE. A secção de cima deixou-o 9 m para dentro, e aí
  // o desenho REALMENTE não é do tamanho pedido -- o aviso apareceria com toda
  // a razão, e este pedaço não estaria a medir o que julga. (Foi o que
  // aconteceu à primeira.)
  const dz = document.getElementById("projDz");
  dz.value = "0";
  dz.dispatchEvent(new Event("input", { bubbles: true }));
  await new Promise((r) => setTimeout(r, 1200));
  // Uma carga com a medida pedida escrita, como a que vem do Blending.
  localStorage.setItem("mikeapps-projetor-v1", JSON.stringify({
    v: 2, retro: false, curva: null, alturaLente: 6, shiftV: -50,
    projetores: [-1, 0, 1].map((k) => ({
      lateral: +(k * 3.4).toFixed(2), alturaOffset: 0,
      largura: 5.05, altura: 2.84, racio: 3.563, distancia: 18 })),
    quando: new Date().toISOString()
  }));
  document.getElementById("btSincronizar").click();
  await new Promise((r) => setTimeout(r, 2500));
  const certo = (document.getElementById("coordsNota") || {}).textContent || "";
  // E agora o caso dele: os campos daqui já não são os de lá.
  const e = document.getElementById("projDist");
  e.value = "5";
  e.dispatchEvent(new Event("input", { bubbles: true }));
  await new Promise((r) => setTimeout(r, 1600));
  return { certo, mexido: (document.getElementById("coordsNota") || {}).textContent || "",
           pedida: w.ajustes.larguraPedidaDoPrincipal };
});
conferir(conferido.pedida === 5.05,
  "a medida pedida viaja na ponte e fica guardada (" + conferido.pedida + " m)");
conferir(!/não é o tamanho que os Calculadores pediram/.test(conferido.certo),
  "acabado de sincronizar, o desenho bate certo e a app NÃO avisa — um aviso que aparece sempre deixa de ser um aviso");
conferir(/não é o tamanho que os Calculadores pediram/.test(conferido.mexido),
  "mas com a distância mexida à mão, di-lo");
conferir(/5,05 m/.test(conferido.mexido) && /1,40 m/.test(conferido.mexido),
  "COM OS DOIS NÚMEROS à frente — o que lá se pediu e o que aqui se desenha");

// E ONDE ELE ESTÁ A OLHAR. Terceira foto do mesmo blend: *"continua a não
// montar o blend"*, sem mencionar aviso nenhum — porque o aviso vivia dentro
// de "Coordenadas de montagem", que é uma secção FECHADA. Um aviso dentro de
// uma gaveta não existe para ninguém; esta app já apanhou isto uma vez, com o
// ecrã curvo ("não desenha o curvo", e a carga estava guardada a dizer-se numa
// gaveta que ninguém tinha aberto).
const ondeEleOlha = await pagina.evaluate(() => {
  const n = document.getElementById("avisoDoBlend");
  return { visivel: !!(n && n.style.display !== "none"), texto: (n || {}).textContent || "" };
});
conferir(ondeEleOlha.visivel,
  "e o aviso aparece no painel da Projeção, não só dentro das Coordenadas");
conferir(/5,05/.test(ondeEleOlha.texto) && /não é o tamanho/.test(ondeEleOlha.texto),
  "com o mesmo recado e os mesmos números");

// E O BOTÃO QUE RESOLVE. Medido no estado real dele: pano a 25,00 m para
// dentro de uma sala de 50 m, tiro de 18 m caído para 7 m, imagens de 5,51 m
// com 2,37 m de preto entre elas. Tudo certo no desenho -- o que faltava era
// ele saber que campo procurar. Um aviso que descreve e não resolve obriga a
// pessoa a traduzir a frase num campo.
const oBotao = await pagina.evaluate(async () => {
  // A DISTÂNCIA DE VOLTA AOS 18 m. O pedaço de cima mexeu-a para 5 à mão, e
  // com ela assim a primeira máquina fica pequena por OUTRA razão -- este
  // pedaço não estaria a medir o que julga. (É a segunda vez neste ficheiro:
  // um teste que herda o estado do anterior mede sempre outra coisa.)
  const dist = document.getElementById("projDist");
  dist.value = "18";
  dist.dispatchEvent(new Event("input", { bubbles: true }));
  await new Promise((r) => setTimeout(r, 1200));
  const dz = document.getElementById("projDz");
  dz.value = "9";
  dz.dispatchEvent(new Event("input", { bubbles: true }));
  await new Promise((r) => setTimeout(r, 1500));
  const b = document.getElementById("btEncostarPano");
  const antes = { visivel: !!(b && !b.hidden), texto: (b || {}).textContent || "" };
  if (b && !b.hidden) b.click();
  await new Promise((r) => setTimeout(r, 1600));
  const w = window.preview, THREE = w.THREE;
  const larguras = [];
  w.desenhado.traverse((o) => {
    if (o.isMesh && /projecao-imagem/.test(o.name || "")) {
      const bb = new THREE.Box3().setFromObject(o);
      if (!bb.isEmpty()) larguras.push(+((bb.max.x - bb.min.x)).toFixed(2));
    }
  });
  return { antes, dz: document.getElementById("projDz").value, larguras,
           aindaVisivel: !document.getElementById("btEncostarPano").hidden };
});
conferir(oBotao.antes.visivel && /9/.test(oBotao.antes.texto),
  "com o pano fora da parede aparece o botão, e diz quanto ele andou (" +
  oBotao.antes.texto.trim() + ")");
conferir(Number(oBotao.dz) === 0, "um toque encosta-o à parede (projDz = " + oBotao.dz + ")");
conferir(oBotao.larguras.length === 3 && oBotao.larguras.every((l) => Math.abs(l - 5.05) < 0.1),
  "e as imagens voltam ao tamanho que os Calculadores pediram (" +
  oBotao.larguras.join(" · ") + " m)");
conferir(!oBotao.aindaVisivel, "e o botão desaparece, porque já não há nada para resolver");

conferir(erros.length === 0, erros.length ? "erro de JavaScript: " + erros[0] : "sem erros de JavaScript");

await browser.close();
s.close();
console.log(falhas ? `\n${falhas} a corrigir.` : "\nUma imagem só, repartida por todas as máquinas.");
process.exit(falhas ? 1 : 0);
