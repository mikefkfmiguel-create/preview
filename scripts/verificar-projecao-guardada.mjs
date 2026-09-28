/**
 * A PROJEÇÃO FICA GUARDADA COM O PROJETO, E UM ECRÃ CURVO PERDIDO TEM VOLTA.
 *
 * Dois reparos dele, do mesmo dia e com a mesma raiz:
 *
 * 1. *"o guardar projeto não está a guardar projetores"*. E não estava. As
 *    máquinas do blend sempre ficaram guardadas (`ajustes.projetoresExtra`),
 *    mas o INTERRUPTOR da projeção e os números dos campos viviam só no ecrã.
 *    Recarregar a app punha-os na omissão -- projeção DESLIGADA, rácio 1,4 a
 *    12 m -- e como a guarda da projeção é uma só desde a v3.94, desligada
 *    não se desenha nada: nem máquinas, nem imagens, nem tela.
 *
 *    Medido antes desta versão: tela de 30,03 m e três imagens; depois de
 *    recarregar, ZERO imagens e tela nenhuma, com as três máquinas ainda
 *    guardadas lá dentro. Foi isto que ele viu como *"o desenho perdeu o ecrã
 *    total"*.
 *
 * 2. *"não consigo voltar a pô-lo se não apagar no projeto"*. A tela curva
 *    não era uma peça daqui, era uma consequência da ponte: chegasse um blend
 *    sem curva e ela desaparecia, sem uma palavra e sem volta. Apagar o
 *    projeto todo era o único caminho de regresso -- o preço mais caro
 *    possível por um campo.
 *
 *   node scripts/verificar-projecao-guardada.mjs
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

// Uma tela curva de 30 m de corda por 8 m, com três máquinas em arco a 18 m.
const ARCO = 2 * 20 * Math.asin(15 / 20);
const MAQUINAS = [-1, 0, 1].map((k) => ({
  lateral: +(k * ARCO / 3).toFixed(2), alturaOffset: 0,
  largura: 14.28, altura: 8, racio: 1.197, distancia: 18
}));
const COM_CURVA = JSON.stringify({
  v: 2, retro: false, alturaLente: 4, shiftV: 0,
  curva: { raio: 20, corda: 30, arco: +ARCO.toFixed(3), altura: 8,
           alturaLente: 4, shiftV: 0, montagem: "arco", retro: false },
  projetores: MAQUINAS, quando: new Date().toISOString()
});
// A mesma fila, sem curva nenhuma -- é o que faz a tela desaparecer.
const SEM_CURVA = JSON.stringify({
  v: 2, retro: false, alturaLente: 4, shiftV: 0, curva: null,
  projetores: MAQUINAS, quando: new Date(Date.now() + 1000).toISOString()
});
const PROJETO = JSON.stringify({
  nome: "Palco", origem: "calculadores", alturaDoChao: 1,
  sala: { largura: 24, profundidade: 40, altura: 12 },
  zonas: [{ nome: "Cenário 1", id: "z1", x: 0, y: 0, w: 8, h: 4.5, cor: "#2e7bff", tipo: "led" }]
});

async function arrancar(ponte) {
  await pagina.goto(`http://127.0.0.1:${porta}/index.html`, { waitUntil: "networkidle" });
  await pagina.evaluate((a) => {
    localStorage.clear();
    localStorage.setItem("mikeapps-sincronizacao-v1", JSON.stringify("ligada"));
    localStorage.setItem("mikeapps-projeto-v1", a[0]);
    localStorage.setItem("mikeapps-projetor-v1", a[1]);
  }, [PROJETO, ponte]);
  await recarregar();
}
async function recarregar() {
  await pagina.reload({ waitUntil: "networkidle" });
  await pagina.waitForFunction(() => window.preview && window.preview.montar, null, { timeout: 30000 });
  await pagina.waitForTimeout(1600);
}
async function sincronizar() {
  await pagina.evaluate(async () => {
    document.getElementById("btSincronizar").click();
    await new Promise((r) => setTimeout(r, 2500));
  });
}
const medir = () => pagina.evaluate(() => {
  const w = window.preview, THREE = w.THREE;
  let tela = null, imagens = 0;
  w.desenhado.traverse((o) => {
    if (!o.isMesh) return;
    if (/ecra-curvo/.test(o.name || "")) {
      const b = new THREE.Box3().setFromObject(o);
      if (!b.isEmpty()) tela = +((b.max.x - b.min.x)).toFixed(2);
    }
    if (/projecao-imagem/.test(o.name || "")) imagens += 1;
  });
  const aviso = document.getElementById("avisoCurvaPerdida");
  const botao = document.getElementById("btReporCurva");
  return {
    tela, imagens,
    maquinasGuardadas: (w.ajustes.projetoresExtra || []).length,
    curva: !!w.ajustes.curvaDoBlend,
    ligada: document.getElementById("projLigada").checked,
    racio: document.getElementById("projRacio").value,
    distancia: document.getElementById("projDist").value,
    avisa: !!(aviso && !aviso.hidden),
    botao: !!(botao && !botao.hidden)
  };
});

console.log("\n== a projeção fica guardada com o projeto ==");

await arrancar(COM_CURVA);
await sincronizar();
const montado = await medir();
conferir(montado.tela !== null && perto(montado.tela, 30, 0.1),
  "a tela curva está desenhada (" + montado.tela + " m de ponta a ponta)");
conferir(montado.imagens === 3, "com as três imagens do blend (" + montado.imagens + ")");
conferir(montado.ligada === true, "e a projeção ligada");

// O REPARO. Antes desta versão isto dava tela nenhuma e ZERO imagens, com as
// três máquinas ainda guardadas -- a app tinha tudo menos o interruptor.
await recarregar();
const depois = await medir();
conferir(depois.maquinasGuardadas === 3,
  "recarregar a app mantém as máquinas guardadas (" + depois.maquinasGuardadas + ")");
conferir(depois.ligada === true,
  "E MANTÉM O INTERRUPTOR LIGADO — era este que se perdia, e sem ele não se desenha nada");
conferir(Number(depois.racio) === 1.2 && Number(depois.distancia) === 18,
  "e os números dos campos, em vez da omissão da app (" +
  depois.racio + ":1 a " + depois.distancia + " m, e não 1,4 a 12 m)");
conferir(depois.imagens === 3, "por isso as três imagens continuam lá (" + depois.imagens + ")");
conferir(depois.tela !== null && perto(depois.tela, 30, 0.1),
  "e a tela também (" + depois.tela + " m)");

console.log("\n== um ecrã curvo perdido tem volta ==");

// Chega uma carga sem curva: a tela some-se. Isso é o que ela quer dizer --
// o que não pode é sumir-se em silêncio e sem regresso.
await pagina.evaluate((x) => localStorage.setItem("mikeapps-projetor-v1", x), SEM_CURVA);
await sincronizar();
const perdida = await medir();
conferir(perdida.tela === null, "uma carga sem curva tira a tela, como deve");
conferir(perdida.avisa && perdida.botao,
  "mas diz-se porquê, e fica o botão para a repor — não desaparece calada");

await pagina.evaluate(async () => {
  document.getElementById("btReporCurva").click();
  await new Promise((r) => setTimeout(r, 1800));
});
const reposta = await medir();
conferir(reposta.tela !== null && perto(reposta.tela, 30, 0.1),
  "o botão repõe a tela que lá estava (" + reposta.tela + " m)");
conferir(reposta.imagens === 3,
  "com a fila INTEIRA — num curvo as máquinas são todas do arco, num plano " +
  "falta sempre a primeira (" + reposta.imagens + ")");

// E de um dia para o outro: a volta atrás não pode morrer ao fechar a janela.
await pagina.evaluate((x) => localStorage.setItem("mikeapps-projetor-v1", x), SEM_CURVA);
await sincronizar();
await recarregar();
const amanha = await medir();
conferir(amanha.botao,
  "e o botão ainda lá está depois de fechar e reabrir — a volta atrás sobrevive à lista branca");

conferir(erros.length === 0, erros.length ? "erro de JavaScript: " + erros[0] : "sem erros de JavaScript");

await browser.close();
s.close();
console.log(falhas ? `\n${falhas} a corrigir.` : "\nA projeção fica guardada, e o ecrã curvo tem volta.");
process.exit(falhas ? 1 : 0);
