/**
 * A PROJEÇÃO QUE ESTAVA MONTADA NÃO SE PERDE, E A NOVA NÃO NASCE NO CHÃO.
 *
 * Reparo dele: *"desfaz o blend que estava e coloca o novo fora de sítio"*.
 *
 * Eram duas avarias na mesma fotografia.
 *
 * A PRIMEIRA: a carga seguinte escrevia por cima da projeção viva e a
 * anterior desaparecia. Medido: um blend de 3 máquinas num pano de 30 m,
 * chega o segundo, e ficam 2 máquinas num pano de 12 m — o primeiro em lado
 * nenhum, sem aviso. O botão "guardar esta projeção e começar outra" existia,
 * mas quem manda a segunda tela dos Calculadores nunca passa por ele.
 *
 * A SEGUNDA: um ecrã guardado chegava com `altura: 0` — os Calculadores não
 * sabem onde o pano está pendurado, e mandavam um zero para dizer "não sei".
 * O 3D lia o zero como uma medida e desenhava a tela e a máquina no chão:
 * pano vivo a 4,13 m, pano guardado a 0,00 m.
 *
 *   node scripts/verificar-projecao-substituida.mjs
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

const PROJETO = JSON.stringify({
  nome: "Sala", origem: "calculadores", alturaDoChao: 1,
  sala: { largura: 50, profundidade: 50, altura: 14 },
  zonas: [{ nome: "Cenário 1", id: "z1", x: 0, y: 0, w: 8, h: 4.5, cor: "#2e7bff", tipo: "led" }]
});

// Uma fila de máquinas num pano plano, como a que vem do Blending.
const blend = (quantas, largura, distancia) => JSON.stringify({
  v: 2, retro: false, curva: null, alturaLente: 6, shiftV: -50,
  projetores: Array.from({ length: quantas }, (_, i) => ({
    lateral: +(-largura / 2 + largura / quantas / 2 + i * (largura / quantas)).toFixed(2),
    alturaOffset: 0,
    largura: +(largura / quantas).toFixed(2), altura: 2.84,
    racio: +(distancia / (largura / quantas)).toFixed(3), distancia
  })),
  quando: new Date().toISOString()
});

await pagina.goto(`http://127.0.0.1:${porta}/index.html`, { waitUntil: "networkidle" });
await pagina.evaluate((a) => {
  localStorage.clear();
  localStorage.setItem("mikeapps-sincronizacao-v1", JSON.stringify("ligada"));
  localStorage.setItem("mikeapps-projeto-v1", a[0]);
  localStorage.setItem("mikeapps-projetor-v1", a[1]);
}, [PROJETO, blend(3, 30, 17.5)]);
await pagina.reload({ waitUntil: "networkidle" });
await pagina.waitForFunction(() => window.preview && window.preview.montar, null, { timeout: 30000 });
await pagina.waitForTimeout(1600);

const sincronizar = () => pagina.evaluate(async () => {
  document.getElementById("btSincronizar").click();
  await new Promise((r) => setTimeout(r, 2500));
});
const porCarga = (carga) => pagina.evaluate((c) => {
  localStorage.setItem("mikeapps-projetor-v1", c);
}, carga);
const medir = () => pagina.evaluate(() => {
  const w = window.preview;
  const a = w.ajustes || {};
  const antiga = a.projecaoAnterior;
  const botao = document.getElementById("btReporProjecao");
  return {
    maquinasNoCampo: (a.projetoresExtra || []).length + 1,
    guardadas: (a.projecoesExtra || []).length,
    racioVivo: +Number(document.getElementById("projRacio").value).toFixed(2),
    anterior: antiga ? { racio: antiga.racio, maquinas: (antiga.maquinas || []).length + 1 } : null,
    botao: botao ? !botao.hidden : null,
    recado: (document.getElementById("avisoProjecaoPerdida") || {}).textContent || ""
  };
});

console.log("\n== a primeira carga não tem nada para substituir ==");

await sincronizar();
const uma = await medir();
conferir(uma.maquinasNoCampo === 3, "o primeiro blend monta as três máquinas (" + uma.maquinasNoCampo + ")");
conferir(uma.anterior === null && uma.botao === false,
  "e não há nada a dizer que se perdeu — porque não se perdeu nada");

console.log("\n== a segunda carga substitui, mas a primeira fica a um clique ==");

// O que ele fez: calculou outra tela e mandou-a. Até aqui, a primeira
// desaparecia aqui mesmo.
await porCarga(blend(2, 12, 9));
await sincronizar();
const duas = await medir();
conferir(duas.maquinasNoCampo === 2,
  "a tela nova é a que está nos campos, como sempre foi (" + duas.maquinasNoCampo + " máquinas)");
conferir(duas.anterior !== null && duas.anterior.maquinas === 3,
  "A QUE ESTAVA NÃO SE PERDEU: ficou guardada com as três máquinas (" +
  (duas.anterior ? duas.anterior.maquinas : "nada") + ")");
conferir(duas.botao === true, "com um botão à vista para a repor");
conferir(/substituiu/.test(duas.recado) && /não se perdeu/.test(duas.recado),
  "e o recado di-lo por palavras: \"" + duas.recado.slice(0, 60) + "…\"");

console.log("\n== repor traz a antiga PARA O PÉ da nova, não por cima ==");

await pagina.evaluate(async () => {
  document.getElementById("btReporProjecao").click();
  await new Promise((r) => setTimeout(r, 1800));
});
const reposta = await medir();
conferir(reposta.guardadas === 1, "a antiga volta como projeção guardada (" + reposta.guardadas + ")");
conferir(reposta.maquinasNoCampo === 2,
  "e a nova continua nos campos — repor uma não apaga a outra (" + reposta.maquinasNoCampo + " máquinas)");
conferir(reposta.anterior === null && reposta.botao === false,
  "o sítio fica vazio e o botão desaparece: já não há nada por repor");

console.log("\n== uma tela guardada sem altura não nasce no chão ==");

// Os Calculadores não sabem onde o pano está pendurado. Mandavam 0, e um zero
// que quer dizer "não sei" desenhava-se como um zero que quer dizer "no chão".
const alturas = await pagina.evaluate(async () => {
  const w = window.preview;
  document.getElementById("projAltura").value = "4.5";
  document.getElementById("projAltura").dispatchEvent(new Event("input", { bubbles: true }));
  await new Promise((r) => setTimeout(r, 600));
  w.ajustes.projecoesExtra = [{
    ligada: true, racio: 1.79, distancia: 14, altura: null, lateral: 0,
    shiftV: 0, shiftH: 0, formato: 1.777, panoX: 0, panoDz: 0,
    maquinas: [], curva: null, retro: false
  }];
  w.guardarAjustes(w.ajustes);
  w.montar(false);
  await new Promise((r) => setTimeout(r, 1500));
  const y = {};
  w.desenhado.traverse((o) => {
    if (/^p2:projetor-0$/.test(o.name || "")) y.guardada = +o.position.y.toFixed(2);
    if (/^projetor-0$/.test(o.name || "")) y.viva = +o.position.y.toFixed(2);
  });
  return y;
});
conferir(alturas.guardada > 0,
  "a máquina da tela guardada não fica no chão (" + alturas.guardada + " m)");
conferir(alturas.guardada === alturas.viva,
  "nasce à altura da projeção que já está montada, que é o único sítio real que a app conhece (" +
  alturas.guardada + " m = " + alturas.viva + " m)");

console.log("\n== e a altura herda-se COM o shift, que é o par que decide onde a imagem cai ==");

// Reparo dele: *"ao carregar em guardar e adicionar outro fica assim"*.
//
// A v4.08 herdava só a altura da lente, e isso chega enquanto o shift for 0.
// Medido num blend que chega com a lente a 0,00 m e +50 % de shift — a lente
// no chão, a imagem levantada pelo shift: a tela guardada herdava o 0, ficava
// com o shift 0 dela, e desenhava-se no chão. Um pano de 36 x 8 m deitado no
// soalho.
//
// E o shift vive em FRAÇÃO nesta forma e em PERCENTAGEM no campo: a primeira
// tentativa leu o campo em cru e pôs o mesmo pano a 399,97 m de altura, cem
// vezes acima do tecto. Lê-se pela lerProjecao(), que é onde essa conta mora.
const comShift = await pagina.evaluate(async () => {
  const w = window.preview;
  const põe = (id, v) => { const e = document.getElementById(id); e.value = String(v);
    e.dispatchEvent(new Event("input", { bubbles: true })); };
  põe("projAltura", 0);
  põe("projShiftV", 50);
  await new Promise((r) => setTimeout(r, 700));
  w.ajustes.projecoesExtra = [{
    ligada: true, racio: 4.5, distancia: 68, altura: null, lateral: 0,
    shiftV: 0, shiftH: 0, formato: 1.777, panoX: 0, panoDz: 0,
    maquinas: [], curva: null, retro: false
  }];
  w.guardarAjustes(w.ajustes);
  w.montar(false);
  await new Promise((r) => setTimeout(r, 1600));
  const THREE = w.THREE; let y = null, alt = null;
  w.desenhado.traverse((o) => {
    if (/^p2:ecra-plano$/.test(o.name || "")) {
      const b = new THREE.Box3().setFromObject(o);
      if (!b.isEmpty()) { y = +((b.min.y + b.max.y) / 2).toFixed(2); alt = +(b.max.y - b.min.y).toFixed(2); }
    }
  });
  return { y, alt, base: y !== null ? +(y - alt / 2).toFixed(2) : null };
});
conferir(comShift.y !== null && comShift.y > 0.5,
  "com a lente a 0 m e +50 % de shift, a tela guardada NÃO fica deitada no chão (centro a " +
  comShift.y + " m)");
conferir(comShift.y < 20,
  "nem cem vezes acima do tecto: o shift é fração, não percentagem (" + comShift.y + " m)");
conferir(Math.abs(comShift.base) < 0.6,
  "assenta onde a projeção viva a põe — base a " + comShift.base + " m");

conferir(erros.length === 0, erros.length ? "erro de JavaScript: " + erros[0] : "sem erros de JavaScript");

await browser.close();
s.close();
console.log(falhas ? `\n${falhas} a corrigir.` : "\nA projeção substituída fica a um clique, e a nova nasce no sítio.");
process.exit(falhas ? 1 : 0);
