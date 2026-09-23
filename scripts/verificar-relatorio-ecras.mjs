/**
 * A FOLHA DE MONTAGEM PASSA A LEVAR O QUADRO DOS ECRÃS.
 *
 * Pedido a olhar para uma folha já gerada, com as duas apps e o switcher
 * abertos ao lado: *"podemos exportar assim com as medidas e pixel pitch,
 * resolução dos ecrãs, em separado e total? ou seja, incluir o relatório de
 * equipamentos aqui"*.
 *
 * Até aqui a folha levava a sala, a cúpula, a projeção e os ajustes — e nada
 * sobre os ecrãs, que num projeto de ecrãs são o trabalho todo. Quem a recebia
 * tinha de ir aos Calculadores buscar as medidas outra vez.
 *
 * O que este teste guarda:
 *
 *   1. cada ecrã leva MEDIDA, ÁREA, TILES, RESOLUÇÃO e PITCH, e os números
 *      batem com a geometria — o pitch é medida real a dividir por píxeis
 *      reais, não um número de catálogo escrito à mão;
 *   2. o TOTAL soma o que tem de somar (área, tiles, píxeis, peso, amps);
 *   3. um ecrã SEM resolução ou SEM peso não entra no total como zero, e a
 *      folha diz que ficou de fora. Um zero somado seria dizer que não pesa;
 *   4. o pitch ASSIMÉTRICO sai com os dois números — é o que distingue um
 *      painel transparente, e escrever só um seria escrever o errado;
 *   5. o que está no DEPÓSITO não entra no total, e o subtítulo di-lo.
 *
 *   node scripts/verificar-relatorio-ecras.mjs
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

// Quatro ecrãs escolhidos para cada um provar uma coisa diferente. As medidas
// e as resoluções são coerentes entre si de propósito: 8,00 m / 2048 px dá
// 3,906 mm, que é o pitch de um tile de 500 mm com 128 px — o painel real.
const PROJETO = {
  nome: "Folha de equipamento",
  sala: { largura: 20, profundidade: 14, altura: 7 },
  zonas: [
    // Simétrico: 4 × 2 tiles de 500 mm, 128 px por tile → 3,91 mm nos dois eixos.
    { nome: "Ecrã principal", x: -6, y: 1.5, w: 2.0, h: 1.0,
      tiles: { x: 4, y: 2 }, res: { x: 512, y: 256 }, peso: 24, amp: 2.28, tipo: "led" },
    // ASSIMÉTRICO: 128 × 64 px num tile de 500 mm → 3,91 × 7,81 mm. É o
    // transparente, e é o caso em que um número só seria o número errado.
    { nome: "Transparente", x: 0, y: 1.5, w: 1.0, h: 0.5,
      tiles: { x: 2, y: 1 }, res: { x: 256, y: 64 }, peso: 7.5, amp: 1.82, tipo: "led" },
    // SEM RESOLUÇÃO conhecida (uma saída de delay) — não pode somar zero.
    { nome: "Delay sem res", x: 4, y: 1.5, w: 1.5, h: 0.9,
      tiles: null, res: null, peso: 12, amp: 0.8, tipo: "tv" },
    // SEM PESO no catálogo — idem.
    { nome: "Sem peso", x: 7, y: 1.5, w: 1.0, h: 1.0,
      tiles: { x: 2, y: 2 }, res: { x: 256, y: 256 }, peso: null, amp: 0.5, tipo: "led" }
  ]
};

const { s, porta } = await servidor();
const { chromium } = await carregarPlaywright();
const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM || "/opt/pw-browsers/chromium"
});
const ctx = await browser.newContext({ viewport: { width: 1400, height: 950 }, serviceWorkers: "block", acceptDownloads: true });

let falhas = 0;
const conferir = (ok, texto) => { console.log((ok ? "  ✓ " : "  ✗ ") + texto); if (!ok) falhas++; };

const pagina = await ctx.newPage();
const erros = [];
pagina.on("pageerror", (e) => erros.push(e.message));
await pagina.goto(`http://127.0.0.1:${porta}/index.html`, { waitUntil: "networkidle" });
await pagina.waitForFunction(() => window.preview && window.preview.montar, null, { timeout: 30000 });
await pagina.waitForTimeout(1200);

// Carrega-se o projeto pelo caminho normal da app (a caixa de colagem), para o
// que se mede ser o que ela faz a sério e não um objeto montado à mão.
await pagina.evaluate(async (p) => {
  const caixa = document.getElementById("colagem");
  caixa.value = JSON.stringify(p);
  caixa.dispatchEvent(new Event("input", { bubbles: true }));
  document.getElementById("btCarregar").click();
  await new Promise((r) => setTimeout(r, 2200));
}, PROJETO);

// A tabela sai da mesma função que a folha usa. Lê-se o HTML dela e mede-se o
// que lá está escrito — não uma cópia da conta repetida aqui.
// As colunas leem-se PELO NOME DO CABEÇALHO, não pela posição. A primeira
// versão deste teste usava índices fixos e partiu-se toda mal a área desceu
// para dentro da célula da medida — dez cruzes a apontar para números que
// estavam certos. E a coluna "Tipo" é opcional de propósito (só aparece com
// ecrãs de tipos diferentes), por isso a posição nem é sempre a mesma.
const quadro = () => pagina.evaluate(() => {
  const html = window.preview.tabelaDeEcras(window.preview.zonasMontadas(window.preview.projeto));
  const caixa = document.createElement("div");
  caixa.innerHTML = html;
  const limpo = (e) => e.textContent.replace(/\s+/g, " ").trim();
  const nomes = [...caixa.querySelectorAll("thead th")].map((th) => limpo(th).toLowerCase());
  const porNome = (tr) => {
    const tds = [...tr.querySelectorAll("td")];
    const linha = {};
    nomes.forEach((n, i) => { if (tds[i]) linha[n] = limpo(tds[i]); });
    linha._ordem = tds.map(limpo);
    return linha;
  };
  return {
    html, colunas: nomes,
    linhas: [...caixa.querySelectorAll("tbody tr")].map(porNome),
    total: [...caixa.querySelectorAll("tfoot tr")].map(porNome)[0] || {},
    rodape: (caixa.querySelector(".nota-fonte") || {}).textContent || ""
  };
});

// O nome da coluna tal como o cabeçalho a escreve (a da medida diz
// "Medida · área", e a do pitch é só "Pitch").
const col = (linha, parte) => {
  const chave = Object.keys(linha).find((k) => k !== "_ordem" && k.includes(parte));
  return chave ? linha[chave] : undefined;
};

const q = await quadro();
console.log("\n== o quadro, ecrã a ecrã ==");
console.log("   colunas: " + q.colunas.join(" · "));
q.linhas.forEach((l) => console.log("   " + l._ordem.join("  |  ")));
console.log("   TOTAL: " + (q.total._ordem || []).join("  |  "));

conferir(q.linhas.length === 4, "os quatro ecrãs estão no quadro (" + q.linhas.length + ")");

// ---- 1. MEDIDA, ÁREA E PITCH batem com a geometria --------------------
console.log("\n== os números batem com a geometria ==");
const principal = q.linhas.find((l) => col(l, "ecrã").includes("Ecrã principal"));
const medida = col(principal, "medida");
conferir(medida.includes("2,00 × 1,00 m"), "medida: " + medida);
conferir(medida.includes("2,00 m²"), "área, na mesma célula: " + medida + " (2,00 × 1,00)");
conferir(col(principal, "tiles").startsWith("4 × 2"), "tiles: " + col(principal, "tiles"));
conferir(col(principal, "resolução") === "512 × 256", "resolução: " + col(principal, "resolução"));
// 2,00 m = 2000 mm; 2000 / 512 = 3,90625 → 3,91
conferir(col(principal, "pitch") === "3,91", "pitch: " + col(principal, "pitch") + " mm — 2000 mm / 512 px");

// ---- 2. O PITCH ASSIMÉTRICO sai com os DOIS números -------------------
console.log("\n== o pitch assimétrico ==");
const transp = q.linhas.find((l) => col(l, "ecrã").includes("Transparente"));
// 1000 mm / 256 px = 3,91 · 500 mm / 64 px = 7,81
conferir(col(transp, "pitch") === "3,91 × 7,81",
  "pitch: " + col(transp, "pitch") + " — os dois eixos, que é o que faz dele transparente");

// ---- 3. O TOTAL soma o que tem de somar -------------------------------
console.log("\n== o total ==");
// 2,00 + 0,50 + 1,35 + 1,00 = 4,85 m²
conferir(col(q.total, "medida").includes("4,85"), "área total: " + col(q.total, "medida") + " (2,00+0,50+1,35+1,00)");
// 8 + 2 + 0 + 4 = 14 tiles
conferir(col(q.total, "tiles").includes("14"), "tiles no total: " + col(q.total, "tiles"));
// 131072 + 16384 + 65536 = 212 992 px (o delay sem resolução não entra)
conferir(/212\D?992/.test(col(q.total, "resolução")), "píxeis no total: " + col(q.total, "resolução"));
// 24 + 7,5 + 12 = 43,5 kg (o "Sem peso" não entra)
conferir(col(q.total, "peso").includes("43,50"), "peso no total: " + col(q.total, "peso"));
// 2,28 + 1,82 + 0,8 + 0,5 = 5,40 A
conferir(col(q.total, "consumo").includes("5,40"), "consumo no total: " + col(q.total, "consumo"));

// ---- 4. O QUE NÃO SE SABE não entra como zero, e DIZ-SE ---------------
console.log("\n== o que não se sabe ==");
const delay = q.linhas.find((l) => col(l, "ecrã").includes("Delay"));
const semPeso = q.linhas.find((l) => col(l, "ecrã").includes("Sem peso"));
conferir(col(delay, "resolução") === "—" && col(delay, "pitch") === "—",
  "o delay sem resolução leva «—» na resolução e no pitch, não um zero");
conferir(col(semPeso, "peso") === "—", "e o ecrã sem peso leva «—» no peso");
console.log("   " + q.rodape.slice(0, 160));
conferir(/resolução conhecida/i.test(q.rodape) && /peso/i.test(q.rodape),
  "o rodapé diz que ambos ficaram de fora do total — somar zero era dizer que não pesam");

// ---- 5. O DEPÓSITO não entra no total ---------------------------------
//
// É a diferença entre "o que está na sala" e "o que sai do armazém". Somar as
// duas coisas no mesmo total não seria nem uma nem outra.
console.log("\n== uma peça no depósito ==");
const antesArea = col(q.total, "medida");
const mandado = await pagina.evaluate(async () => {
  const alvo = window.preview.projeto.zonas.find((z) => z.nome === "Ecrã principal");
  if (!alvo || !window.preview.enviarParaDeposito || !window.preview.chaveDeDeposito) return "sem porta de serviço";
  window.preview.enviarParaDeposito(window.preview.chaveDeDeposito(alvo));
  await new Promise((r) => setTimeout(r, 1400));
  return "ok";
});
if (mandado === "ok") {
  const depois = await quadro();
  console.log("   área total: " + antesArea + " → " + col(depois.total, "medida"));
  conferir(depois.linhas.length === 3, "o ecrã mandado para o depósito saiu do quadro");
  conferir(col(depois.total, "medida").includes("2,85"),
    "e o total desceu para 2,85 m² — 4,85 menos os 2,00 dele");
} else {
  console.log("   – " + mandado + "; salta-se esta parte");
}

// ---- 6. E a folha a sério leva a secção -------------------------------
//
// Pelo caminho a sério: carrega-se no botão e lê-se o ficheiro que sai. Uma
// porta de serviço que gerasse o HTML à parte podia passar enquanto o botão
// que ele usa ficava a dar a folha antiga.
console.log("\n== a folha que o botão descarrega ==");
// Dois cliques e não um: o botão "Relatório (página)" só ESCOLHE o formato —
// quem exporta é o "Guardar". A primeira versão deste teste carregava só no
// primeiro e ficava à espera de uma descarga que nunca vinha. O erro era meu,
// não da app.
await pagina.evaluate(() => document.querySelector('[data-saida="relatorio"]').click());
await pagina.waitForTimeout(300);
const descarga = await Promise.all([
  pagina.waitForEvent("download", { timeout: 30000 }),
  pagina.evaluate(() => document.getElementById("btGuardar").click())
]).then(([d]) => d);
const folha = await readFile(await descarga.path(), "utf8");
console.log("   " + (await descarga.suggestedFilename()) + " · " + folha.length + " bytes");
conferir(/<h2>Ecrãs<\/h2>/.test(folha), "a folha tem a secção «Ecrãs»");
conferir(/Medidas, pitch e resolução/.test(folha), "com o subtítulo a dizer o que lá está");
conferir(/1 por montar|há 1 por montar/.test(folha),
  "e avisa que o total não conta o ecrã que está por montar");
conferir(/3,91 × 7,81/.test(folha), "e o pitch assimétrico chegou à folha com os dois números");

conferir(erros.length === 0, erros.length ? "erro de JavaScript: " + erros[0] : "sem erros de JavaScript");

await browser.close();
s.close();
console.log("\n" + (falhas ? falhas + " FALHA(S)"
  : "A folha leva os ecrãs: medidas, pitch e resolução, em separado e em total."));
process.exit(falhas ? 1 : 0);
