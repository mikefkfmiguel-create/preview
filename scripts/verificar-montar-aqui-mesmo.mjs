/**
 * "MONTAR UM ECRÃ AQUI MESMO" — o botão tem de fazer o que o nome diz.
 *
 * Duas voltas a acertar o mesmo atalho, e a segunda veio com uma foto do
 * telemóvel: *"não era para parar aqui pois não"*.
 *
 *   · primeiro levava a "Ecrãs na sala", que numa app vazia não tem um único
 *     botão — aterrava-se num sítio sem nada para carregar;
 *   · depois passou a levar ao DEPÓSITO, em cima do "+ Ecrã". Melhor, mas
 *     ainda não era montar: o "+ Ecrã" põe a peça à ESPERA, a sala continuava
 *     vazia, a cena continuava igual e o cartão "A sala está vazia"
 *     continuava lá a dizer que não havia nada.
 *
 * Pelo caminho apareceram dois defeitos por baixo, e são a parte que este
 * teste guarda com mais cuidado, porque nenhum se vê a olho:
 *
 *   · **o cabeçalho do painel é sticky** e passa por cima do que rola por
 *     baixo. Levar algo ao "topo do painel" metia-o DEBAIXO dele, e o que
 *     aparecia em cima era o que vinha uns 230 px mais abaixo — foi
 *     exactamente o que ele fotografou;
 *   · **a rolagem suave acabava ao lado** (medida 147 px fora): o painel
 *     reescreve-se a seguir a isto, e uma animação de 300 ms a apontar a um
 *     sítio cujo endereço muda a meio acaba noutro lado.
 *
 * O que este teste guarda, no computador E no telemóvel:
 *
 *   1. o botão monta MESMO: o ecrã entra na sala, não no depósito, e o cartão
 *      "A sala está vazia" desaparece;
 *   2. a câmara vai ter com ele — numa sala de 50 × 50 m um ecrã de 2 m tem
 *      de ficar à vista, e não um ponto do tamanho de uma unha;
 *   3. o painel aterra na linha do ecrã, VISÍVEL — por baixo do cabeçalho e
 *      não tapada por ele;
 *   4. e continua lá assente um segundo depois, sem escorregar;
 *   5. o "+ Ecrã" do depósito NÃO mudou: respeita o interruptor, como sempre;
 *   6. "Ligar o palco..." pisca a pastilha na barra;
 *   7. nenhum texto manda ninguém à "secção Vista", que já não tem o que lá
 *      procurava.
 *
 *   node scripts/verificar-montar-aqui-mesmo.mjs
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

let falhas = 0;
const conferir = (ok, texto) => { console.log((ok ? "  ✓ " : "  ✗ ") + texto); if (!ok) falhas++; };
const erros = [];

async function abrir(medida) {
  const ctx = await browser.newContext({
    viewport: medida, serviceWorkers: "block",
    isMobile: medida.width < 500, hasTouch: medida.width < 500
  });
  const p = await ctx.newPage();
  p.on("pageerror", (e) => erros.push(e.message));
  await p.goto(`http://127.0.0.1:${porta}/index.html`, { waitUntil: "networkidle" });
  await p.waitForFunction(() => window.preview && window.preview.montar, null, { timeout: 30000 });
  await p.waitForTimeout(1400);
  return { ctx, p };
}

const tocarNoAviso = (p, texto) => p.evaluate((t) => {
  const bt = [...document.querySelectorAll("#avisoVazio button")]
    .find((b) => new RegExp(t, "i").test(b.textContent));
  if (bt) bt.click();
  return !!bt;
}, texto);

/** O que a app tem a dizer de si própria, depois de tudo assentar. */
const olhar = (p) => p.evaluate(() => {
  const THREE = window.preview.THREE;
  const proj = window.preview.projeto;
  const zona = proj && proj.zonas.length ? proj.zonas[proj.zonas.length - 1] : null;

  let peca = null;
  if (zona) window.preview.desenhado.traverse((o) => {
    if (!peca && o.name === "zona " + zona.nome) peca = o;
  });

  // A linha do ecrã no painel, e se ela está mesmo À VISTA: dentro da janela
  // do painel E por baixo do cabeçalho, que é sticky e tapa o que lá passa.
  const painel = document.getElementById("painel");
  const cabecalho = painel.querySelector("header");
  const linha = document.querySelector("#listaZonas input");
  const rP = painel.getBoundingClientRect();
  const rC = cabecalho ? cabecalho.getBoundingClientRect() : { bottom: rP.top };
  const rL = linha ? linha.getBoundingClientRect() : null;

  const alvo = window.preview.controlos ? window.preview.controlos.target : null;
  let distancia = null, centroDaPeca = null;
  if (peca && alvo) {
    const c = new THREE.Box3().setFromObject(peca).getCenter(new THREE.Vector3());
    centroDaPeca = { x: +c.x.toFixed(2), y: +c.y.toFixed(2), z: +c.z.toFixed(2) };
    distancia = +window.preview.camara.position.distanceTo(c).toFixed(2);
  }

  return {
    zonas: proj ? proj.zonas.length : 0,
    naCena: !!peca,
    noDeposito: ((document.getElementById("depositoContador") || {}).textContent || "").trim(),
    avisoVazio: document.getElementById("avisoVazio").classList.contains("mostra"),
    linhaExiste: !!rL,
    linhaAVista: !!rL && rL.top >= rC.bottom - 1 && rL.bottom <= rP.bottom + 1,
    linhaTopo: rL ? Math.round(rL.top - rC.bottom) : null,
    camaraAlvo: alvo ? { x: +alvo.x.toFixed(2), y: +alvo.y.toFixed(2), z: +alvo.z.toFixed(2) } : null,
    centroDaPeca: centroDaPeca,
    distancia: distancia
  };
});

for (const medida of [{ width: 1400, height: 950 }, { width: 393, height: 873 }]) {
  const onde = medida.width < 500 ? "telemóvel" : "computador";
  console.log("\n══ " + onde + " (" + medida.width + "×" + medida.height + ") ══");
  const { ctx, p } = await abrir(medida);

  console.log("\n== o botão monta mesmo ==");
  const antes = await olhar(p);
  conferir(antes.zonas === 0 && antes.avisoVazio, onde + ": a sala começa vazia");
  conferir(await tocarNoAviso(p, "Montar um ecrã"), onde + ": o botão existe");
  await p.waitForTimeout(1800);
  const depois = await olhar(p);
  conferir(depois.zonas === 1, onde + ": criou um ecrã (" + depois.zonas + ")");
  conferir(depois.naCena, onde + ": e ele está DESENHADO na sala");
  conferir(depois.noDeposito === "",
    onde + ": não ficou à espera no depósito («" + depois.noDeposito + "»)");
  conferir(depois.avisoVazio === false,
    onde + ": e o cartão \"A sala está vazia\" desapareceu");

  console.log("\n== a câmara vai ter com ele ==");
  conferir(!!depois.camaraAlvo && !!depois.centroDaPeca &&
    Math.abs(depois.camaraAlvo.x - depois.centroDaPeca.x) < 0.3 &&
    Math.abs(depois.camaraAlvo.z - depois.centroDaPeca.z) < 0.3,
    onde + ": a câmara aponta ao ecrã, e não ao meio da sala " +
    JSON.stringify(depois.camaraAlvo));
  // Enquadrar TUDO numa sala de 50 × 50 m punha a câmara a dezenas de metros
  // e o ecrã de 2 m ficava um ponto. Com folga para se ver onde ele está,
  // mas perto.
  conferir(depois.distancia !== null && depois.distancia < 18,
    onde + ": e fica perto — " + depois.distancia + " m");

  console.log("\n== o painel aterra na linha do ecrã, à vista ==");
  conferir(depois.linhaExiste, onde + ": a linha do ecrã existe no painel");
  conferir(depois.linhaAVista,
    onde + ": e está visível, por baixo do cabeçalho (" + depois.linhaTopo + " px abaixo dele)");
  // Um segundo depois continua lá: o painel reescreve-se a seguir a isto, e
  // era aí que a rolagem escorregava.
  await p.waitForTimeout(1200);
  const assente = await olhar(p);
  conferir(assente.linhaAVista,
    onde + ": e continua lá um segundo depois (" + assente.linhaTopo + " px)");

  console.log("\n== o \"+ Ecrã\" do depósito não mudou ==");
  const pelaLista = await p.evaluate(async () => {
    const ligado = document.getElementById("depositoLigado").checked;
    document.getElementById("btNovaZona").click();
    await new Promise((r) => setTimeout(r, 1600));
    return { ligado, contador: ((document.getElementById("depositoContador") || {}).textContent || "").trim() };
  });
  conferir(pelaLista.ligado === true, onde + ": o depósito está ligado, como nasce");
  conferir(pelaLista.contador === "1",
    onde + ": e o \"+ Ecrã\" pôs a peça à espera lá (" + pelaLista.contador + ")");

  await ctx.close();
}

console.log("\n== \"Ligar o palco...\" aponta para a barra ==");
const { ctx, p } = await abrir({ width: 1400, height: 950 });
const pisca = await p.evaluate(async () => {
  const bt = [...document.querySelectorAll("#avisoVazio button")]
    .find((b) => /Ligar o palco/i.test(b.textContent));
  if (!bt) return { botao: false };
  bt.click();
  await new Promise((r) => setTimeout(r, 200));
  return {
    botao: true,
    apontada: document.getElementById("verPalco").closest(".chip").classList.contains("apontada"),
    paraSeccao: bt.dataset.secao || null
  };
});
conferir(pisca.botao && pisca.apontada === true, "pisca a pastilha do Palco na barra");
conferir(pisca.paraSeccao === null, "sem mandar ninguém para secção nenhuma");
await ctx.close();

console.log("\n== nenhum texto manda à \"secção Vista\" ==");
// Lido do ficheiro e não do ecrã: uma frase destas pode estar num aviso que
// só aparece num caso raro, e é precisamente aí que ninguém a apanha.
const fontes = await Promise.all(["index.html", "js/app.js", "js/cena.js"]
  .map(async (f) => [f, await readFile(join(RAIZ, f), "utf8")]));
fontes.forEach(([nome, texto]) => {
  const linhas = texto.split("\n")
    .map((l, i) => (/secção Vista|seccao Vista/.test(l) ? (i + 1) + ": " + l.trim().slice(0, 70) : null))
    .filter(Boolean);
  conferir(linhas.length === 0, nome + " não manda ninguém à secção Vista" +
    (linhas.length ? " — " + linhas.join(" | ") : ""));
});

console.log("\n== sem erros na consola ==");
conferir(erros.length === 0, erros.length ? erros.join(" | ") : "nenhum");

await browser.close();
s.close();
console.log(falhas ? `\n${falhas} falha(s).` : "\nO botão que diz montar, monta.");
process.exit(falhas ? 1 : 0);
