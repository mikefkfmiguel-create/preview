/**
 * MEXER EM VÁRIAS PEÇAS AO MESMO TEMPO.
 *
 * Pedido: *"será que posso agrupar objetos ou selecionar vários no 3D para
 * posicionar e rodar"*. Não dava — o clique escolhia UMA peça, e o painel
 * flutuante era dessa peça só.
 *
 * Duas escolhas dele, e é o que este teste guarda:
 *
 *   1. a selecção é PASSAGEIRA — Shift+clique junta e tira, clicar no vazio
 *      larga tudo. Não há grupos com nome guardados no projeto;
 *   2. rodar roda o CONJUNTO COMO UM CORPO: as peças mudam de sítio E de
 *      ângulo, como se estivessem soldadas a uma estrutura. É a parte que
 *      custa, e é a que é medida aqui contra a geometria a sério.
 *
 * O que mais se mede:
 *
 *   3. mover soma o MESMO desvio a todas — as distâncias entre elas não
 *      mudam. Um conjunto que se deforma ao ser arrastado não é um conjunto;
 *   4. rodar 360° em passos devolve as peças ao sítio de onde saíram. É a
 *      prova de que a rotação não vai acumulando erro a cada passo;
 *   5. e uma peça sozinha continua a mexer-se como sempre se mexeu.
 *
 *   node scripts/verificar-grupo-no-3d.mjs
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

// Três ecrãs em linha, afastados de propósito: com eles encostados, um erro de
// meio metro na rotação não se distinguia de arredondamento.
const PROJETO = {
  nome: "Três em linha",
  sala: { largura: 24, profundidade: 16, altura: 8 },
  zonas: [
    { nome: "Esquerda", x: -4, y: 1.5, w: 2, h: 1, tiles: { x: 4, y: 2 }, res: { x: 512, y: 256 }, peso: 24, amp: 2.2, tipo: "led" },
    { nome: "Centro",   x:  0, y: 1.5, w: 2, h: 1, tiles: { x: 4, y: 2 }, res: { x: 512, y: 256 }, peso: 24, amp: 2.2, tipo: "led" },
    { nome: "Direita",  x:  4, y: 1.5, w: 2, h: 1, tiles: { x: 4, y: 2 }, res: { x: 512, y: 256 }, peso: 24, amp: 2.2, tipo: "led" }
  ]
};

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
await pagina.waitForTimeout(1200);

await pagina.evaluate(async (p) => {
  const caixa = document.getElementById("colagem");
  caixa.value = JSON.stringify(p);
  caixa.dispatchEvent(new Event("input", { bubbles: true }));
  document.getElementById("btCarregar").click();
  await new Promise((r) => setTimeout(r, 2200));
}, PROJETO);

// ONDE AS PEÇAS ESTÃO MESMO na sala: o centro da caixa que envolve o objeto
// desenhado. Não é o `dx` do ajuste — esse é um desvio, e um desvio não diz
// onde a peça está. É a mesma fonte que a rotação do grupo usa, de propósito:
// se eu medisse por outra via, estaria a testar a minha conta e não a dela.
const onde = () => pagina.evaluate(() => {
  const r = {};
  window.preview.objetosArrastaveis().forEach((a) => {
    if (!a.obj || a.obj.name.indexOf("zona ") !== 0) return;
    const c = new window.preview.THREE.Box3().setFromObject(a.obj)
      .getCenter(new window.preview.THREE.Vector3());
    r[a.rotulo] = { x: +c.x.toFixed(3), z: +c.z.toFixed(3),
                    rot: Number((a.ajuste && a.ajuste.rot) || 0) };
  });
  return r;
});

const marcar = (nomes) => pagina.evaluate(async (ns) => {
  window.preview.limparSelecao();
  ns.forEach((n) => window.preview.selecaoDeGrupo.add("zona " + n));
  window.preview.marcarSelecao();
  window.preview.abrirPainelDeGrupo();
  await new Promise((r) => setTimeout(r, 300));
  return window.preview.alvosSelecionados().length;
}, nomes);

const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

const inicio = await onde();
console.log("\n== as três, como chegaram ==");
Object.entries(inicio).forEach(([n, p]) => console.log(`   ${n.padEnd(9)} x=${p.x}  z=${p.z}  rot=${p.rot}°`));
conferir(Object.keys(inicio).length === 3, "as três zonas estão na sala");

// ---- 1. MARCAR VÁRIAS ------------------------------------------------
console.log("\n== marcar duas ==");
conferir(await marcar(["Esquerda", "Direita"]) === 2, "duas peças marcadas");
const marcas = await pagina.evaluate(() =>
  window.preview.cena.children.filter((o) => o.name === "marca-de-selecao").length);
conferir(marcas === 2, "e cada uma ganhou a sua caixa de arame na cena (" + marcas + ")");
const painel = await pagina.evaluate(() => {
  const c = document.getElementById("painelAjuste");
  return { visivel: !c.hidden, titulo: (c.querySelector("b") || {}).textContent || "",
           campos: c.querySelectorAll(".ajuste-campo").length };
});
console.log("   painel: «" + painel.titulo + "», " + painel.campos + " campos");
conferir(painel.visivel && /2 peças/.test(painel.titulo), "o painel diz quantas peças leva");
conferir(painel.campos === 4, "com ↔, fundo, altura e rodar");

// ---- 2. MOVER: o mesmo desvio a todas --------------------------------
console.log("\n== mover as três, 2 m para o lado e 1 m para o fundo ==");
await marcar(["Esquerda", "Centro", "Direita"]);
await pagina.evaluate(async () => {
  window.preview.moverGrupo(2, 0, 1);
  await new Promise((r) => setTimeout(r, 900));
});
const movido = await onde();
Object.entries(movido).forEach(([n, p]) => console.log(`   ${n.padEnd(9)} x=${p.x}  z=${p.z}`));
const desvios = Object.keys(inicio).map((n) => ({
  n, dx: +(movido[n].x - inicio[n].x).toFixed(2), dz: +(movido[n].z - inicio[n].z).toFixed(2)
}));
conferir(desvios.every((d) => Math.abs(d.dx - 2) < 0.02 && Math.abs(d.dz - 1) < 0.02),
  "as três andaram os mesmos 2,00 m e 1,00 m: " + desvios.map((d) => `${d.n} ${d.dx}/${d.dz}`).join(", "));
conferir(Math.abs(dist(movido.Esquerda, movido.Direita) - dist(inicio.Esquerda, inicio.Direita)) < 0.02,
  "e a distância entre elas não mudou — o conjunto não se deformou");

// ---- 3. RODAR COMO UM CORPO ------------------------------------------
//
// É a parte que ele escolheu e a que custa. Roda-se 90°: uma fila ao longo do
// X tem de ficar uma fila ao longo do Z, à volta do mesmo centro.
console.log("\n== rodar as três 90° ==");
const antesDeRodar = await onde();
const centroAntes = await pagina.evaluate(() => {
  const c = window.preview.centroDoGrupo(window.preview.alvosSelecionados());
  return { x: +c.x.toFixed(3), z: +c.z.toFixed(3) };
});
console.log("   centro do conjunto: x=" + centroAntes.x + " z=" + centroAntes.z);
await pagina.evaluate(async () => {
  window.preview.rodarGrupo(90);
  await new Promise((r) => setTimeout(r, 900));
});
const rodado = await onde();
Object.entries(rodado).forEach(([n, p]) => console.log(`   ${n.padEnd(9)} x=${p.x}  z=${p.z}  rot=${p.rot}°`));

conferir(Object.keys(rodado).every((n) => Math.abs(rodado[n].rot - (antesDeRodar[n].rot + 90)) < 0.5),
  "cada peça levou os mesmos 90° na sua rotação");
// A fila estava ao longo do X; a 90° tem de estar ao longo do Z.
const espalhaX = Math.abs(rodado.Esquerda.x - rodado.Direita.x);
const espalhaZ = Math.abs(rodado.Esquerda.z - rodado.Direita.z);
console.log(`   espalhamento: em X ${espalhaX.toFixed(2)} m · em Z ${espalhaZ.toFixed(2)} m`);
conferir(espalhaZ > 7 && espalhaX < 0.5,
  "a fila deixou de estar ao longo do X e passou a estar ao longo do Z — rodou como um corpo");
conferir(Math.abs(dist(rodado.Esquerda, rodado.Direita) - dist(antesDeRodar.Esquerda, antesDeRodar.Direita)) < 0.05,
  "e as distâncias entre as peças não mudaram: um corpo rígido");
const centroDepois = await pagina.evaluate(() => {
  const c = window.preview.centroDoGrupo(window.preview.alvosSelecionados());
  return { x: +c.x.toFixed(3), z: +c.z.toFixed(3) };
});
conferir(Math.abs(centroDepois.x - centroAntes.x) < 0.06 && Math.abs(centroDepois.z - centroAntes.z) < 0.06,
  "o centro do conjunto ficou onde estava (" + centroDepois.x + ", " + centroDepois.z + ")");

// ---- 4. A VOLTA INTEIRA devolve tudo ao sítio ------------------------
//
// Quatro passos de 90° são 360°. Se a conta fosse feita sobre a cena já
// mexida, ou se o ângulo escorregasse, isto acumulava e via-se aqui.
console.log("\n== mais três quartos de volta: 360° ao todo ==");
for (let i = 0; i < 3; i++) {
  await pagina.evaluate(async () => {
    window.preview.rodarGrupo(90);
    await new Promise((r) => setTimeout(r, 700));
  });
}
const volta = await onde();
Object.entries(volta).forEach(([n, p]) => console.log(`   ${n.padEnd(9)} x=${p.x}  z=${p.z}  rot=${p.rot}°`));
conferir(Object.keys(antesDeRodar).every((n) =>
    Math.abs(volta[n].x - antesDeRodar[n].x) < 0.06 && Math.abs(volta[n].z - antesDeRodar[n].z) < 0.06),
  "a volta inteira devolveu as três ao sítio de onde saíram");

// ---- 5. LARGAR, e uma peça sozinha continua a mexer-se ---------------
console.log("\n== largar a selecção ==");
await pagina.evaluate(() => window.preview.limparSelecao());
const depoisDeLargar = await pagina.evaluate(() => ({
  marcados: window.preview.selecaoDeGrupo.size,
  marcas: window.preview.cena.children.filter((o) => o.name === "marca-de-selecao").length,
  painel: document.getElementById("painelAjuste").hidden
}));
conferir(depoisDeLargar.marcados === 0 && depoisDeLargar.marcas === 0,
  "a selecção e as caixas desapareceram");
conferir(depoisDeLargar.painel, "e o painel do grupo fechou-se");

const antesDeUma = await onde();
await pagina.evaluate(async () => {
  const a = window.preview.objetosArrastaveis().find((x) => x.rotulo === "Centro");
  const p = a.getXZ();
  a.setXZ(p.x + 1.5, p.z);
  window.preview.montar(false);
  await new Promise((r) => setTimeout(r, 900));
});
const umaSo = await onde();
conferir(Math.abs((umaSo.Centro.x - antesDeUma.Centro.x) - 1.5) < 0.05,
  "uma peça sozinha andou o 1,50 m que se lhe pediu");
conferir(Math.abs(umaSo.Esquerda.x - antesDeUma.Esquerda.x) < 0.02,
  "e as outras não se mexeram — mexer numa não é mexer no grupo");

// ---- 6. O GESTO A SÉRIO: Shift+clique na tela -------------------------
//
// Tudo acima passou pelas funções. Isto passa pelo RATO, que é o que ele usa:
// onde é que cada peça cai no ecrã, e o que é que um clique com Shift lá faz.
// Sem isto, a lógica podia estar certa e o gesto não chegar lá.
console.log("\n== Shift+clique, com o rato ==");
await pagina.evaluate(() => window.preview.limparSelecao());
// A edição livre é o cadeado: fechada, o clique só roda a câmara. Abre-se
// como quem carrega no botão.
// "/livre ligada/" e não "/ligada/": "desligada" também contém "ligada", e a
// primeira versão disto deixava o cadeado fechado a achar que o tinha aberto —
// três cruzes num gesto que estava bom.
const abrirCadeado = () => pagina.evaluate(() => {
  const b = document.getElementById("btEdicaoLivre");
  if (!/livre ligada/i.test(b.title)) b.click();
  return b.title;
});
console.log("   " + (await abrirCadeado()).split("—")[0].trim());
await pagina.waitForTimeout(400);

const noEcra = (rotulo) => pagina.evaluate((r) => {
  const a = window.preview.objetosArrastaveis().find((x) => x.rotulo === r);
  const T = window.preview.THREE;
  const c = new T.Box3().setFromObject(a.obj).getCenter(new T.Vector3());
  c.project(window.preview.camara);
  const tela = document.querySelector("canvas").getBoundingClientRect();
  return { x: tela.left + ((c.x + 1) / 2) * tela.width,
           y: tela.top + ((-c.y + 1) / 2) * tela.height };
}, rotulo);

const pEsq = await noEcra("Esquerda");
const pDir = await noEcra("Direita");
console.log(`   Esquerda no ecrã: ${Math.round(pEsq.x)},${Math.round(pEsq.y)} · Direita: ${Math.round(pDir.x)},${Math.round(pDir.y)}`);

await pagina.mouse.click(pEsq.x, pEsq.y);
await pagina.waitForTimeout(400);
await pagina.keyboard.down("Shift");
await pagina.mouse.click(pDir.x, pDir.y);
await pagina.keyboard.up("Shift");
await pagina.waitForTimeout(500);

const porClique = await pagina.evaluate(() => ({
  marcados: [...window.preview.selecaoDeGrupo],
  titulo: (document.querySelector("#painelAjuste b") || {}).textContent || ""
}));
console.log("   marcados: " + porClique.marcados.join(", ") + " · painel: «" + porClique.titulo + "»");
conferir(porClique.marcados.length === 2, "clique + Shift+clique marcaram duas peças");
conferir(/2 peças/.test(porClique.titulo), "e o painel do grupo abriu-se sozinho");

// Shift outra vez na mesma peça TIRA-A. É o mesmo gesto a desfazer-se, que é
// o que se espera dele em qualquer programa.
await pagina.keyboard.down("Shift");
await pagina.mouse.click(pDir.x, pDir.y);
await pagina.keyboard.up("Shift");
await pagina.waitForTimeout(400);
conferir(await pagina.evaluate(() => window.preview.selecaoDeGrupo.size) === 1,
  "Shift no que já estava marcado tira-o da selecção");

// E um clique no VAZIO larga tudo. O ponto tem de cair DENTRO da tela: a
// primeira versão clicava em (60,700), que é o painel lateral — o clique nunca
// chegava ao 3D, e a verificação passava por não haver nada para largar.
// Escolhe-se o céu, no alto da tela, longe do painel.
const vazio = await pagina.evaluate(() => {
  const r = document.querySelector("canvas").getBoundingClientRect();
  return { x: r.left + r.width * 0.85, y: r.top + r.height * 0.08 };
});
console.log(`   clique no vazio: ${Math.round(vazio.x)},${Math.round(vazio.y)}`);
await pagina.mouse.click(vazio.x, vazio.y);
await pagina.waitForTimeout(400);
conferir(await pagina.evaluate(() => window.preview.selecaoDeGrupo.size) === 0,
  "e clicar no vazio larga a selecção");

// ---- 7. O EIXO NÃO PODE FUGIR, com peças de tamanhos diferentes -------
//
// Reportado assim: *"quando roda não está ancorado no eixo"*. As três peças de
// cima são todas iguais e simétricas — e com peças iguais o defeito não
// aparecia. Aparece com LARGURAS DIFERENTES, que é o caso dele (ecrãs de 1,5 m
// ao lado de tiras de 1,0 m).
//
// A causa era o eixo sair da CAIXA que envolve o conjunto. A caixa de uma peça
// rodada é maior do que a peça e está alinhada com a sala, não com ela; com
// peças de larguras diferentes o meio dessa caixa não é o meio das peças, e
// mexe-se à medida que rodam. Medido antes da cura: 1,24 m de deriva em 90°.
console.log("\n== o eixo com peças de larguras diferentes ==");
await pagina.evaluate(async (p) => {
  const caixa = document.getElementById("colagem");
  caixa.value = JSON.stringify(p);
  caixa.dispatchEvent(new Event("input", { bubbles: true }));
  document.getElementById("btCarregar").click();
  await new Promise((r) => setTimeout(r, 2300));
}, {
  nome: "larguras diferentes", sala: { largura: 24, profundidade: 16, altura: 8 },
  zonas: [
    { nome: "Larga", x: -5, y: 1.5, w: 4.0, h: 2, tiles: { x: 8, y: 4 }, res: { x: 1024, y: 512 }, peso: 40, amp: 4, tipo: "led" },
    { nome: "Estreita", x: 4, y: 1.5, w: 0.5, h: 2, tiles: { x: 1, y: 4 }, res: { x: 128, y: 512 }, peso: 8, amp: 1, tipo: "led" }
  ]
});
await pagina.evaluate(async () => {
  window.preview.limparSelecao();
  ["Larga", "Estreita"].forEach((n) => window.preview.selecaoDeGrupo.add("zona " + n));
  window.preview.marcarSelecao();
  await new Promise((r) => setTimeout(r, 400));
});

// O centro pelos PONTOS de rotação das peças: é o que tem de ficar quieto.
const centroReal = () => pagina.evaluate(() => {
  const T = window.preview.THREE;
  const alvos = window.preview.alvosSelecionados();
  const soma = new T.Vector3();
  alvos.forEach((a) => soma.add(a.obj.getWorldPosition(new T.Vector3())));
  soma.divideScalar(alvos.length);
  return { x: +soma.x.toFixed(3), z: +soma.z.toFixed(3) };
});

const eixo0 = await centroReal();
console.log("   eixo no princípio: (" + eixo0.x + ", " + eixo0.z + ")");
for (let i = 0; i < 6; i++) {
  await pagina.evaluate(async () => {
    window.preview.rodarGrupo(-15);
    await new Promise((r) => setTimeout(r, 800));
  });
}
const eixo1 = await centroReal();
const fugiu = Math.hypot(eixo1.x - eixo0.x, eixo1.z - eixo0.z);
console.log("   eixo ao fim de -90°: (" + eixo1.x + ", " + eixo1.z + ") — fugiu " + fugiu.toFixed(3) + " m");
conferir(fugiu < 0.02,
  "o eixo ficou onde estava (" + fugiu.toFixed(3) + " m) — antes fugia 1,24 m em 90°");


conferir(erros.length === 0, erros.length ? "erro de JavaScript: " + erros[0] : "sem erros de JavaScript");

await browser.close();
s.close();
console.log("\n" + (falhas ? falhas + " FALHA(S)"
  : "Várias peças mexem-se juntas, e o conjunto roda como um corpo."));
process.exit(falhas ? 1 : 0);
