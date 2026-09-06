// Os motores pesados: ler DWG e ler PDF.
//
// Vivem à parte e **só se carregam quando alguém abre um ficheiro desses**. É
// a razão de este ficheiro existir: o motor de DWG são 10 MB de WebAssembly
// (1,6 MB à saída do servidor, que o comprime) e o de PDF quase 2 MB. Pô-los
// no arranque era fazer toda a gente pagar por eles — incluindo quem só quer
// olhar para um ecrã numa sala. Assim, quem nunca abre um DWG nunca os
// descarrega, e quem abre um fica com eles no cache e passa a poder fazê-lo
// sem rede.
//
// LICENÇA: o motor de DWG é o **libredwg**, que é **GPL-3.0** — a cópia da
// licença está em `vendor/dwg/`. O de PDF é o **pdf.js** da Mozilla, Apache-2.0.

import * as THREE from "three";
import { lerDXF } from "./dxf.js";

let motorDWG = null;
let motorPDF = null;

/**
 * O DWG lê-se convertendo-o a DXF.
 *
 * Podia ler-se a base de dados do desenho directamente — o motor devolve uma —
 * mas isso seria escrever um segundo leitor, com as suas próprias armadilhas,
 * ao lado de um que já existe e já está provado. O libredwg sabe escrever DXF;
 * é por aí que se entra, e a partir daí um DWG e um DXF são a mesma coisa.
 */
export async function lerDWG(ficheiro, aoAndar) {
  if (aoAndar) aoAndar("A carregar o motor de DWG… (só da primeira vez)");
  if (!motorDWG) {
    const modulo = await import("../vendor/dwg/dist/libredwg-web.js");
    motorDWG = await modulo.LibreDwg.create("./vendor/dwg/wasm/");
  }

  if (aoAndar) aoAndar("A converter o DWG…");
  const bytes = await ficheiro.arrayBuffer();
  const dxf = motorDWG.dwg_write_dxf(bytes);
  if (!dxf || !dxf.length) {
    throw new Error("O motor abriu o DWG mas não conseguiu convertê-lo. " +
                    "Guarda-o como DXF no CAD e tenta assim.");
  }
  return lerDXF(new TextDecoder().decode(dxf));
}

/**
 * O PDF vira imagem, e daí segue o caminho da planta em imagem.
 *
 * Uma planta em PDF costuma ser vectorial, por isso desenha-se **grande** — a
 * régua com que se calibra é o que lá está escrito, e num desenho esborratado
 * não se lê a barra de escala. Mas continua a ser uma imagem: um PDF não diz a
 * que escala foi impresso, e por isso pede-se a largura real como em qualquer
 * outra.
 */
export async function lerPDF(ficheiro, aoAndar) {
  if (aoAndar) aoAndar("A carregar o motor de PDF… (só da primeira vez)");
  if (!motorPDF) {
    motorPDF = await import("../vendor/pdf/pdf.min.mjs");
    motorPDF.GlobalWorkerOptions.workerSrc = "./vendor/pdf/pdf.worker.min.mjs";
  }

  if (aoAndar) aoAndar("A desenhar o PDF…");
  const bytes = new Uint8Array(await ficheiro.arrayBuffer());
  const documento = await motorPDF.getDocument({ data: bytes }).promise;
  const pagina = await documento.getPage(1);

  // 2400 px do lado maior: mais do que isto começa a custar memória sem se ver
  // diferença; menos, e as cotas do desenho deixam de se ler.
  const natural = pagina.getViewport({ scale: 1 });
  const escala = Math.min(4, 2400 / Math.max(natural.width, natural.height));
  const vista = pagina.getViewport({ scale: escala });

  const tela = document.createElement("canvas");
  tela.width = Math.round(vista.width);
  tela.height = Math.round(vista.height);
  const p = tela.getContext("2d");
  // Um PDF desenha sem fundo, e sem isto ficava preto sobre preto.
  p.fillStyle = "#FFFFFF";
  p.fillRect(0, 0, tela.width, tela.height);
  await pagina.render({ canvasContext: p, viewport: vista }).promise;

  const textura = new THREE.CanvasTexture(tela);
  textura.colorSpace = THREE.SRGBColorSpace;
  textura.needsUpdate = true;
  return { textura, paginas: documento.numPages, largura: tela.width, altura: tela.height };
}
