/**
 * A VOLTA INTEIRA: EXPORTAR A PLANTA E VOLTAR A ABRI-LA AQUI.
 *
 * Reportado com uma fotografia da app com a sua própria planta importada, e
 * uma pergunta: *"abre invertido?"*.
 *
 * Não abria invertido -- medido, o palco vinha do lado certo e com a frente
 * para o lado certo. Vinha **fora do sítio**, 1,82 m para trás e 0,67 m para
 * o lado, e com um desenho a mais deitado no chão à frente da plateia, que é
 * o que se lê como "invertido": o ficheiro leva DOIS desenhos, a planta e o
 * alçado frontal por baixo dela, e o alçado entrava como se fosse planta.
 *
 * Duas coisas estavam por trás disso, e as duas eram minhas:
 *
 *   1. o alçado partilhava as camadas da planta (PALCO, ECRAS…), e estava
 *      escrito no código que era de propósito. Não se podia desligar -- nem
 *      aqui, nem no Vectorworks de quem confere;
 *   2. o desenho era centrado pela caixa de TUDO o que o ficheiro tem, camadas
 *      apagadas incluídas. Com o alçado lá dentro, o meio do papel deixa de
 *      ser o meio da sala.
 *
 * O que este teste guarda é a volta completa, medida no que a app DESENHA na
 * cena -- não no que o ficheiro diz, nem numa cópia da conta escrita aqui.
 *
 *   node scripts/verificar-planta-de-volta.mjs
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

const SALA = { largura: 20, profundidade: 14 };
const PALCO = { largura: 8, profundidade: 4, dx: 3 };

const { s, porta } = await servidor();
const { chromium } = await carregarPlaywright();
const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM || "/opt/pw-browsers/chromium"
});
const ctx = await browser.newContext({ viewport: { width: 1400, height: 950 }, serviceWorkers: "block" });

let falhas = 0;
const conferir = (ok, texto) => { console.log((ok ? "  ✓ " : "  ✗ ") + texto); if (!ok) falhas++; };
const perto = (a, b, folga) => Math.abs(a - b) <= folga;

const pagina = await ctx.newPage();
const erros = [];
pagina.on("pageerror", (e) => erros.push(e.message));
await pagina.goto(`http://127.0.0.1:${porta}/index.html`, { waitUntil: "networkidle" });
await pagina.waitForFunction(() => window.preview && window.preview.montar, null, { timeout: 30000 });
await pagina.waitForTimeout(1200);

// O QUE A APP DESENHOU, em coordenadas da sala. Lê-se do buffer que foi para o
// ecrã: é o desenho a sério, depois de escala, centragem e deslocamento.
const desenhado = () => pagina.evaluate(() => {
  const pontos = [];
  window.preview.desenhado.traverse((o) => {
    if (o.name !== "planta-cad" || !o.geometry) return;
    const p = o.geometry.getAttribute("position");
    if (!p) return;
    const m = o.parent ? o.parent.matrixWorld : null;
    for (let i = 0; i < p.count; i++) {
      const v = new window.preview.THREE.Vector3(p.getX(i), p.getY(i), p.getZ(i));
      if (m) v.applyMatrix4(m);
      pontos.push([+v.x.toFixed(3), +v.z.toFixed(3)]);
    }
  });
  return pontos;
});
const caixa = (pontos) => {
  if (!pontos.length) return null;
  const xs = pontos.map((p) => p[0]), zs = pontos.map((p) => p[1]);
  return { minX: Math.min(...xs), maxX: Math.max(...xs),
           minZ: Math.min(...zs), maxZ: Math.max(...zs) };
};
const camada = (nome, ligar) => pagina.evaluate(async ([nome, ligar]) => {
  const linha = [...document.querySelectorAll("#listaCamadas .camada")]
    .find((l) => l.querySelector(".nome").textContent === nome);
  if (!linha) return false;
  const ver = linha.querySelectorAll("input")[0];
  if (ver.checked !== ligar) ver.click();
  await new Promise((r) => setTimeout(r, 900));
  return true;
}, [nome, ligar]);

// ---- 1. Uma sala com o palco DESCENTRADO ------------------------------
//
// Descentrado de propósito: com o palco no meio, um desenho espelhado e um
// desenho certo dão o mesmo, e o teste não sabia distinguir um do outro.
console.log(`\n== sala ${SALA.largura} × ${SALA.profundidade}, palco de ${PALCO.largura} m a ${PALCO.dx} m do meio ==`);
const naCena = await pagina.evaluate(async ([sala, palco]) => {
  const por = (id, v) => {
    const el = document.getElementById(id);
    if (!el) return;
    if (el.type === "checkbox") el.checked = !!v; else el.value = String(v);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  };
  por("salaL", sala.largura); por("salaP", sala.profundidade); por("salaA", 7);
  por("palcoL", palco.largura); por("palcoP", palco.profundidade);
  por("palcoA", 1); por("palcoX", palco.dx); por("verPalco", true);
  por("verPublico", true); por("filas", 8);
  document.getElementById("colagem").value = JSON.stringify({
    nome: "Volta", zonas: [{ nome: "LED", w: 6, h: 3.4 }]
  });
  document.getElementById("btCarregar").click();
  await new Promise((r) => setTimeout(r, 2200));
  const frente = window.preview.frenteDoPalco(sala, { ...palco, dz: 0 });
  return { frenteX: frente.x, frenteZ: frente.z,
           centroZ: frente.z - palco.profundidade / 2 };
}, [SALA, PALCO]);
console.log(`   o palco está centrado em x = ${naCena.frenteX} · z = ${naCena.centroZ.toFixed(2)}`);

// ---- 2. Exportar e voltar a abrir -------------------------------------
const dxf = await pagina.evaluate(() => window.preview.plantaEmDXF());
console.log("\n== exportar a planta e abri-la aqui outra vez ==");
const voltou = await pagina.evaluate(async (texto) => {
  const dt = new DataTransfer();
  dt.items.add(new File([texto], "planta.dxf", { type: "application/dxf" }));
  const input = document.getElementById("ficheiroPlanta");
  input.files = dt.files;
  input.dispatchEvent(new Event("change", { bubbles: true }));
  await new Promise((r) => setTimeout(r, 2200));
  const linhas = [...document.querySelectorAll("#listaCamadas .camada")].map((l) => ({
    nome: l.querySelector(".nome").textContent,
    visivel: l.querySelectorAll("input")[0].checked
  }));
  return { linhas, nota: document.getElementById("notaPlanta").textContent };
}, dxf);
console.log("   camadas: " + voltou.linhas.map((l) => l.nome + (l.visivel ? "" : " (desligada)")).join(", "));

const doAlcado = voltou.linhas.filter((l) => /^ALCADO-/.test(l.nome));
conferir(doAlcado.length > 0,
  "o alçado tem camadas próprias — antes partilhava-as com a planta e não se podia desligar");
conferir(doAlcado.length > 0 && doAlcado.every((l) => !l.visivel),
  "e entra desligado: um alçado deitado no chão não é planta de nada");
conferir(/alçado/i.test(voltou.nota) && /desligad/i.test(voltou.nota),
  "e a app diz que o desligou — escondê-lo em silêncio era pior");

// ---- 3. O DESENHO CAI EM CIMA DA SALA ----------------------------------
//
// Com as cotas desligadas, o contorno do desenho É o rectângulo da sala: tudo
// o resto da planta vive lá dentro. Se a centragem estiver certa, a caixa do
// que está desenhado tem de ser a da sala, ao centímetro.
await camada("COTAS", false);
const comPlanta = caixa(await desenhado());
console.log("\n== onde é que o desenho caiu ==");
console.log(`   desenhado: X ${comPlanta.minX.toFixed(2)}..${comPlanta.maxX.toFixed(2)} · ` +
            `Z ${comPlanta.minZ.toFixed(2)}..${comPlanta.maxZ.toFixed(2)}`);
console.log(`   a sala:    X ${(-SALA.largura / 2).toFixed(2)}..${(SALA.largura / 2).toFixed(2)} · ` +
            `Z ${(-SALA.profundidade / 2).toFixed(2)}..${(SALA.profundidade / 2).toFixed(2)}`);
conferir(perto(comPlanta.minX, -SALA.largura / 2, 0.02) && perto(comPlanta.maxX, SALA.largura / 2, 0.02),
  "o desenho assenta na largura da sala");
conferir(perto(comPlanta.minZ, -SALA.profundidade / 2, 0.02) && perto(comPlanta.maxZ, SALA.profundidade / 2, 0.02),
  "e no fundo da sala — sem o alçado a puxar o centro para fora");

// ---- 4. E O PALCO ESTÁ ONDE O PALCO ESTÁ -------------------------------
//
// Por diferença: desliga-se a camada do palco e o que desapareceu do desenho
// era o palco. Mede-se o que a app desenhou, não o que o ficheiro diz.
const antesDeTirar = await desenhado();
await camada("PALCO", false);
const semPalco = new Set((await desenhado()).map((p) => p.join(",")));
const soPalco = caixa(antesDeTirar.filter((p) => !semPalco.has(p.join(","))));
await camada("PALCO", true);

console.log("\n== o palco, no desenho importado ==");
const centroX = (soPalco.minX + soPalco.maxX) / 2;
const centroZ = (soPalco.minZ + soPalco.maxZ) / 2;
console.log(`   centro x = ${centroX.toFixed(2)} · z = ${centroZ.toFixed(2)}  ` +
            `(na cena: x = ${naCena.frenteX} · z = ${naCena.centroZ.toFixed(2)})`);
console.log(`   medida ${(soPalco.maxX - soPalco.minX).toFixed(2)} × ` +
            `${(soPalco.maxZ - soPalco.minZ).toFixed(2)} m (na cena: ` +
            `${PALCO.largura} × ${PALCO.profundidade})`);
conferir(perto(centroX, naCena.frenteX, 0.02),
  "está do lado certo — e o lado prova que o desenho não vem espelhado");
conferir(perto(centroZ, naCena.centroZ, 0.02),
  "e à distância certa da parede do fundo (era aqui que falhava por 1,82 m)");
conferir(perto(soPalco.maxX - soPalco.minX, PALCO.largura, 0.02) &&
         perto(soPalco.maxZ - soPalco.minZ, PALCO.profundidade, 0.02),
  "com a medida certa — o DXF vale como conferência");

// ---- 5. O alçado não se perdeu, só está desligado ----------------------
console.log("\n== e o alçado, se o ligarmos ==");
await camada("ALCADO-PALCO", true);
const comAlcado = caixa(await desenhado());
console.log(`   Z ${comAlcado.minZ.toFixed(2)}..${comAlcado.maxZ.toFixed(2)}`);
conferir(comAlcado.maxZ > comPlanta.maxZ + 1,
  "aparece, e fora da sala — está lá inteiro, é só não vir ligado");

conferir(erros.length === 0, erros.length ? "erro de JavaScript: " + erros[0] : "sem erros de JavaScript");

await browser.close();
s.close();
console.log("\n" + (falhas ? falhas + " FALHA(S)"
  : "A planta exportada volta a entrar em cima da sala, e o alçado fica para quem o quiser."));
process.exit(falhas ? 1 : 0);
