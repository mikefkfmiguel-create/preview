/**
 * GRUPOS GUARDADOS: UM CENÁRIO É UM OBJETO, NÃO SETE PEÇAS SOLTAS.
 *
 * Pedido, com o caso a sério: *"quando quiser uma cor única nos objetos de
 * palco, ou unificar como um único objeto, posso travar e criar grupo? por
 * exemplo, vou montar um cenário com vários palcos a alturas diferentes para
 * fazer escadas, e forrar com ecrãs de LED"*.
 *
 * O laço e o Shift+clique fazem uma selecção PASSAGEIRA: mexe-se uma vez e
 * acabou. Uma escadaria de palcos deixava de ser uma escadaria no clique
 * seguinte. Um grupo guardado marca-se uma vez e fica.
 *
 * As duas escolhas dele, e é o que este teste guarda:
 *
 *   1. a COR DO GRUPO fica POR CIMA, não por dentro. A peça guarda a cor que
 *      tinha; desfazer o grupo devolve cada uma à sua, sem ter sido preciso
 *      guardar cópias de nada;
 *   2. o DUPLO CLIQUE ENTRA: o clique normal agarra o cenário todo, o duplo
 *      agarra só um degrau — que é como se afina a altura de um sem desfazer
 *      a escada.
 *
 * E o que não podia faltar:
 *
 *   3. o grupo VAI NO FICHEIRO. Um cenário que se desfaz ao reabrir o projeto
 *      não é um cenário;
 *   4. mexer no grupo mexe nas peças todas, e a escadaria não se deforma;
 *   5. uma peça só pode estar num grupo, e um grupo que fique com menos de
 *      duas peças desaparece — um "grupo" de uma peça é uma peça.
 *
 *   node scripts/verificar-grupos-guardados.mjs
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
await pagina.waitForTimeout(1200);

// Um ecrã, para o cenário levar LED como no caso dele.
await pagina.evaluate(async (p) => {
  const caixa = document.getElementById("colagem");
  caixa.value = JSON.stringify(p);
  caixa.dispatchEvent(new Event("input", { bubbles: true }));
  document.getElementById("btCarregar").click();
  await new Promise((r) => setTimeout(r, 2200));
}, {
  nome: "Escadaria", sala: { largura: 24, profundidade: 16, altura: 8 },
  zonas: [{ nome: "Forro LED", id: "zf", x: 0, y: 0.5, w: 3, h: 1.2,
            tiles: { x: 6, y: 2 }, res: { x: 768, y: 256 }, peso: 48, amp: 4.4,
            tipo: "led", cor: "#2E7BFF" }]
});

// TRÊS DEGRAUS: palcos a alturas diferentes, que é o cenário dele.
console.log("\n== três palcos a alturas diferentes, como degraus ==");
const degraus = await pagina.evaluate(async () => {
  // Os palcos extra só se desenham com o palco LIGADO (vivem dentro do mesmo
  // bloco de desenho). Sem isto não havia nada na cena para agrupar, e o teste
  // rebentava a perguntar a cor de uma peça que não existia.
  const ver = document.getElementById("verPalco");
  if (ver && !ver.checked) { ver.checked = true; ver.dispatchEvent(new Event("change", { bubbles: true })); }
  await new Promise((r) => setTimeout(r, 1200));
  for (let i = 0; i < 3; i++) {
    document.getElementById("btAddPalco").click();
    await new Promise((r) => setTimeout(r, 800));
  }
  // Alturas diferentes, à mão, como quem desenha uma escada.
  window.preview.ajustes.palcosExtra.forEach((p, i) => { p.altura = 0.4 * (i + 1); });
  window.preview.guardarAjustes(window.preview.ajustes);
  window.preview.montar(false);
  await new Promise((r) => setTimeout(r, 1000));
  return window.preview.ajustes.palcosExtra.map((p) => p.altura);
});
console.log("   alturas: " + degraus.join(" · ") + " m");
conferir(degraus.length === 3, "há três degraus");

const estado = () => pagina.evaluate(() => {
  const T = window.preview.THREE, r = { pecas: {}, grupos: [] };
  window.preview.objetosArrastaveis().forEach((a) => {
    if (!a.obj) return;
    const v = a.obj.getWorldPosition(new T.Vector3());
    // AS CORES DESENHADAS, lidas dos materiais — não as que estão guardadas.
    // São a única prova de que a cor do grupo chegou mesmo ao ecrã.
    //
    // TODAS e não a primeira: um ecrã é feito de várias malhas (o painel, a
    // moldura), e ficar-se pela primeira dava a cor da moldura num sítio e a
    // do painel noutro — a primeira versão deste teste lia `null` num ecrã que
    // estava desenhado à frente dela.
    const cores = [];
    a.obj.traverse((o) => {
      if (!o.isMesh || !o.material) return;
      // MATERIAIS EM ARRAY. Um painel LED tem vários (a face, o lado, o
      // verso), e ler `o.material.color` num array dá `undefined` — foi assim
      // que este teste leu "sem cor nenhuma" num ecrã que estava desenhado à
      // frente dele, com a malha e tudo.
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      mats.forEach((m) => { if (m && m.color) cores.push("#" + m.color.getHexString()); });
    });
    r.pecas[a.obj.name] = { x: +v.x.toFixed(2), z: +v.z.toFixed(2), cores,
                            cor: cores[0] || null };
  });
  (window.preview.ajustes.grupos || []).forEach((g) =>
    r.grupos.push({ id: g.id, nome: g.nome, cor: g.cor, chaves: [...g.chaves] }));
  return r;
});

const antes = await estado();
const corGuardadaDoPalco = await pagina.evaluate(() => window.preview.ajustes.palcosExtra.map((p) => p.cor || null));
console.log("   cor desenhada dos degraus: " +
  ["palco-1", "palco-2", "palco-3"].map((n) => antes.pecas[n].cor).join(" · "));

// ---- 1. TRAVAR NUM GRUPO ----------------------------------------------
console.log("\n== travar os três degraus e o ecrã num cenário ==");
const criado = await pagina.evaluate(async () => {
  window.preview.limparSelecao();
  ["palco-1", "palco-2", "palco-3", "zona Forro LED"].forEach((n) => window.preview.selecaoDeGrupo.add(n));
  window.preview.marcarSelecao();
  await new Promise((r) => setTimeout(r, 300));
  const g = window.preview.criarGrupo();
  await new Promise((r) => setTimeout(r, 1200));
  return g ? { nome: g.nome, cor: g.cor, quantas: g.chaves.length } : null;
});
console.log("   criado: «" + (criado && criado.nome) + "» com " + (criado && criado.quantas) + " peças, cor " + (criado && criado.cor));
conferir(!!criado && criado.quantas === 4, "o grupo leva as quatro peças");

const comGrupo = await estado();
// A cor do cenário tem de APARECER em cada peça — não ser a única cor dela.
// Um ecrã leva sempre a moldura escura (#11181e), que é estrutura e não
// identidade: pintá-la também era apagar o desenho do painel. A primeira
// versão desta verificação comparava só a PRIMEIRA malha de cada peça, e
// falhava no ecrã por causa da moldura, com a cor do cenário lá dentro.
const doCenario = String(criado.cor).toLowerCase();
const quatro = ["palco-1", "palco-2", "palco-3", "zona Forro LED"];
quatro.forEach((n) => console.log(`   ${n.padEnd(16)} ${comGrupo.pecas[n].cores.map((c) => c.toLowerCase()).join(" ")}`));
conferir(quatro.every((n) => comGrupo.pecas[n].cores.some((c) => c.toLowerCase() === doCenario)),
  "as quatro passaram a mostrar a cor do cenário (" + criado.cor + ") — é o que faz aquilo parecer um objeto só");
conferir(["palco-1", "palco-2", "palco-3"].every((n) =>
    comGrupo.pecas[n].cores.every((c) => c.toLowerCase() === doCenario)),
  "e nos palcos é a cor toda, não só uma parte");

// ---- 2. A COR DA PEÇA NÃO FOI TOCADA ----------------------------------
//
// Escolha dele: a cor do grupo fica POR CIMA. É isto que a torna reversível.
console.log("\n== mas a cor de cada peça ficou intacta ==");
const guardadas = await pagina.evaluate(() => ({
  palcos: window.preview.ajustes.palcosExtra.map((p) => p.cor || null),
  zona: (window.preview.projeto.zonas.find((z) => z.nome === "Forro LED") || {}).cor
}));
console.log("   guardado nos palcos: " + JSON.stringify(guardadas.palcos) + " · na zona: " + guardadas.zona);
conferir(JSON.stringify(guardadas.palcos) === JSON.stringify(corGuardadaDoPalco),
  "a cor guardada dos palcos é a mesma de antes de agrupar");
conferir(guardadas.zona === "#2E7BFF", "e a do ecrã continua a dele (" + guardadas.zona + ")");

// ---- 3. MEXER NO GRUPO MEXE EM TODAS ----------------------------------
console.log("\n== mexer no cenário mexe nas quatro ==");
await pagina.evaluate(async () => {
  window.preview.moverGrupo(2, 0, 0);
  await new Promise((r) => setTimeout(r, 900));
});
const movido = await estado();
const andaram = ["palco-1", "palco-2", "palco-3", "zona Forro LED"]
  .map((n) => +(movido.pecas[n].x - comGrupo.pecas[n].x).toFixed(2));
console.log("   andaram: " + andaram.join(" · ") + " m");
conferir(andaram.every((d) => Math.abs(d - 2) < 0.02), "as quatro andaram os mesmos 2,00 m");

// ---- 4. O DUPLO CLIQUE ENTRA ------------------------------------------
//
// Com o rato, que é o gesto dele. Sem isto não se afina a altura de um degrau
// sem desfazer a escada toda.
console.log("\n== duplo clique entra no cenário ==");
await pagina.evaluate(async () => {
  const b = document.getElementById("btEdicaoLivre");
  if (!/livre ligada/i.test(b.title)) b.click();
  // ENQUADRAR PRIMEIRO. Sem isto a câmara pode ter os degraus fora da tela, o
  // clique cai no vazio (ou fora da janela) e não chega evento nenhum à app —
  // foi o que aconteceu à primeira versão deste teste, e o pior é que ela
  // PASSAVA: a selecção lida a seguir era a que já lá estava de antes.
  window.preview.trazerTudoAVista();
  await new Promise((r) => setTimeout(r, 1200));
});
await pagina.waitForTimeout(400);

const ondeEsta = (nome) => pagina.evaluate((n) => {
  const T = window.preview.THREE;
  const a = window.preview.objetosArrastaveis().find((x) => x.obj && x.obj.name === n);
  const c = new T.Box3().setFromObject(a.obj).getCenter(new T.Vector3());
  c.project(window.preview.camara);
  const r = document.querySelector("canvas").getBoundingClientRect();
  return { x: r.left + ((c.x + 1) / 2) * r.width, y: r.top + ((-c.y + 1) / 2) * r.height };
}, nome);

const p2 = await ondeEsta("palco-2");
const dentroDaTela = await pagina.evaluate(({ x, y }) => {
  const r = document.querySelector("canvas").getBoundingClientRect();
  return x > r.left + 4 && x < r.right - 4 && y > r.top + 4 && y < r.bottom - 4;
}, p2);
console.log("   palco-2 no ecrã: " + Math.round(p2.x) + "," + Math.round(p2.y) +
            (dentroDaTela ? " (dentro da tela)" : " (FORA DA TELA)"));
// Clicar fora da tela não é um clique falhado: é um teste que não mediu nada.
conferir(dentroDaTela, "o degrau está à vista, para se lhe poder clicar a sério");

// A selecção é largada ANTES, senão "4 marcadas" a seguir ao clique tanto
// pode ser o clique a funcionar como as 4 que já lá estavam.
await pagina.evaluate(() => window.preview.limparSelecao());
await pagina.waitForTimeout(300);
await pagina.mouse.click(p2.x, p2.y);
await pagina.waitForTimeout(500);
const cliqueSimples = await pagina.evaluate(() => ({
  marcados: window.preview.selecaoDeGrupo.size,
  titulo: (document.querySelector("#painelAjuste b") || {}).textContent || ""
}));
console.log("   clique simples → " + cliqueSimples.marcados + " marcadas · «" + cliqueSimples.titulo + "»");
conferir(cliqueSimples.marcados === 4, "um clique num degrau agarra o cenário todo");
conferir(cliqueSimples.titulo === criado.nome, "e o painel diz o nome dele, não «4 peças»");

await pagina.mouse.dblclick(p2.x, p2.y);
await pagina.waitForTimeout(600);
const duplo = await pagina.evaluate(() => ({
  marcados: [...window.preview.selecaoDeGrupo],
  titulo: (document.querySelector("#painelAjuste b") || {}).textContent || ""
}));
console.log("   duplo clique → " + duplo.marcados.join(", ") + " · «" + duplo.titulo + "»");
conferir(duplo.marcados.length === 1 && duplo.marcados[0] === "palco-2",
  "o duplo clique agarra só aquele degrau");

// ---- 6. DESFAZER DEVOLVE AS CORES -------------------------------------
console.log("\n== desfazer o grupo ==");
const antesDeDesfazer = await estado();
const desfez = await pagina.evaluate(async () => {
  const g = window.preview.ajustes.grupos[0];
  window.preview.desfazerGrupo(g.id);
  await new Promise((r) => setTimeout(r, 1200));
  return window.preview.ajustes.grupos.length;
});
const depois = await estado();
console.log("   peças na cena: " + Object.keys(depois.pecas).join(", "));
const coresDepois = ["palco-1", "palco-2", "palco-3", "zona Forro LED"].map((n) => depois.pecas[n] && depois.pecas[n].cor);
console.log("   cor desenhada depois: " + coresDepois.join(" · "));
conferir(desfez === 0, "o grupo desapareceu da lista");
const coresDoEcra = depois.pecas["zona Forro LED"].cores.map((c) => c.toLowerCase());
conferir(coresDoEcra.includes("#2e7bff"),
  "o ecrã voltou a ter a cor dele entre as suas malhas: " + coresDoEcra.join(", "));
conferir(String(coresDepois[0]).toLowerCase() !== String(antesDeDesfazer.pecas["palco-1"].cor).toLowerCase(),
  "e os palcos deixaram de estar pintados de cenário");
const ondeFicaram = ["palco-1", "palco-2", "palco-3"]
  .every((n) => Math.abs(depois.pecas[n].x - antesDeDesfazer.pecas[n].x) < 0.02);
conferir(ondeFicaram, "as peças ficaram exactamente onde estavam — desfazer não é desmontar");

// ---- 7. UMA PEÇA SÓ ESTÁ NUM GRUPO ------------------------------------
console.log("\n== uma peça só pode estar num grupo ==");
const dois = await pagina.evaluate(async () => {
  window.preview.limparSelecao();
  ["palco-1", "palco-2"].forEach((n) => window.preview.selecaoDeGrupo.add(n));
  window.preview.criarGrupo();
  await new Promise((r) => setTimeout(r, 900));
  window.preview.limparSelecao();
  // O palco-2 entra noutro grupo: tem de sair do primeiro, e o primeiro fica
  // com uma peça só — logo, deixa de existir.
  ["palco-2", "palco-3"].forEach((n) => window.preview.selecaoDeGrupo.add(n));
  window.preview.criarGrupo();
  await new Promise((r) => setTimeout(r, 900));
  return (window.preview.ajustes.grupos || []).map((g) => ({ nome: g.nome, chaves: [...g.chaves] }));
});
console.log("   " + JSON.stringify(dois));
conferir(dois.length === 1 && dois[0].chaves.length === 2 && dois[0].chaves.includes("palco-2"),
  "ficou um grupo só: o antigo perdeu o palco-2, sobrou com uma peça e desapareceu");

// ---- 8. O GRUPO VAI NO FICHEIRO (POR ÚLTIMO) -------------------------
//
// Esta é a última de propósito: recarregar a app abre-a LIMPA (v3.82), e a
// partir daí não há peças na cena para as outras verificações medirem. A
// primeira versão deste teste tinha-a a meio e rebentava a seguir, a
// perguntar a cor de um ecrã que já não existia.
// ---- (era a 5) ---------------------------------------
console.log("\n== e sobrevive a guardar e reabrir ==");
const guardado = await pagina.evaluate(() => {
  const a = window.preview.ajustes;
  return JSON.parse(JSON.stringify({ grupos: a.grupos }));
});
const retrato = guardado.grupos.map((g) => g.nome + ":" + g.chaves.length).join(", ");
console.log("   nos ajustes: " + retrato);
conferir(guardado.grupos.length >= 1,
  "há grupo nos ajustes, que são o que vai para o ficheiro e para o localStorage");

await pagina.reload({ waitUntil: "networkidle" });
await pagina.waitForFunction(() => window.preview && window.preview.montar, null, { timeout: 30000 });
await pagina.waitForTimeout(2500);
const depoisDeRecarregar = await pagina.evaluate(() => ({
  grupos: (window.preview.ajustes.grupos || []).map((g) => ({ nome: g.nome, quantas: g.chaves.length }))
}));
const retratoDepois = depoisDeRecarregar.grupos.map((g) => g.nome + ":" + g.quantas).join(", ");
console.log("   depois de recarregar: " + retratoDepois);
// Compara-se com o retrato de ANTES e não com um número escrito à mão: as
// secções anteriores mexem nos grupos, e um número fixo aqui ficava velho ao
// primeiro teste novo que alguém acrescentasse acima.
conferir(retratoDepois === retrato,
  "e continua igual depois de recarregar a app — um cenário que se desfaz ao reabrir não é um cenário");


conferir(erros.length === 0, erros.length ? "erro de JavaScript: " + erros[0] : "sem erros de JavaScript");

await browser.close();
s.close();
console.log("\n" + (falhas ? falhas + " FALHA(S)"
  : "Um cenário é um objeto: anda junto, pinta-se de uma cor, e abre-se para afinar um degrau."));
process.exit(falhas ? 1 : 0);
