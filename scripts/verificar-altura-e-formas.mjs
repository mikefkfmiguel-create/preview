/**
 * A ALTURA VEM DE QUEM A SABE, E AS FORMAS DO PALCO SÃO AS QUE SE PEDEM.
 *
 * Três reparos dele na mesma manhã, todos medidos aqui:
 *
 * 1. *"está a nascer assim quando vem da calculadora e nela não tenho onde
 *    dizer a que altura do chão está o ecrã"*. O alçado dos Calculadores só
 *    sabia posições RELATIVAS entre zonas -- não tinha chão. Sem esse número,
 *    este lado punha a base do conjunto na altura do palco (1 m por omissão),
 *    que não é escolha de ninguém: é o que sobra. Agora vem no payload
 *    (`alturaDoChao`) e manda.
 *
 *    Duas armadilhas guardadas aqui: o campo tem de sobreviver à LISTA BRANCA
 *    do projeto.js (a primeira tentativa morreu lá, em silêncio), e o ZERO tem
 *    de passar -- zero é o ecrã pousado no chão, não é "não sei".
 *
 * 2. *"ao desligar apenas está a apagar um projetor"*. E era: a guarda do
 *    interruptor vivia DENTRO do desenharProjecao(), e a fila de extras (e o
 *    blend curvo) desenhavam-se na mesma. Medido antes: desligado ficavam 6
 *    objectos na cena.
 *
 * 3. *"o palco inicial não está a dar para fazer em apenas frente redonda, e
 *    quando peço círculo não está a desenhá-lo correto"*. Duas coisas: o
 *    principal nunca passou o `meio` ao desenho (só os palcos extra o faziam),
 *    e os cantos eram Béziers quadráticas -- que não são arcos. Um palco de
 *    16 m pedido em círculo saía com 8,49 m do centro à diagonal em vez de
 *    8,00: +6,1%, quase meio metro.
 *
 *   node scripts/verificar-altura-e-formas.mjs
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

const SALA = { largura: 24, profundidade: 30, altura: 9 };
const ZONA = { nome: "Ecrã", id: "z1", x: 0, y: 0, w: 8, h: 4.5, cor: "#2e7bff", tipo: "led" };

/** Abre a app com um projeto dos Calculadores, com (ou sem) altura ao chão. */
async function comAltura(alturaDoChao) {
  await pagina.goto(`http://127.0.0.1:${porta}/index.html`, { waitUntil: "networkidle" });
  await pagina.evaluate(([sala, zona, h]) => {
    localStorage.clear();
    localStorage.setItem("mikeapps-sincronizacao-v1", JSON.stringify("ligada"));
    const projeto = { nome: "Altura", origem: "calculadores", sala, zonas: [zona] };
    if (h !== null) projeto.alturaDoChao = h;
    localStorage.setItem("mikeapps-projeto-v1", JSON.stringify(projeto));
  }, [SALA, ZONA, alturaDoChao]);
  await pagina.reload({ waitUntil: "networkidle" });
  await pagina.waitForFunction(() => window.preview && window.preview.montar, null, { timeout: 30000 });
  await pagina.waitForTimeout(1400);
  return pagina.evaluate(() => {
    const w = window.preview, THREE = w.THREE;
    const grupo = w.desenhado.getObjectByName("zona Ecrã");
    let baixo = null;
    if (grupo) {
      const b = new THREE.Box3().setFromObject(grupo);
      if (!b.isEmpty()) baixo = +b.min.y.toFixed(2);
    }
    const nota = document.getElementById("alturaVemDaCalculadora");
    return {
      baseDaMalha: baixo,
      noProjeto: w.projeto ? w.projeto.alturaDoChao : undefined,
      nota: nota && nota.style.display !== "none" ? nota.textContent.trim() : null,
      // «tudo entra direto na sala»: nada fica à espera.
      aEsperaNoDeposito: (w.ajustes && w.ajustes.noDeposito || []).length
    };
  });
}

console.log("\n== a altura ao chão vem dos Calculadores ==");

const semAltura = await comAltura(null);
// Sem o campo, o comportamento de sempre: a base cai na altura do palco
// (1 m + 0 m por omissão). É o que os projetos anteriores a isto esperam.
conferir(semAltura.baseDaMalha === 1,
  `um projeto sem o campo continua a assentar no palco (base a ${semAltura.baseDaMalha} m)`);
conferir(semAltura.nota === null, "e o painel não fala de uma altura que ninguém deu");

const a24 = await comAltura(2.4);
conferir(a24.noProjeto === 2.4,
  "o campo sobrevive à lista branca do projeto.js (foi aí que morreu à primeira)");
conferir(a24.baseDaMalha === 2.4,
  `2,4 m pedidos põem a base do ecrã a 2,4 m (medido: ${a24.baseDaMalha} m)`);
conferir(!!a24.nota && /2,40 m do chão/.test(a24.nota),
  "e o painel do palco diz que a altura vem de lá, em vez de ter dois campos a mentir");

// O ZERO É UMA RESPOSTA. Com `||` em vez de `== null`, um ecrã pousado no
// chão saltava para cima do palco -- e ninguém percebia porquê.
const a0 = await comAltura(0);
conferir(a0.baseDaMalha === 0,
  `zero quer dizer pousado no chão, e passa (medido: ${a0.baseDaMalha} m)`);

conferir(a24.aEsperaNoDeposito === 0,
  "e o que vem dos Calculadores entra na SALA, não fica à espera no depósito");

console.log("\n== «Mostrar projeção» desliga a projeção toda ==");

const projecao = await pagina.evaluate(async () => {
  const contar = () => {
    let n = 0;
    window.preview.desenhado.traverse((o) => { if (/projec|projetor/i.test(o.name || "")) n++; });
    return n;
  };
  const caixa = document.getElementById("projLigada");
  caixa.checked = true; caixa.dispatchEvent(new Event("change", { bubbles: true }));
  await new Promise((r) => setTimeout(r, 700));
  const so1 = contar();
  // Uma fila de blend: é aqui que estava o defeito.
  window.preview.ajustes.projetoresExtra = [
    { racio: 1.4, distancia: 12, lateral: -4, alturaOffset: 0 },
    { racio: 1.4, distancia: 12, lateral: 4, alturaOffset: 0 }];
  window.preview.montar(false);
  await new Promise((r) => setTimeout(r, 700));
  const comFila = contar();
  caixa.checked = false; caixa.dispatchEvent(new Event("change", { bubbles: true }));
  await new Promise((r) => setTimeout(r, 700));
  const desligada = contar();
  // E a pastilha do topo tem de ser o MESMO interruptor.
  const chip = document.getElementById("verProjecao");
  const espelhaDesligado = chip && chip.checked === false;
  chip.checked = true; chip.dispatchEvent(new Event("change", { bubbles: true }));
  await new Promise((r) => setTimeout(r, 700));
  return { so1, comFila, desligada, espelhaDesligado,
           campoSegueAPastilha: document.getElementById("projLigada").checked === true,
           voltouAAparecer: contar() };
});
conferir(projecao.comFila > projecao.so1,
  `a fila de blend desenha-se (${projecao.so1} objectos com P1, ${projecao.comFila} com a fila)`);
conferir(projecao.desligada === 0,
  `desligada não sobra NADA na cena (medido: ${projecao.desligada}; antes desta versão ficavam 6)`);
conferir(projecao.espelhaDesligado, "a pastilha do topo acompanha o campo do painel");
conferir(projecao.campoSegueAPastilha && projecao.voltouAAparecer > 0,
  "e a pastilha do topo liga a projeção de volta — são o mesmo interruptor");

console.log("\n== as formas do palco principal ==");

/** O troço RETO de cada bordo: a largura em X dos vértices no Z extremo. */
const formaDoPalco = (profundidade, raio, meio) => pagina.evaluate(async ([P, R, meio]) => {
  const por = (id, v) => { const el = document.getElementById(id);
    if (el.type === "checkbox") el.checked = !!v; else el.value = String(v);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true })); };
  por("verPalco", true); por("palcoL", 16); por("palcoA", 1);
  por("palcoP", P); por("palcoR", R); por("palcoMeio", meio);
  await new Promise((r) => setTimeout(r, 1200));
  const o = window.preview.desenhado.getObjectByName("palco");
  const malha = o && (o.isMesh ? o : o.children.find((c) => c.isMesh));
  if (!malha) return null;
  const g = malha.geometry; g.computeBoundingBox();
  const bb = g.boundingBox, pos = g.attributes.position;
  const reto = (zAlvo) => {
    let min = Infinity, max = -Infinity;
    for (let i = 0; i < pos.count; i++) {
      if (Math.abs(pos.getZ(i) - zAlvo) > 0.005) continue;
      min = Math.min(min, pos.getX(i)); max = Math.max(max, pos.getX(i));
    }
    return min === Infinity ? 0 : +(max - min).toFixed(2);
  };
  // O ponto mais afastado do centro, na diagonal: num círculo é o raio.
  let maisLonge = 0;
  for (let i = 0; i < pos.count; i++) {
    const X = pos.getX(i), Z = pos.getZ(i);
    if (Math.abs(X) > 0.01 && Math.abs(Z) > 0.01) maisLonge = Math.max(maisLonge, Math.hypot(X, Z));
  }
  return { largura: +(bb.max.x - bb.min.x).toFixed(2), fundo: +(bb.max.z - bb.min.z).toFixed(2),
           retoAtras: reto(bb.min.z), retoAFrente: reto(bb.max.z), maisLonge: +maisLonge.toFixed(3) };
}, [profundidade, raio, meio]);

// O CÍRCULO É UM CÍRCULO. Com as Béziers quadráticas de antes, o ponto mais
// afastado ficava a 8,49 m em vez de 8,00 -- +6,1%.
const circulo = await formaDoPalco(16, 8, false);
conferir(circulo.largura === 16 && circulo.fundo === 16, "16 × 16 m pedidos, 16 × 16 m desenhados");
conferir(perto(circulo.maisLonge, 8, 0.05),
  `e é redondo a sério: ${circulo.maisLonge} m do centro à diagonal, contra os 8 m do raio ` +
  `(com as Béziers de antes dava 8,49)`);

// SÓ A FRENTE. A traseira fica a direito de ponta a ponta.
const todosOsCantos = await formaDoPalco(6, 3, false);
const soAFrente = await formaDoPalco(6, 3, true);
conferir(perto(todosOsCantos.retoAtras, 10, 0.3) && perto(todosOsCantos.retoAFrente, 10, 0.3),
  `com os quatro cantos arredondados, atrás e à frente ficam ${todosOsCantos.retoAtras} m a direito`);
conferir(perto(soAFrente.retoAtras, 16, 0.05),
  `"só a frente arredondada" deixa a traseira inteira a direito (${soAFrente.retoAtras} m de 16)`);
conferir(perto(soAFrente.retoAFrente, 10, 0.3),
  `e a frente arredondada (${soAFrente.retoAFrente} m a direito, o resto em curva)`);

// Os botões fazem o que o título deles diz.
const botoes = await pagina.evaluate(async () => {
  const clicar = async (id) => {
    document.getElementById(id).click();
    await new Promise((r) => setTimeout(r, 900));
    return { P: document.getElementById("palcoP").value, R: document.getElementById("palcoR").value,
             meio: document.getElementById("palcoMeio").checked };
  };
  document.getElementById("palcoL").value = "16";
  document.getElementById("palcoL").dispatchEvent(new Event("input", { bubbles: true }));
  await new Promise((r) => setTimeout(r, 400));
  return { lua: await clicar("btPalcoMeiaLua"), redondo: await clicar("btPalcoRedondo") };
});
conferir(botoes.lua.P === "8" && botoes.lua.R === "8" && botoes.lua.meio === true,
  "o botão da meia-lua põe profundidade 8, raio 8 e a traseira reta");
conferir(botoes.redondo.P === "16" && botoes.redondo.R === "8" && botoes.redondo.meio === false,
  "e o do círculo desmarca a traseira reta — um círculo é redondo à volta toda");

console.log("\n== o blend plano nasce no sítio ==");
// Reparo dele, com uma foto: *"continua abaixo do chão e não centrado na
// sala"*. Duas coisas, e as duas do mesmo caminho -- o do blend, que é OUTRA
// ponte (mikeapps-projetor-v1) e não a das zonas.
//
// 1. A altura da lente e o shift só viajavam num ecrã CURVO (desde a v3.43).
//    Num plano o Preview arrancava com os valores dele -- lente a 4,5 m e
//    shift -25% -- enquanto os Calculadores diziam, na aba ao lado, que eram
//    precisos outros. Com uma imagem alta, a base ficava abaixo do chão.
// 2. O `lateral` vem centrado na tela, mas a PRIMEIRA máquina nunca escrevia
//    o dela: as outras são postas em relação a ela, e a fila inteira acabava
//    deslocada exactamente esse valor.
await pagina.evaluate(() => {
  // Limpar o que a secção da projeção deixou: uma fila antiga em ajustes
  // fazia o teste medir as imagens erradas e dar-se por satisfeito.
  window.preview.ajustes.projetoresExtra = [];
  localStorage.setItem("mikeapps-projetor-v1", JSON.stringify({
    v: 2, curva: null, retro: false, alturaLente: 8, shiftV: -83.3,
    projetores: [
      { lateral: -3.47, alturaOffset: 0, largura: 5.05, altura: 6, racio: 3.563, distancia: 18 },
      { lateral: 0,     alturaOffset: 0, largura: 5.05, altura: 6, racio: 3.563, distancia: 18 },
      { lateral: 3.47,  alturaOffset: 0, largura: 5.05, altura: 6, racio: 3.563, distancia: 18 }],
    quando: new Date().toISOString() }));
});
// A ponte lê-se ao carregar: escrever e carregar no botão na mesma página não
// a apanha, e o teste media as imagens de antes.
await pagina.reload({ waitUntil: "networkidle" });
await pagina.waitForFunction(() => window.preview && window.preview.montar, null, { timeout: 30000 });
await pagina.waitForTimeout(1500);

const blend = await pagina.evaluate(async () => {
  // SINCRONIZAR, e não "Trazer projeto": este último só aplica a ponte do
  // blend quando NÃO há projeto de zonas (ver btTrazerProjeto em app.js).
  // Com as duas pontes cheias -- que é o caso dele, com o sync ligado -- quem
  // aplica as duas é o Sincronizar.
  document.getElementById("btSincronizar").click();
  await new Promise((r) => setTimeout(r, 2500));
  const _ = JSON.stringify({
    nota: "a ponte já foi aplicada no carregamento" });
  const w = window.preview, THREE = w.THREE;
  const imgs = [];
  w.desenhado.traverse((o) => {
    if (!o.isMesh || !/projecao-imagem/.test(o.name || "")) return;
    const bb = new THREE.Box3().setFromObject(o);
    if (!bb.isEmpty()) imgs.push({ x0: bb.min.x, x1: bb.max.x, y0: bb.min.y });
  });
  const xs = imgs.flatMap((i) => [i.x0, i.x1]);
  return {
    n: imgs.length,
    altura: document.getElementById("projAltura").value,
    shiftV: document.getElementById("projShiftV").value,
    lateral: document.getElementById("projLateral").value,
    centro: imgs.length ? +(((Math.min(...xs) + Math.max(...xs)) / 2)).toFixed(2) : null,
    maisBaixo: imgs.length ? +Math.min(...imgs.map((i) => i.y0)).toFixed(2) : null
  };
});
conferir(blend.n === 3, "as três imagens do blend estão na cena (" + blend.n + ")");
conferir(blend.altura === "8.00",
  "a altura da lente vem dos Calculadores, não do 4,5 m por omissão (" + blend.altura + " m)");
conferir(Number(blend.shiftV) === -83.3,
  "e o shift que ela obriga também (" + blend.shiftV + "%, não os -25% por omissão)");
// A asserção que decide o "não centrado".
conferir(blend.n === 3 && perto(blend.centro, 0, 0.05),
  "a fila fica CENTRADA na sala (centro em x = " + blend.centro + "; antes desta versão, +3,47)");
conferir(Number(blend.lateral) === -3.47,
  "porque a primeira máquina passa a escrever o lateral dela (" + blend.lateral + ")");
conferir(blend.n === 3 && blend.maisBaixo >= -0.05,
  "e nada fica abaixo do chão (ponto mais baixo: " + blend.maisBaixo + " m)");

console.log("\n== o pano plano é uma peça, e agrupa-se ==");
// Pedido dele: *"e se precisar andar com o ecrã para o meio da sala, de forma
// a que possa agrupar com os projetores"*. Não havia como: o pano plano nem
// sequer existia como objeto -- só se viam as imagens a aterrar --, e a
// distância à parede do fundo estava escrita à mão em quatro sítios.
const pano = await pagina.evaluate(async () => {
  const w = window.preview, THREE = w.THREE;
  const onde = (nome) => {
    const o = w.desenhado.getObjectByName(nome);
    if (!o) return null;
    const bb = new THREE.Box3().setFromObject(o);
    return bb.isEmpty() ? null
      : { x: +(((bb.min.x + bb.max.x) / 2)).toFixed(2), z: +(((bb.min.z + bb.max.z) / 2)).toFixed(2),
          largura: +((bb.max.x - bb.min.x)).toFixed(2) };
  };
  const antes = { pano: onde("ecra-plano"), p0: onde("projetor-0") };
  const rotulos = w.objetosArrastaveis().map((a) => a.rotulo);
  // Mover o pano SOZINHO: as máquinas ficam, e vê-se o feixe a bater ao lado.
  const campo = document.getElementById("projDz");
  campo.value = "6"; campo.dispatchEvent(new Event("input", { bubbles: true }));
  await new Promise((r) => setTimeout(r, 1000));
  const soPano = { pano: onde("ecra-plano"), p0: onde("projetor-0") };
  // E AGORA EM GRUPO: pano e máquinas marcados juntos.
  w.selecaoDeGrupo.clear();
  ["ecra-plano", "projetor-0", "projetor-1", "projetor-2"].forEach((n) => w.selecaoDeGrupo.add(n));
  const nGrupo = w.alvosSelecionados().length;
  w.moverGrupo(2, 0, 3);
  await new Promise((r) => setTimeout(r, 1200));
  return { antes, soPano, nGrupo, depois: { pano: onde("ecra-plano"), p0: onde("projetor-0") }, rotulos };
});
conferir(!!pano.antes.pano, "o pano plano existe na cena como objeto próprio");
conferir(pano.antes.pano && perto(pano.antes.pano.largura, 12, 0.1),
  "e tem a largura das imagens somadas (" + (pano.antes.pano || {}).largura + " m para três de 5,05)");
conferir(pano.rotulos.includes("Pano"), "é uma peça agarrável, como o ecrã curvo");

// Sozinho, o pano anda e as máquinas ficam -- é aí que se vê o feixe ao lado.
conferir(perto(pano.soPano.pano.z - pano.antes.pano.z, 6, 0.1),
  "mover só o pano leva-o para dentro da sala (+6 m)");
conferir(perto(pano.soPano.p0.z, pano.antes.p0.z, 0.05),
  "e as máquinas ficam onde estavam — o pano vai sozinho");

// EM GRUPO: cada peça anda UMA vez. À primeira andavam a dobrar, porque havia
// um interruptor a arrastar as máquinas e o grupo a arrastá-las outra vez.
conferir(pano.nGrupo === 4, "pano e três máquinas entram no mesmo grupo (" + pano.nGrupo + ")");
conferir(perto(pano.depois.pano.x - pano.soPano.pano.x, 2, 0.05) &&
         perto(pano.depois.pano.z - pano.soPano.pano.z, 3, 0.05),
  "o grupo move o pano exactamente o que se pediu (+2 x, +3 z), e não a dobrar");
conferir(perto(pano.depois.p0.x - pano.soPano.p0.x, 2, 0.05) &&
         perto(pano.depois.p0.z - pano.soPano.p0.z, 3, 0.05),
  "e as máquinas o mesmo — uma vez cada, não duas");

// E A IMAGEM NÃO MUDA DE TAMANHO. Reparo dele com o conjunto já agrupado:
// *"mantém-se o problema assim que movo o conjunto"*. Mantinha-se, de outra
// maneira: medido, mover o grupo 4 m para dentro da sala engordava a imagem
// de 11,99 m para 13,12 m (+9,4%). O tamanho saía do CAMPO da distância, que
// está ancorado à parede do fundo -- mover o grupo soma o mesmo número ao
// campo e ao pano, o tiro real não muda um centímetro, e a imagem crescia
// com o número. Passa a sair do tiro que está desenhado.
conferir(perto(pano.depois.pano.largura, pano.soPano.pano.largura, 0.02),
  "mover o grupo NÃO muda o tamanho da imagem (" +
  pano.soPano.pano.largura + " m → " + pano.depois.pano.largura + " m)");

// O outro lado da mesma conta, e é o que prova que não se fixou o tamanho à
// força: chegar o pano SOZINHO às máquinas encolhe a imagem, como na sala.
conferir(pano.soPano.pano.largura < pano.antes.pano.largura - 1,
  "mas mover o pano SOZINHO encolhe-a, que é o que um tiro mais curto faz (" +
  pano.antes.pano.largura + " m → " + pano.soPano.pano.largura + " m)");

// E PARA TRÁS TAMBÉM. Reparo dele, com uma foto do grupo já feito: recuar o
// conjunto movia as máquinas e deixava o pano parado. O campo guardava o
// número negativo e um `Math.max(0, ...)` no desenho deitava-o fora -- um
// campo que aceita um número e o ignora é pior do que um que não o aceita.
const recuo = await pagina.evaluate(async () => {
  const w = window.preview, THREE = w.THREE;
  const z = (nome) => { const o = w.desenhado.getObjectByName(nome); if (!o) return null;
    const bb = new THREE.Box3().setFromObject(o);
    return bb.isEmpty() ? null : +(((bb.min.z + bb.max.z) / 2)).toFixed(2); };
  const larg = () => { const o = w.desenhado.getObjectByName("ecra-plano"); if (!o) return null;
    const bb = new THREE.Box3().setFromObject(o);
    return bb.isEmpty() ? null : +((bb.max.x - bb.min.x)).toFixed(2); };
  const antes = { pano: z("ecra-plano"), p0: z("projetor-0"), largura: larg() };
  w.moverGrupo(0, 0, -2.84);
  await new Promise((r) => setTimeout(r, 1200));
  return { antes, depois: { pano: z("ecra-plano"), p0: z("projetor-0"), largura: larg() },
           resumo: document.getElementById("resumoProj").textContent,
           campo: document.getElementById("projDz").value };
});
conferir(perto(recuo.depois.pano - recuo.antes.pano, -2.84, 0.05),
  "recuar o grupo leva o PANO para trás (" + (recuo.depois.pano - recuo.antes.pano).toFixed(2) + " m)");
conferir(perto(recuo.depois.p0 - recuo.antes.p0, -2.84, 0.05),
  "e as máquinas o mesmo — não se separam quando o número é negativo");
conferir(perto(recuo.depois.largura, recuo.antes.largura, 0.02),
  "e para trás a imagem também mantém o tamanho (" + recuo.depois.largura + " m)");

// O CAMPO DA DISTÂNCIA CONTA DA PAREDE, o tiro conta do pano. Com o pano
// fora da parede os dois números afastam-se, e o painel tem de dizer qual é
// qual: 22 m escritos com uma imagem de 18 m era a app a saber e a não dizer.
conferir(/tiro real/.test(recuo.resumo),
  "o painel diz o TIRO REAL quando o pano já não está na parede");

conferir(erros.length === 0, erros.length ? "erro de JavaScript: " + erros[0] : "sem erros de JavaScript");

await browser.close();
s.close();
console.log("\n" + (falhas ? falhas + " FALHA(S)"
  : "A altura vem de quem a sabe, e o palco tem a forma que se lhe pede."));
process.exit(falhas ? 1 : 0);
