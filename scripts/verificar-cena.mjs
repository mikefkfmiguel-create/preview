/**
 * A CENA DESENHA-SE ATÉ AO FIM? — o primeiro teste automático deste projeto.
 *
 * Porque é que existe: a v3.51 saiu com uma linha que rebentava a meio do
 * `montar()` em QUALQUER projeto com projetores e sem cúpula. O `montar()`
 * começa por deitar fora o grupo que está na cena e só o entrega no fim, por
 * isso um erro a meio deixava o ecrã PRETO — sala, palco, ecrãs, plateia,
 * tudo. E como o painel continuava a responder, a app não parecia partida:
 * parecia vazia. Foi assim que chegou ao telemóvel do mike, no terreno.
 *
 * Um erro de JavaScript não se vê a olho — vê-se só o buraco que deixa. Isto
 * abre a app em cada forma de projeto que costuma aparecer e falha se:
 *
 *   1. houver um erro de JavaScript na página (`pageerror`);
 *   2. a rede de segurança do `montar()` tiver apanhado algum
 *      (`window.__errosDeDesenho` — senão o try/catch escondia o defeito
 *      justamente do teste feito para o encontrar);
 *   3. o `montar()` não tiver chegado ao fim. A última coisa que ele faz é
 *      `guardarSala()`, e essa escreve a hora — se o carimbo não mexeu, o
 *      desenho parou pelo caminho.
 *
 * Correr:  node scripts/verificar-cena.mjs
 * Sai com código 1 a qualquer falha, para servir num workflow.
 */

import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = fileURLToPath(new URL("..", import.meta.url));

const TIPOS = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8", ".png": "image/png",
  ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".wasm": "application/wasm",
  ".ico": "image/x-icon", ".webmanifest": "application/manifest+json"
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
      } catch (_) {
        res.writeHead(404).end("não há");
      }
    });
    s.listen(0, "127.0.0.1", () => resolve({ s, porta: s.address().port }));
  });
}

// ------------------------------------------------------- as formas de projeto

const SALA = { largura: 20, profundidade: 14, altura: 6 };

const ECRAS = {
  nome: "Ecrãs LED", origem: "calculadores", sala: SALA,
  zonas: [
    { nome: "Ecrã LED", id: "z1", x: 0, y: 0, w: 6, h: 3, cor: "#2e7bff", tipo: "led" },
    { nome: "Delay 1", id: "z2", x: 7, y: 0, w: 1.2, h: 0.7, cor: "#F59E0B", tipo: "tv" }
  ]
};

const DOME = {
  nome: "Cúpula", origem: "calculadores", sala: SALA, zonas: [],
  dome: { diametro: 12, altura: 6, inclinacao: 0, projetores: { n: 6, anel: 6, racio: 0.8, distancia: 5 } }
};

// Um blend de três num ecrã curvo, como a aba Blending o manda.
const BLEND_CURVO = {
  v: 2,
  curva: { raio: 12, corda: 17.3, arco: 18, altura: 4.5, alturaLente: 2.2, shiftV: -25, montagem: "arco", retro: false },
  retro: false,
  projetores: [-6, 0, 6].map((x) => ({
    racio: 1.5, distancia: 6, largura: 6, altura: 4.5,
    modelo: "Projetor", lente: "", lateral: x, alturaOffset: 0
  }))
};

const CASOS = [
  { nome: "app vazia, nada guardado" },
  { nome: "só ecrãs (sem projeção)", projeto: ECRAS },
  // O caso que a v3.51 partiu: projetores na cena e nenhuma cúpula.
  // `coordenadas: true` diz que este caso TEM DE encher a tabela das
  // Coordenadas de montagem. Sem isso, um caso que deixasse de pôr projetores
  // na cena passava a verde sem ter testado nada -- e era exactamente esse o
  // caminho do defeito.
  { nome: "projeção simples ligada", projeto: ECRAS, projecao: { racio: 1.5, distancia: 8 }, coordenadas: true },
  { nome: "blend num ecrã curvo", projeto: ECRAS, projetor: BLEND_CURVO, coordenadas: true },
  { nome: "cúpula com anel de projetores", projeto: DOME, coordenadas: true },
  { nome: "cúpula E projeção ao mesmo tempo", projeto: DOME, projecao: { racio: 1.5, distancia: 8 }, coordenadas: true },
  { nome: "o botão do exemplo", exemplo: true }
];

// ------------------------------------------------------------------- correr

const { s, porta } = await servidor();
const ENDERECO = `http://127.0.0.1:${porta}/index.html`;

// O `NODE_PATH` não vale para módulos ESM, por isso um playwright instalado
// fora do projeto (global, ou o do runner) não se encontra sozinho. PLAYWRIGHT
// aponta-lhe o caminho quando for esse o caso.
async function carregarPlaywright() {
  const sitios = [process.env.PLAYWRIGHT, "playwright",
                  "/opt/node22/lib/node_modules/playwright/index.mjs"].filter(Boolean);
  for (const sitio of sitios) {
    try { return await import(sitio); } catch (_) {}
  }
  console.log("Falta o playwright. Instala com `npm i -D playwright`, ou aponta a\n" +
              "variável PLAYWRIGHT ao index.mjs de uma instalação que já exista.");
  process.exit(2);
}
const { chromium, devices } = await carregarPlaywright();
const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM || "/opt/pw-browsers/chromium"
});

let falhas = 0;

// Telemóvel e computador: o defeito chegou por telemóvel, mas era dos dois.
for (const aparelho of [["telemóvel", { ...devices["Pixel 7"] }], ["computador", { viewport: { width: 1440, height: 900 } }]]) {
  for (const caso of CASOS) {
    const ctx = await browser.newContext(aparelho[1]);
    const p = await ctx.newPage();
    const errosDaPagina = [];
    const problemas = [];
    p.on("pageerror", (e) => errosDaPagina.push(e.stack || e.message));

    // Tudo o que mexe na página vai aqui dentro: uma app partida ao ponto de
    // não chegar a desenhar o painel faz falhar um `click` ou um `waitFor`, e
    // isso é um resultado do teste — não é o teste a rebentar.
    try {
    await p.goto(ENDERECO);
    await p.waitForFunction(() => !!document.getElementById("btExemplo"), null, { timeout: 15000 });

    await p.evaluate((c) => {
      localStorage.setItem("mikeapps-sincronizacao-v1", JSON.stringify("ligada"));
      if (c.projeto) localStorage.setItem("mikeapps-projeto-v1", JSON.stringify(c.projeto));
      if (c.projetor) localStorage.setItem("mikeapps-projetor-v1", JSON.stringify(c.projetor));
    }, caso);
    await p.reload();
    await p.waitForFunction(() => !!document.getElementById("btExemplo"), null, { timeout: 15000 });
    await p.waitForTimeout(900);

    // Um projetor guardado NÃO entra sozinho ao arrancar — fica à espera do
    // botão, de propósito. Sem carregar nele, um caso de blend não desenha
    // projetor nenhum e o teste passava sem ter testado nada.
    if (caso.projetor) {
      await p.evaluate(() => document.getElementById("btTrazerProjetor").click());
      await p.waitForTimeout(900);
    }

    if (caso.exemplo) {
      // Pelo evento e não por um clique a sério: o botão vive numa secção
      // dobrada do painel, e dobrar secções não é o que está a ser testado.
      await p.evaluate(() => document.getElementById("btExemplo").click());
      await p.waitForTimeout(900);
    }

    if (caso.projecao) {
      await p.evaluate((pr) => {
        const cb = document.getElementById("projLigada");
        if (cb && !cb.checked) { cb.checked = true; cb.dispatchEvent(new Event("change", { bubbles: true })); }
        for (const [id, v] of [["projRacio", pr.racio], ["projDist", pr.distancia]]) {
          const el = document.getElementById(id);
          if (!el) continue;
          el.value = String(v);
          el.dispatchEvent(new Event("input", { bubbles: true }));
        }
      }, caso.projecao);
      await p.waitForTimeout(900);
    }

    // O carimbo do fim do montar(): mexe-se num campo e vê-se se ele mexe.
    const antes = await p.evaluate(() => (JSON.parse(localStorage.getItem("mikeapps-sala-v1") || "{}").quando) || "");
    await p.evaluate(() => {
      const el = document.getElementById("salaL");
      if (!el) return;
      el.value = String((parseFloat(el.value) || 20) + 1);
      el.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await p.waitForTimeout(900);
    const depois = await p.evaluate(() => (JSON.parse(localStorage.getItem("mikeapps-sala-v1") || "{}").quando) || "");

    const apanhados = await p.evaluate(() => window.__errosDeDesenho || []);
    if (apanhados.length) problemas.push("o montar() rebentou: " + apanhados[0].split("\n").slice(0, 3).join(" | "));
    if (!depois || depois === antes) problemas.push("o montar() não chegou ao fim (o carimbo da sala não mexeu)");

    if (caso.coordenadas) {
      const linhas = await p.evaluate(() => document.querySelectorAll("#coordsTabela tbody tr").length);
      if (!linhas) problemas.push("não foi desenhado projetor nenhum — o caso não chegou a testar o que devia");
    }
    } catch (e) {
      problemas.push("a app não deixou o teste chegar ao fim: " + (e.message || e).split("\n")[0]);
    }
    if (errosDaPagina.length) problemas.push("erro de JavaScript: " + errosDaPagina[0].split("\n").slice(0, 3).join(" | "));

    if (problemas.length) {
      falhas++;
      console.log(`✗ ${aparelho[0]} · ${caso.nome}`);
      problemas.forEach((t) => console.log("    " + t));
    } else {
      console.log(`✓ ${aparelho[0]} · ${caso.nome}`);
    }
    await ctx.close();
  }
}

await browser.close();
s.close();

if (falhas) {
  console.log(`\n${falhas} ${falhas === 1 ? "caso falhou" : "casos falharam"}.`);
  process.exit(1);
}
console.log("\nA cena desenha-se até ao fim em todos os casos.");
