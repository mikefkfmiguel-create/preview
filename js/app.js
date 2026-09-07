// Preview — ver um projeto dos Calculadores montado numa sala.

import * as THREE from "three";
import { OrbitControls } from "../vendor/OrbitControls.js";
import { EXEMPLO, lerProjeto, totais, projetoDoEndereco,
         projetoGuardado, guardarSala, projetorGuardado, projetorDoEndereco,
         CHAVE_PROJETO, CHAVE_PROJETOR, CHAVE_BRIEFING } from "./projeto.js";
import { fazerCena, fazerSala, fazerPalco, fazerZonas, fazerFigura, fazerPublico,
         padraoDeTeste, texturaDeFicheiro, fazerProjecao, pontosDaImagem,
         fazerPlanta, fazerPlantaCad, fazerRegie } from "./cena.js";
import { lerDXF, metrosPorUnidade } from "./dxf.js";
import { lerDWG, lerPDF } from "./importar.js";
import { analisar, doQueVeioParaCa, quantosEcras, gruposDeEcras } from "./assistente.js";
import { prepararParaExportar, comoGLB, comoOBJ, descarregar, pesar } from "./exportar.js";

const $ = (id) => document.getElementById(id);
const tela = $("tela");

// preserveDrawingBuffer: sem isto o browser pode limpar o canvas antes de o
// copiarmos, e a imagem guardada sai preta.
const renderizador = new THREE.WebGLRenderer({ canvas: tela, antialias: true,
                                              preserveDrawingBuffer: true });
renderizador.setPixelRatio(Math.min(devicePixelRatio, 2));

const camara = new THREE.PerspectiveCamera(52, 1, 0.05, 400);
const cena = fazerCena();
const controlos = new OrbitControls(camara, tela);
controlos.enableDamping = true;
controlos.dampingFactor = 0.08;
// Nada de limitar o ângulo: um espectador sentado olha PARA CIMA, e um limite
// de "nunca abaixo do alvo" empurrava a câmara da vista dos olhos para os 3,5 m
// de altura -- ou seja, dava a vista de quem está de pé num primeiro andar.
// Quem impede de furar o chão é o travão de altura no laço, mais abaixo.

let projeto = null;
let etiquetas = [];
let olhosDaPlateia = null;
let desenhado = null;      // o que está na cena agora, para se poder deitar fora
let textura = null;        // o conteúdo a mostrar nos ecrãs, se houver
let modoConteudo = "espalhado";   // espalhado pelo conjunto, ou um em cada zona
let planta = null;         // a planta em imagem, se alguem a tiver aberto
let plantaCad = null;      // a planta em DXF, que ja vem a escala
const camadasEscondidas = new Set();   // camadas da planta que nao se veem
const camadasLevantadas = new Set();   // camadas que sobem do chao, como paredes
let projecaoAtual = null;  // a lente e a imagem de agora, para medir a sombra
let ondeEsta = null;       // onde o orador foi posto à mão, se foi
let corposDoPublico = null;// uma caixa por pessoa, para a sombra
let limitesDoShift = null; // até onde a lente escolhida faz shift, se se souber

// ------------------------------------------------------------------ leituras

const num = (id) => parseFloat($(id).value) || 0;

function lerSala() {
  return { largura: num("salaL"), profundidade: num("salaP"), altura: num("salaA") };
}
function lerPalco() {
  return { largura: num("palcoL"), altura: num("palcoA"),
           profundidade: num("palcoP"), acimaDoPalco: num("ecraOffset") };
}
let formatoImagem = 1.777;

function lerProjecao() {
  return {
    ligada: $("projLigada").checked,
    racio: num("projRacio"),
    distancia: num("projDist"),
    altura: num("projAltura"),
    lateral: num("projLateral"),
    // O shift conta-se em percentagem da IMAGEM, como nas fichas das lentes:
    // +100% vertical poe a imagem toda acima do eixo da lente.
    shiftV: num("projShiftV") / 100,
    shiftH: num("projShiftH") / 100
  };
}

function lerPublico() {
  return {
    filas: Math.round(num("filas")),
    primeiraFila: num("primeiraFila"),
    entreFilas: num("entreFilas"),
    entreLugares: num("entreLugares"),
    corredores: Math.round(num("corredores")),
    inclinacao: num("inclinacao"),
    larguraCorredor: num("larguraCorredor"),
    sentado: $("sentado").checked
  };
}

function lerRegie() {
  return {
    largura: Math.max(2, num("regieL") || 2),
    profundidade: Math.max(2, num("regieP") || 2),
    x: num("regieX"), z: num("regieZ"),
    rodar: num("regieR")
  };
}

// Em que degrau do auditório cai a régie, dada a profundidade a que ela está.
// É a mesma conta que fazerPublico faz fila a fila (zPrimeira + f*entreFilas),
// só que ao contrário: dada uma profundidade, que fila é essa. Sem isto a
// régie ficava sempre ao nível do chão, e num auditório a subir isso é ficar
// meio enterrada dentro do degrau em vez de assentar em cima dele.
//
// O tecto da fila não é só o número pedido no campo "filas" -- fazerPublico
// pára mais cedo se a sala não tiver profundidade para todas (a mesma margem
// dos corredores lá atrás). Usar só publico.filas-1 aqui dava um degrau a
// mais nesse caso: a régie subia para uma fila que nem chega a ser desenhada.
function elevacaoDaRegie(sala, palco, publico, z) {
  if (!publico.filas || !publico.inclinacao) return 0;
  const margemLateral = publico.larguraCorredor || 1.2;
  const zPrimeira = -sala.profundidade / 2 + palco.profundidade + publico.primeiraFila;
  const zUltimaPossivel = sala.profundidade / 2 - margemLateral;
  const ultimaFilaQueCabe = Math.max(0, Math.floor((zUltimaPossivel - zPrimeira) / publico.entreFilas));
  const tecto = Math.min(publico.filas - 1, ultimaFilaQueCabe);
  const fila = Math.round((z - zPrimeira) / publico.entreFilas);
  const filaLimitada = Math.max(0, Math.min(tecto, fila));
  return filaLimitada * publico.inclinacao;
}

// -------------------------------------------------------------------- montar

function limpar(grupo) {
  grupo.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m.dispose());
  });
  cena.remove(grupo);
}

function montar(recentrarCamara) {
  // O aviso apaga-se sempre no princípio e volta a escrever-se quem tiver
  // razão para isso. Antes a limpeza vivia dentro da verificação que só corre
  // com um projeto carregado: sem zonas, um aviso antigo ficava para sempre no
  // ecrã, a falar de filas que já ninguém tinha pedido.
  $("aviso").classList.remove("mostra");
  if (desenhado) limpar(desenhado);
  desenhado = new THREE.Group();
  etiquetas = [];
  olhosDaPlateia = null;

  const sala = lerSala();
  const palco = lerPalco();
  const publico = lerPublico();

  desenhado.add(fazerSala(sala, $("verMedidas").checked, $("verParedes").checked));
  const verPlanta = $("verPlanta").checked;
  if (plantaCad && verPlanta) {
    desenhado.add(fazerPlantaCad(plantaCad, {
      fator: metrosPorUnidade(plantaCad, $("plantaU").value).fator,
      rodar: num("plantaR"), x: num("plantaX"), z: num("plantaZ"),
      opacidade: Math.min(1, Math.max(0.05, num("plantaO"))),
      escondidas: camadasEscondidas,
      levantadas: camadasLevantadas,
      altura: num("alturaParedes")
    }));
  }
  if (planta && verPlanta) {
    desenhado.add(fazerPlanta(planta, {
      largura: num("plantaL"), rodar: num("plantaR"),
      x: num("plantaX"), z: num("plantaZ"),
      opacidade: Math.min(1, Math.max(0.05, num("plantaO")))
    }));
  }
  // O palco desliga-se como o resto: numa sala onde o ecrã assenta no chão, o
  // palco por omissão é uma caixa a mentir sobre a altura de tudo o que está
  // em cima dela.
  if ($("verPalco").checked) desenhado.add(fazerPalco(sala, palco));

  // A régie entra ANTES do público, porque é o público que precisa de saber
  // onde ela está para lhe deixar o vão. Isto ia ficar reservado mesmo com a
  // régie escondida — parecia mais correcto, "o espaço existe sempre" — mas
  // na prática ninguém consegue comparar "com" e "sem" régie assim: o
  // interruptor tem de ser um interruptor a sério, como todos os outros
  // desta lista, e não uma opção que só esconde o desenho.
  const verRegie = $("verRegie").checked;
  const regie = verRegie ? lerRegie() : null;
  if (regie) {
    regie.elevacao = elevacaoDaRegie(sala, palco, publico, regie.z);
    desenhado.add(fazerRegie(sala, regie));
  }

  // Os interruptores existem porque cada vista serve uma pergunta diferente:
  // sem paredes vê-se a sala de fora, sem público vê-se a estrutura, e sem
  // ninguém no palco mede-se o ecrã sem nada a tapá-lo.
  const gente = $("verPublico").checked
    ? fazerPublico(sala, palco, publico, regie)
    : { grupo: new THREE.Group(), olhos: null, lugares: 0, filas: 0, porFila: 0, blocos: 1 };
  desenhado.add(gente.grupo);
  olhosDaPlateia = gente.olhos;
  corposDoPublico = gente;

  let medidas = null;
  if (projeto) {
    medidas = totais(projeto);
    // Os ecrãs também se desligam: para olhar para a sala sem eles, ou para os
    // tirar da frente da planta que se está a acertar por baixo.
    const zonas = fazerZonas(projeto, medidas, sala, palco, textura, modoConteudo);
    if ($("verEcras").checked) desenhado.add(zonas.grupo);
    etiquetas = ($("verMedidas").checked && $("verEcras").checked) ? zonas.etiquetas : [];


    avisarSeNaoCabe(medidas, sala, palco);
  }

  // Uma pessoa no palco, que é o que dá a medida a tudo o resto. Fica FORA do
  // "se houver projeto": sem zonas nenhumas ela é ainda mais precisa, porque é
  // a única coisa na cena com um tamanho que toda a gente conhece.
  const figura = $("verOrador").checked ? fazerFigura(1.75) : null;
  const larguraPalco = Math.min(palco.largura || sala.largura, sala.largura);
  const noPalco = palco.altura > 0 && palco.profundidade > 0;
  const limite = (noPalco ? larguraPalco : sala.largura) / 2 - 0.7;
  const x = -(medidas ? Math.min(limite, medidas.largura / 2 + 1.2) : limite * 0.55);
  if (figura) {
    figura.position.set(
      ondeEsta ? ondeEsta.x : x,
      noPalco ? palco.altura : 0,
      ondeEsta ? ondeEsta.z
        : (noPalco
            ? -sala.profundidade / 2 + palco.profundidade - 0.8   // à boca de cena
            : -sala.profundidade / 2 + 1.6));
    desenhado.add(figura);
  }

  desenharProjecao(sala, palco);

  // Pedir 12 filas e receber 6 sem ninguém dizer nada é a maneira certa de
  // levar um número errado para uma reunião. Mas com o público DESLIGADO não
  // cabem zero de dez, e dizer isso é só ruído: o que ali não está é porque
  // alguém o mandou embora.
  if ($("verPublico").checked && publico.filas && gente.filas < publico.filas) {
    const aviso = $("aviso");
    const jaTem = aviso.classList.contains("mostra") ? aviso.textContent + " " : "";
    aviso.textContent = jaTem + `Só cabem ${gente.filas} das ${publico.filas} filas: ` +
      `a sala acaba antes.`;
    aviso.classList.add("mostra");
  }

  cena.add(desenhado);
  if (document.activeElement !== $("ecraL") && document.activeElement !== $("ecraA")) {
    escreverTamanhoDoEcra();
  }
  guardarSala({
    largura: sala.largura, profundidade: sala.profundidade, altura: sala.altura,
    palco: { largura: palco.largura, altura: palco.altura, profundidade: palco.profundidade },
    publico: {
      filas: gente.filas, porFila: gente.porFila, lugares: gente.lugares,
      corredores: publico.corredores, inclinacao: publico.inclinacao,
      tipo: publico.inclinacao > 0.005 ? "auditorio" : "pavilhao",
      // do plano do ecrã ao primeiro e ao último espectador
      primeiroEspectador: gente.zPrimeira != null
        ? +(gente.zPrimeira - (-sala.profundidade / 2 + 0.35)).toFixed(2) : null,
      ultimoEspectador: gente.zUltima != null
        ? +(gente.zUltima - (-sala.profundidade / 2 + 0.35)).toFixed(2) : null,
      larguraPlateia: gente.larguraSentada != null ? +gente.larguraSentada.toFixed(2) : null
    }
  });
  escreverPainel(medidas, gente.lugares, gente);
  if (recentrarCamara) vista("frente");
}

/**
 * A projeção. O tamanho da imagem não se escreve, calcula-se: um projetor de
 * rácio 1,4 a 12 m faz 8,57 m de largura. E depois pergunta-se a coisa que
 * ninguém consegue responder olhando para uma folha: quem é que lhe passa à
 * frente.
 */
function desenharProjecao(sala, palco) {
  const p = lerProjecao();
  projecaoAtual = null;
  $("resumoProj").textContent = "—";
  if (!p.ligada || !p.racio || !p.distancia) return;

  const largura = p.distancia / p.racio;
  const altura = largura / formatoImagem;
  const z0 = -sala.profundidade / 2 + 0.35;

  // Onde a imagem cai nao se escreve: sai da lente e do shift dela. Era isto
  // que faltava -- com a base escrita a mao, o desenho mostrava imagens que
  // nenhuma lente conseguia por ali.
  const projetor = { x: p.lateral, y: p.altura, z: z0 + p.distancia };
  const imagem = {
    x: projetor.x + p.shiftH * largura,
    y: projetor.y + p.shiftV * altura,
    z: z0, largura, altura
  };

  desenhado.add(fazerProjecao(projetor, imagem, textura));
  projecaoAtual = {
    projetor, imagem,
    base: imagem.y - altura / 2,
    foraDaSala: largura > sala.largura ||
                imagem.y + altura / 2 > sala.altura ||
                imagem.y - altura / 2 < -0.01 ||
                Math.abs(imagem.x) + largura / 2 > sala.largura / 2
  };
  medirSombra();
}

/**
 * Quem tapa a imagem. Atiram-se raios da lente para 45 pontos da tela e
 * conta-se quantos batem na figura pelo caminho.
 *
 * Vive à parte do desenho porque tem de poder correr enquanto se ARRASTA o
 * orador — a pergunta é "a partir de onde e que ele deixa de fazer sombra?", e
 * essa responde-se a mexer, não a carregar num botão.
 */
/**
 * Todas as caixas que podem tapar a imagem: o orador e cada pessoa da plateia.
 *
 * A plateia entra porque e ela que faz a pergunta a serio -- um projetor a
 * 4,5 m com gente a frente tem cabecas no feixe, e ver isso ANTES e a
 * diferenca entre pendurar a maquina uma vez ou duas.
 */
function caixasQueTapam() {
  const caixas = [];

  const figura = desenhado && desenhado.getObjectByName("figura");
  if (figura) {
    figura.updateMatrixWorld(true);
    // Peça a peça e não a figura toda: uma caixa à volta de uma pessoa é um
    // caixote, e a sombra dele na tela é um rectângulo que ninguém reconhece.
    // Assim vêem-se a cabeça, os ombros e as pernas — e é pela cabeça que se
    // percebe se aquilo apanha a cara de quem está a falar.
    const c = new THREE.Box3();
    figura.traverse((o) => {
      if (!o.isMesh) return;
      c.setFromObject(o);
      caixas.push({ dele: "orador",
                    minX: c.min.x, maxX: c.max.x, minY: c.min.y, maxY: c.max.y,
                    minZ: c.min.z, maxZ: c.max.z });
    });
  }

  if (corposDoPublico && corposDoPublico.corpos) {
    const { corpos, largura, fundura } = corposDoPublico;
    for (let i = 0; i < corpos.length; i += 4) {
      const x = corpos[i], topo = corpos[i + 1], z = corpos[i + 2], chao = corpos[i + 3];
      caixas.push({ dele: "publico",
                    minX: x - largura / 2, maxX: x + largura / 2,
                    minY: chao, maxY: topo,
                    minZ: z - fundura / 2, maxZ: z + fundura / 2 });
    }
  }
  return caixas;
}

/**
 * Quanto e que a imagem leva de sombra.
 *
 * A primeira versao atirava 45 raios da lente para a tela e contava os que
 * batiam no orador -- e dava sempre zero, porque os pontos ficavam a quase um
 * metro uns dos outros e uma pessoa tem 58 cm: passava entre as amostras.
 * Depois passou a projectar a caixa que o envolve, que e exacto para UM.
 *
 * Com a plateia toda, somar as caixas uma a uma contaria duas vezes as que se
 * sobrepoem -- e numa sala cheia sobrepoem-se quase todas, o que daria sombras
 * de 300%. Por isso a imagem parte-se numa grelha e conta-se quantas casas
 * ficam tapadas por alguem: a sobreposicao resolve-se sozinha.
 */
const COLUNAS_SOMBRA = 128, LINHAS_SOMBRA = 72;
const grelhaSombra = new Uint8Array(COLUNAS_SOMBRA * LINHAS_SOMBRA);

function medirSombra() {
  if (!projecaoAtual) { $("resumoProj").textContent = "—"; return; }
  const { projetor, imagem, foraDaSala } = projecaoAtual;

  // A sombra calcula-se, não se amostra. A primeira versão atirava 45 raios
  // para a tela e contava os que batiam no orador — e dava sempre zero, porque
  // os pontos ficavam a quase um metro uns dos outros e uma pessoa tem 58 cm:
  // ela passava entre as amostras. Agora projeta-se a caixa que a envolve a
  // partir da lente e mede-se a área que ela tapa. É exacto e não treme.
  grelhaSombra.fill(0);
  const eEsq = imagem.x - imagem.largura / 2;
  const eBaixo = imagem.y - imagem.altura / 2;
  const ate = imagem.z - projetor.z;

  let sombraDoOrador = 0;
  let gentePeloMeio = 0;
  const manchas = [];        // os rectangulos a pintar, ja recortados na imagem

  for (const caixa of caixasQueTapam()) {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    let aFrente = false;
    for (const cx of [caixa.minX, caixa.maxX]) {
      for (const cy of [caixa.minY, caixa.maxY]) {
        for (const cz of [caixa.minZ, caixa.maxZ]) {
          const dz = cz - projetor.z;
          // só conta quem está ENTRE a lente e a tela
          if (dz === 0 || dz / ate <= 0 || dz / ate >= 1) continue;
          aFrente = true;
          const k = ate / dz;
          const px = projetor.x + (cx - projetor.x) * k;
          const py = projetor.y + (cy - projetor.y) * k;
          if (px < minX) minX = px;
          if (px > maxX) maxX = px;
          if (py < minY) minY = py;
          if (py > maxY) maxY = py;
        }
      }
    }
    if (!aFrente) continue;

    const c1 = Math.max(0, Math.floor((minX - eEsq) / imagem.largura * COLUNAS_SOMBRA));
    const c2 = Math.min(COLUNAS_SOMBRA - 1,
                        Math.ceil((maxX - eEsq) / imagem.largura * COLUNAS_SOMBRA) - 1);
    const l1 = Math.max(0, Math.floor((minY - eBaixo) / imagem.altura * LINHAS_SOMBRA));
    const l2 = Math.min(LINHAS_SOMBRA - 1,
                        Math.ceil((maxY - eBaixo) / imagem.altura * LINHAS_SOMBRA) - 1);
    if (c2 < c1 || l2 < l1) continue;

    if (caixa.dele === "publico") gentePeloMeio++;

    // O que se conta e o que se pinta sai da mesma projeccao: se um dia
    // discordarem, e porque alguem mexeu num sitio e nao no outro.
    const eDir = imagem.x + imagem.largura / 2;
    const eCima = imagem.y + imagem.altura / 2;
    const rx1 = Math.max(minX, eEsq), rx2 = Math.min(maxX, eDir);
    const ry1 = Math.max(minY, eBaixo), ry2 = Math.min(maxY, eCima);
    if (rx2 > rx1 && ry2 > ry1 && manchas.length < 1200) {
      manchas.push(rx1, ry1, rx2, ry2);
    }

    let casas = 0;
    for (let l = l1; l <= l2; l++) {
      for (let c = c1; c <= c2; c++) {
        grelhaSombra[l * COLUNAS_SOMBRA + c] = 1;
        casas++;
      }
    }
    if (caixa.dele === "orador") sombraDoOrador += casas / grelhaSombra.length;
  }

  let tapadas = 0;
  for (let i = 0; i < grelhaSombra.length; i++) tapadas += grelhaSombra[i];
  const sombra = tapadas / grelhaSombra.length;

  const emPercentagem = (v) => {
    const n = Math.round(v * 100);
    return n < 1 ? "menos de 1%" : n + "%";
  };
  $("resumoProj").innerHTML =
    `Imagem <b>${imagem.largura.toFixed(2)} × ${imagem.altura.toFixed(2)} m</b>` +
    ` · base a <b>${projecaoAtual.base.toFixed(2)} m</b>` +
    (sombra > 0.0005
      ? ` · sombra <b>${emPercentagem(sombra)}</b>` +
        (gentePeloMeio
          ? ` (${gentePeloMeio} no feixe` +
            (sombraDoOrador > 0.0005 ? `, orador ${emPercentagem(sombraDoOrador)}` : "") + ")"
          : "")
      : "") +
    (foraDaSala ? " · <b>não cabe na sala</b>" : "");

  // O aviso do shift vem depois e não no meio: a primeira linha é o que se
  // mede, esta é o que a lente não dá.
  const excesso = shiftForaDaLente();
  if (excesso) $("resumoProj").innerHTML += ` · <b>shift a mais</b>: ${excesso}`;

  pintarSombra(manchas, imagem);
}

/**
 * A sombra, desenhada.
 *
 * Ate aqui ela era medida e nada mais: saia uma percentagem no resumo e o
 * desenho ficava exactamente igual, o que e o mesmo que dizer que nao estava
 * la. E "quanto e que aquilo tapa" e uma pergunta que se responde a olhar, nao
 * a ler -- ninguem quer saber que sao 8%, quer saber se apanha a cara de quem
 * esta a falar.
 *
 * Sao rectangulos chapados por cima da imagem, um por corpo, ja recortados nos
 * limites dela. Nao ha penumbra: uma lente nao e um ponto e as bordas a serio
 * sao suaves, mas isto e um preview de montagem e uma sombra nitida le-se
 * melhor do que uma bonita.
 */
function pintarSombra(manchas, imagem) {
  if (!desenhado) return;
  const velha = desenhado.getObjectByName("aux:sombra");
  if (velha) {
    desenhado.remove(velha);
    velha.geometry.dispose();
  }
  if (!manchas.length) return;

  const quantas = manchas.length / 4;
  const vertices = new Float32Array(quantas * 6 * 3);
  // Uma frincha a frente da imagem: no mesmo plano, o motor nao sabe qual das
  // duas fica por cima e a sombra pisca conforme a camara anda.
  const z = imagem.z + 0.03;
  for (let i = 0; i < quantas; i++) {
    const x1 = manchas[i * 4], y1 = manchas[i * 4 + 1];
    const x2 = manchas[i * 4 + 2], y2 = manchas[i * 4 + 3];
    const k = i * 18;
    const pontos = [x1, y1, x2, y1, x2, y2, x1, y1, x2, y2, x1, y2];
    for (let j = 0; j < 6; j++) {
      vertices[k + j * 3] = pontos[j * 2];
      vertices[k + j * 3 + 1] = pontos[j * 2 + 1];
      vertices[k + j * 3 + 2] = z;
    }
  }

  const geometria = new THREE.BufferGeometry();
  geometria.setAttribute("position", new THREE.BufferAttribute(vertices, 3));
  const malha = new THREE.Mesh(geometria, materialDaSombra);
  malha.name = "aux:sombra";
  malha.renderOrder = 3;
  desenhado.add(malha);
}

// Preto a 62%: uma sombra de projector nao e preta -- a luz ambiente cai la
// dentro na mesma -- e uma mancha opaca fazia parecer que aquilo era um buraco.
const materialDaSombra = new THREE.MeshBasicMaterial({
  color: 0x05070A, transparent: true, opacity: 0.62,
  depthWrite: false, side: THREE.DoubleSide, toneMapped: false
});

function avisarSeNaoCabe(medidas, sala, palco) {
  const altoDemais = palco.altura + palco.acimaDoPalco + medidas.altura;
  const problemas = [];
  if (medidas.largura > sala.largura) {
    problemas.push(`o conjunto tem ${medidas.largura.toFixed(2)} m e a sala ${sala.largura} m de largura`);
  }
  if (altoDemais > sala.altura) {
    problemas.push(`o topo fica a ${altoDemais.toFixed(2)} m e o pé-direito é ${sala.altura} m`);
  }
  const aviso = $("aviso");
  if (problemas.length) {
    aviso.textContent = "Não cabe: " + problemas.join("; ") + ".";
    aviso.classList.add("mostra");
  }
}

// ------------------------------------------------------------------- painel

function escreverPainel(medidas, lugares, gentePosta) {
  const resumo = $("resumo");
  const lista = $("listaZonas");

  if (!projeto) {
    resumo.className = "vazio";
    resumo.textContent = "Sem projeto. Cola aqui o que vem dos Calculadores.";
    lista.className = "vazio";
    lista.textContent = "—";
  } else {
    const res = projeto.zonas.reduce((t, z) => t + ((z.res && z.res.x * z.res.y) || 0), 0);
    resumo.className = "";
    resumo.innerHTML =
      `<b>${medidas.largura.toFixed(2)} × ${medidas.altura.toFixed(2)} m</b> · ` +
      `${medidas.zonas} zona${medidas.zonas === 1 ? "" : "s"}` +
      (medidas.peso ? ` · <b>${Math.round(medidas.peso)}</b> kg` : "") +
      (medidas.amp ? ` · <b>${medidas.amp.toFixed(1)}</b> A` : "") +
      (res ? ` · <b>${(res / 1e6).toFixed(1)}</b> Mpx` : "");

    lista.className = "";
    lista.innerHTML = "";
    for (const z of projeto.zonas) {
      const linha = document.createElement("div");
      linha.className = "zona";
      const cor = document.createElement("i");
      cor.className = "cor";
      cor.style.background = z.cor;
      const nome = document.createElement("span");
      nome.textContent = z.nome;
      const med = document.createElement("span");
      med.className = "med";
      med.textContent = `${z.w.toFixed(2)} × ${z.h.toFixed(2)} m`;
      linha.append(cor, nome, med);
      lista.append(linha);
    }
  }

  $("rodape").textContent = lugares
    ? `${lugares} lugares — ${gentePosta.filas} fila${gentePosta.filas === 1 ? "" : "s"} ` +
      `de ${gentePosta.porFila}` +
      (gentePosta.blocos > 1 ? `, em ${gentePosta.blocos} blocos.` : ".")
    : "Sem público no desenho.";
}

// -------------------------------------------------------------------- vistas

function vista(qual) {
  const sala = lerSala();
  const palco = lerPalco();
  const alvo = new THREE.Vector3(
    0,
    palco.altura + palco.acimaDoPalco + (projeto ? totais(projeto).altura / 2 : 2),
    -sala.profundidade / 2 + 0.5);

  if (qual === "frente") {
    // De trás da sala e um pouco acima: assim vê-se o ecrã, o chão e a gente
    // toda entre um e outro, que é a pergunta a que isto responde.
    camara.position.set(0, Math.max(5.2, alvo.y * 1.35), sala.profundidade / 2 + sala.profundidade * 0.35);
    alvo.y = Math.max(1.6, alvo.y * 0.75);
    alvo.z = -sala.profundidade / 2 + sala.profundidade * 0.3;
  } else if (qual === "lado") {
    camara.position.set(sala.largura / 2 + sala.largura * 0.3, alvo.y + 2.5, sala.profundidade * 0.15);
    alvo.y = Math.max(1.6, alvo.y * 0.7);
    alvo.z = -sala.profundidade / 2 + sala.profundidade * 0.3;
  } else if (qual === "cima") {
    // Planta: a pique sobre o meio da sala, e não a olhar para a parede.
    camara.position.set(0, Math.max(sala.largura, sala.profundidade) * 1.15, 0.01);
    alvo.set(0, 0, -sala.profundidade * 0.08);
  } else if (qual === "olhos") {
    const p = olhosDaPlateia || new THREE.Vector3(0, 1.2, sala.profundidade / 4);
    camara.position.copy(p);
    controlos.target.set(alvo.x, alvo.y, alvo.z);
    controlos.update();
    return;
  }
  controlos.target.copy(alvo);
  controlos.update();
}

// ------------------------------------------------------------------ etiquetas

const caixaEtiquetas = $("etiquetas");
function desenharEtiquetas() {
  const filhos = caixaEtiquetas.children;
  while (filhos.length > etiquetas.length) caixaEtiquetas.removeChild(filhos[filhos.length - 1]);
  while (filhos.length < etiquetas.length) caixaEtiquetas.append(document.createElement("span"));

  const largura = tela.clientWidth, altura = tela.clientHeight;
  etiquetas.forEach((etiqueta, i) => {
    const elemento = filhos[i];
    const p = etiqueta.ponto.clone().project(camara);
    const atras = p.z > 1;
    elemento.style.display = atras ? "none" : "block";
    if (atras) return;
    elemento.textContent = etiqueta.texto;
    elemento.style.left = ((p.x * 0.5 + 0.5) * largura) + "px";
    elemento.style.top = ((-p.y * 0.5 + 0.5) * altura) + "px";
  });
}

// --------------------------------------------------------------------- laço

function medir() {
  const largura = tela.clientWidth, altura = tela.clientHeight;
  if (!largura || !altura) return;
  renderizador.setSize(largura, altura, false);
  camara.aspect = largura / altura;
  camara.updateProjectionMatrix();
}

function volta() {
  requestAnimationFrame(volta);
  medir();
  controlos.update();
  // O chão é o chão: em vez de proibir olhar para cima, proíbe-se cavar.
  if (camara.position.y < 0.08) camara.position.y = 0.08;
  renderizador.render(cena, camara);
  desenharEtiquetas();
}

// ------------------------------------------------------------------- ligações

let temporizador = null;
function remontarDaqui(ms = 120) {
  clearTimeout(temporizador);
  temporizador = setTimeout(() => montar(false), ms);
}

document.querySelectorAll("#painel input").forEach(campo => {
  campo.addEventListener("input", () => remontarDaqui());
  campo.addEventListener("change", () => remontarDaqui(0));
});

document.querySelectorAll(".vistas button[data-vista]").forEach(b => {
  b.onclick = () => vista(b.dataset.vista);
});

// Pavilhão ou auditório. São dois mundos: num, o chão é plano e quem está atrás
// vê a nuca de quem está à frente; no outro, o chão sobe e por isso é que se
// consegue ver. Os botões são atalhos — quem manda continua a ser o campo.
function marcarTipoDePlateia() {
  const sobe = num("inclinacao") > 0.005;
  document.querySelectorAll("#tipoPlateia button").forEach(b => {
    b.classList.toggle("destaque", (b.dataset.plateia === "auditorio") === sobe);
  });
}
document.querySelectorAll("#tipoPlateia button").forEach(b => {
  b.onclick = () => {
    $("inclinacao").value = b.dataset.plateia === "auditorio" ? "0.12" : "0";
    marcarTipoDePlateia();
    montar(false);
  };
});
$("inclinacao").addEventListener("input", marcarTipoDePlateia);
marcarTipoDePlateia();

function carregar(bruto, recentrar = true) {
  try {
    projeto = lerProjeto(bruto);
    $("aviso").classList.remove("mostra");
    if (projeto.sala) {
      if (projeto.sala.largura) $("salaL").value = projeto.sala.largura;
      if (projeto.sala.profundidade) $("salaP").value = projeto.sala.profundidade;
      if (projeto.sala.altura) $("salaA").value = projeto.sala.altura;
    }
    montar(recentrar);
    if (projeto.recusadas && projeto.recusadas.length) {
      const aviso = $("aviso");
      aviso.textContent = "Ficaram de fora, por virem sem medidas: " +
                          projeto.recusadas.join(", ") + ".";
      aviso.classList.add("mostra");
    }
  } catch (e) {
    const aviso = $("aviso");
    // Um pedido escrito em palavras não é um erro de quem o escreveu: é o
    // botão errado. O que lê palavras é a IA, e está ali por baixo — dizê-lo,
    // e acender o botão, vale mais do que repetir a sintaxe que ele não usou.
    const palavras = String(bruto || "").trim().split(/\s+/).length;
    if (e.emPalavras && palavras >= 4) {
      aviso.innerHTML = "Isto é um <b>pedido escrito</b>, não medidas — e o que lê pedidos " +
                        "é a IA. Carrega em <b>Analisar com a IA</b>, aqui em baixo.";
      const botao = $("btAnalisar");
      botao.classList.add("apontado");
      botao.scrollIntoView({ block: "center", behavior: "smooth" });
      setTimeout(() => botao.classList.remove("apontado"), 4000);
    } else {
      aviso.textContent = e.message;
    }
    aviso.classList.add("mostra");
  }
}

document.querySelectorAll("[data-formato]").forEach(b => {
  b.onclick = () => {
    formatoImagem = parseFloat(b.dataset.formato);
    document.querySelectorAll("[data-formato]").forEach(o => o.classList.remove("destaque"));
    b.classList.add("destaque");
    montar(false);
  };
});
document.querySelector("[data-formato='1.777']").classList.add("destaque");

document.querySelectorAll("[data-conteudo]").forEach(b => {
  b.onclick = () => {
    modoConteudo = b.dataset.conteudo;
    document.querySelectorAll("[data-conteudo]").forEach(o => o.classList.remove("destaque"));
    b.classList.add("destaque");
    $("notaConteudo").textContent = modoConteudo === "cada"
      ? "Uma em cada: a imagem inteira repetida em cada zona, para quando os ecrãs mostram conteúdos independentes."
      : "Espalhada: uma imagem só pelo conjunto todo, cada zona mostra o seu bocado — como o media server faz.";
    montar(false);
  };
});

$("btPlanta").onclick = () => $("ficheiroPlanta").click();
$("btSemPlanta").onclick = () => {
  planta = null; plantaCad = null;
  camadasEscondidas.clear(); camadasLevantadas.clear();
  camposDaPlanta();
  montar(false);
};

/**
 * A planta em imagem e a planta em DXF pedem coisas diferentes, e mostrar as
 * duas ao mesmo tempo confunde: a imagem precisa que lhe digam a largura, o
 * DXF precisa que se confirmem as unidades. Uma de cada vez.
 */
function camposDaPlanta() {
  $("campoLargura").hidden = !!plantaCad;
  $("campoUnidades").hidden = !plantaCad;
  desenharCamadas();
  if (plantaCad) {
    const u = metrosPorUnidade(plantaCad, $("plantaU").value);
    const larguraM = plantaCad.largura * u.fator, fundoM = plantaCad.profundidade * u.fator;
    $("infoPlanta").innerHTML =
      `<b>${larguraM.toFixed(2)} × ${fundoM.toFixed(2)} m</b> · ` +
      `${plantaCad.segmentos.toLocaleString("pt-PT")} segmentos · escala ${u.comoSoube}` +
      (plantaCad.cortado ? " · <b>desenho cortado</b>, era grande de mais" : "");
    $("notaPlanta").innerHTML = u.comoSoube.startsWith("adivinhado")
      ? "O ficheiro não disse em que unidades foi desenhado, por isso a escala foi " +
        "<b>adivinhada pelo tamanho</b>. Se a sala aparecer com o tamanho errado, é " +
        "aqui que se corrige."
      : "O DXF entra à escala: as unidades vieram do próprio ficheiro. O que sobra " +
        "para mexer é só onde ele fica, porque o zero do CAD raramente é o meio da sala.";
  } else {
    $("infoPlanta").innerHTML = "<b>DXF</b>, <b>DWG</b>, <b>PDF</b> ou imagem. O DXF e o " +
      "DWG entram à escala e não se calibram; o PDF e a imagem pedem a largura real.";
    $("notaPlanta").innerHTML = "Um PDF e uma imagem não sabem a escala a que foram " +
      "desenhados. Diz-lhes a <b>largura real</b> que cobrem e o resto sai daí — a grelha " +
      "do chão é de metro a metro, use-a para conferir. Um <b>DWG</b> ou um <b>DXF</b> " +
      "sabem, e entram sozinhos com o tamanho certo.";
  }
}

$("plantaU").addEventListener("change", () => { camposDaPlanta(); montar(false); });

/**
 * A lista de camadas.
 *
 * Uma planta de arquitectura traz tudo na mesma folha: paredes, cadeiras,
 * tracejados, cotas, texto. Deitada no chão aquilo é um tapete onde não se
 * percebe o que é parede — e levantar tudo seria pior ainda, um bosque de
 * panos verticais. As camadas já vinham no ficheiro; faltava dar-lhes um
 * interruptor.
 *
 * Ordenadas pela que tem mais linhas: numa planta, a camada com mais desenho é
 * quase sempre a que se quer ver primeiro.
 */
function desenharCamadas() {
  const bloco = $("blocoCamadas");
  const lista = $("listaCamadas");
  bloco.hidden = !(plantaCad && plantaCad.camadas && plantaCad.camadas.length);
  if (bloco.hidden) return;

  lista.innerHTML = "";
  const ordenadas = plantaCad.camadas.slice().sort((a, b) => b.segmentos - a.segmentos);
  for (const camada of ordenadas) {
    const linha = document.createElement("div");
    linha.className = "camada" + (camadasEscondidas.has(camada.indice) ? " apagada" : "");

    const ver = document.createElement("input");
    ver.type = "checkbox";
    ver.checked = !camadasEscondidas.has(camada.indice);
    ver.title = "Ver esta camada";
    ver.onchange = () => {
      if (ver.checked) camadasEscondidas.delete(camada.indice);
      else camadasEscondidas.add(camada.indice);
      linha.classList.toggle("apagada", !ver.checked);
      montar(false);
    };

    const levantar = document.createElement("input");
    levantar.type = "checkbox";
    levantar.checked = camadasLevantadas.has(camada.indice);
    levantar.title = "Levantar esta camada, como paredes";
    levantar.onchange = () => {
      if (levantar.checked) camadasLevantadas.add(camada.indice);
      else camadasLevantadas.delete(camada.indice);
      montar(false);
    };

    const nome = document.createElement("span");
    nome.className = "nome";
    nome.textContent = camada.nome;
    nome.title = camada.nome;
    const quantos = document.createElement("span");
    quantos.className = "quantos";
    quantos.textContent = camada.segmentos.toLocaleString("pt-PT");

    linha.append(nome, quantos, ver, levantar);
    lista.append(linha);
  }
}

/**
 * A sala fica do tamanho do que está desenhado.
 *
 * Uma planta importada aparece do tamanho que tem — e uma planta de um centro
 * de congressos ao lado de uma sala de 24 × 18 m por omissão parece uma escala
 * errada, quando o que está errado são as medidas da sala. Isto mede o que se
 * está a VER (as camadas escondidas não contam, porque quem as escondeu já
 * disse que não fazem parte) e escreve-o nos campos.
 */
function medidasDaPlanta() {
  if (!plantaCad) return;
  const f = metrosPorUnidade(plantaCad, $("plantaU").value).fator;
  const p = plantaCad.pontos, dq = plantaCad.deQuemE;
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, contados = 0;
  for (let i = 0, s = 0; i < p.length; i += 4, s++) {
    if (dq && camadasEscondidas.has(dq[s])) continue;
    contados++;
    if (p[i] < minX) minX = p[i];       if (p[i] > maxX) maxX = p[i];
    if (p[i + 2] < minX) minX = p[i + 2]; if (p[i + 2] > maxX) maxX = p[i + 2];
    if (p[i + 1] < minY) minY = p[i + 1]; if (p[i + 1] > maxY) maxY = p[i + 1];
    if (p[i + 3] < minY) minY = p[i + 3]; if (p[i + 3] > maxY) maxY = p[i + 3];
  }
  if (!contados) return;

  const largura = (maxX - minX) * f, fundo = (maxY - minY) * f;
  $("salaL").value = Math.max(2, Math.round(largura * 10) / 10);
  $("salaP").value = Math.max(2, Math.round(fundo * 10) / 10);
  // A planta fica centrada na sala, que é onde ela estava a ser desenhada.
  $("plantaX").value = 0;
  $("plantaZ").value = 0;
  montar(true);
  $("aviso").textContent =
    `Sala posta a ${largura.toFixed(2)} × ${fundo.toFixed(2)} m, ` +
    `pelo que está visível na planta.`;
  $("aviso").classList.add("mostra");
  setTimeout(() => $("aviso").classList.remove("mostra"), 3600);
}

$("btMedidasDaPlanta").onclick = medidasDaPlanta;
$("alturaParedes").addEventListener("input", () => remontarDaqui());

/**
 * Um DWG disfarçado, ou um DWG assumido.
 *
 * O DWG é formato fechado da Autodesk, e binário: começa sempre por "AC10" e
 * dois dígitos da versão. Olha-se para os primeiros bytes e não só para o nome,
 * porque um DWG a que alguém mudou a extensão para .dxf entrava aqui e saía
 * com "isto não parece um DXF" — que manda a pessoa procurar um defeito onde
 * não há nenhum.
 */
async function eDWG(ficheiro) {
  if (/\.dwg$/i.test(ficheiro.name)) return true;
  try {
    const inicio = new Uint8Array(await ficheiro.slice(0, 6).arrayBuffer());
    return /^AC10\d\d$/.test(String.fromCharCode.apply(null, inicio));
  } catch (_) {
    return false;
  }
}

/** O que se está a fazer, enquanto se faz — carregar 10 MB demora. */
function aTrabalhar(texto) {
  const aviso = $("aviso");
  aviso.textContent = texto;
  aviso.classList.add("mostra");
}

$("ficheiroPlanta").onchange = async () => {
  const ficheiro = $("ficheiroPlanta").files[0];
  $("ficheiroPlanta").value = "";
  if (!ficheiro) return;
  camadasEscondidas.clear();
  camadasLevantadas.clear();
  try {
    if (await eDWG(ficheiro)) {
      // O DWG passa pelo motor e sai DXF; daí para a frente é tudo igual.
      plantaCad = await lerDWG(ficheiro, aTrabalhar);
      planta = null;
      $("aviso").classList.remove("mostra");
    } else if (/\.dxf$/i.test(ficheiro.name)) {
      // Um DXF de uma planta grande são dezenas de MB de texto: lê-se de uma
      // vez e depois já não se lhe toca mais.
      plantaCad = lerDXF(await ficheiro.text());
      planta = null;
    } else if (/\.pdf$/i.test(ficheiro.name) || ficheiro.type === "application/pdf") {
      const pdf = await lerPDF(ficheiro, aTrabalhar);
      planta = pdf.textura;
      plantaCad = null;
      $("aviso").classList.remove("mostra");
      if (pdf.paginas > 1) {
        aTrabalhar(`O PDF tem ${pdf.paginas} páginas — está a usar a primeira.`);
        setTimeout(() => $("aviso").classList.remove("mostra"), 4000);
      }
    } else {
      planta = await texturaDeFicheiro(ficheiro);
      plantaCad = null;
    }
    camposDaPlanta();
    montar(false);
  } catch (e) {
    $("aviso").textContent = e.message;
    $("aviso").classList.add("mostra");
  }
};

$("btPadrao").onclick = async () => { textura = await padraoDeTeste(); montar(false); };
$("btSemConteudo").onclick = () => { textura = null; montar(false); };
$("btImagem").onclick = () => $("ficheiroImagem").click();
$("ficheiroImagem").onchange = async () => {
  const ficheiro = $("ficheiroImagem").files[0];
  $("ficheiroImagem").value = "";
  if (!ficheiro) return;
  try {
    textura = await texturaDeFicheiro(ficheiro);
    montar(false);
  } catch (e) {
    $("aviso").textContent = e.message;
    $("aviso").classList.add("mostra");
  }
};

/**
 * Folha em branco.
 *
 * A app guarda coisas de propósito — o projeto que os Calculadores deixaram, a
 * sala, o projetor — e é isso que faz o "abrir e continuar de onde ia". Mas
 * quando o que se quer é a sala a seguir, essa memória passa a estorvo: fica-se
 * a apagar campo a campo e a descobrir uma planta antiga por baixo do desenho
 * novo.
 *
 * Os valores voltam ao que está escrito no HTML (o `defaultValue` de cada
 * campo) em vez de a uma lista repetida aqui — uma segunda lista ficava
 * desactualizada no dia em que se mexesse num valor por omissão.
 *
 * O que NÃO se limpa é como o painel está arrumado: as secções abertas e o
 * painel escondido são a maneira de trabalhar de quem está a usar isto, não
 * são o projeto.
 */
function limparTudo() {
  projeto = null;
  planta = null;
  plantaCad = null;
  camadasEscondidas.clear();
  camadasLevantadas.clear();
  textura = null;
  ondeEsta = null;
  limitesDoShift = null;
  projecaoAtual = null;
  modoConteudo = "espalhado";
  formatoImagem = 1.777;

  document.querySelectorAll("#painel input").forEach(campo => {
    if (campo.type === "checkbox") campo.checked = campo.defaultChecked;
    else if (campo.type !== "file") campo.value = campo.defaultValue;
  });
  $("colagem").value = "";
  prontoParaCarregar();
  $("plantaU").value = "auto";

  // A memória partilhada com os Calculadores vai também: senão o projeto
  // voltava sozinho no arranque seguinte, e "limpar" passava a durar até ao
  // próximo F5.
  for (const chave of [CHAVE_PROJETO, CHAVE_PROJETOR, "mikeapps-ecra-v1"]) {
    try { localStorage.removeItem(chave); } catch (_) {}
  }
  if (location.hash) history.replaceState(null, "", location.pathname + location.search);

  document.querySelectorAll("[data-formato]").forEach(b => {
    b.classList.toggle("destaque", b.dataset.formato === "1.777");
  });
  document.querySelectorAll("[data-conteudo]").forEach(b => {
    b.classList.toggle("destaque", b.dataset.conteudo === "espalhado");
  });
  escolherSaida("png");
  camposDaPlanta();
  marcarTipoDePlateia();

  $("notaEcra").textContent = "Muda o tamanho aqui para ver como fica, e devolve-o aos " +
                              "Calculadores para eles escolherem os tiles.";
  $("notaProj").innerHTML = "O rácio e a distância podem vir feitos: nos Calculadores, na " +
                            "aba <b>Distância de Projeção</b>, carrega em <b>Ver no Preview 3D</b>.";
  $("notaConteudo").textContent = "Espalhada: uma imagem só pelo conjunto todo, cada zona " +
                                  "mostra o seu bocado — como o media server faz.";
  $("btTrazerProjetor").textContent = "Trazer projetor dos Calculadores";

  montar(true);
}

$("btLimpar").onclick = () => {
  // Uma pergunta antes, porque isto deita fora trabalho: escrever as medidas de
  // uma sala outra vez é chato, e um clique enganado num botão pequeno é fácil.
  const temTrabalho = projeto || planta || plantaCad || textura;
  if (temTrabalho && !confirm("Limpar tudo? O projeto, a planta e as medidas voltam ao princípio.")) return;
  limparTudo();
};

// Carregar o quê? Com a caixa vazia, aquele botão só sabe dizer "não veio
// nada" — um botão que só serve para dar um erro é melhor apagado até ter o que
// fazer.
function prontoParaCarregar() {
  $("btCarregar").disabled = !$("colagem").value.trim();
}
$("colagem").addEventListener("input", prontoParaCarregar);
prontoParaCarregar();

/**
 * O que a IA percebeu, escrito e a ficar.
 *
 * Da primeira vez isto ia para o aviso de baixo — e o aviso apaga-se ao
 * primeiro campo que se mexa. Pior: quando o pedido não trazia medidas, o que
 * a IA devolvia de mais útil era precisamente o que se deitava fora. Ela lê
 * "dois ecrãs para slides e dois para imagem" e responde, com todas as letras,
 * que falta a tecnologia, a disposição, as dimensões da sala e a distância do
 * público. Isso não é um erro — é a lista do que falta perguntar ao cliente.
 */
function escreverRespostaIA(veio, feitas, mantidas, comVariosTamanhos) {
  const caixa = $("respostaIA");
  const partes = [];

  if (veio.resumo) partes.push(`<b>A IA leu:</b> ${veio.resumo}`);
  if (feitas.length) partes.push(`<b>Aplicado:</b> ${feitas.join(", ")}.`);
  else partes.push("<b>Não havia medidas no pedido</b>, por isso o desenho ficou como estava.");
  if (feitas.length && feitas[0].includes("partida")) {
    partes.push("O tamanho é <b>um ponto de partida</b> tirado da profundidade da sala — " +
                "muda-o em <i>Ajustar o ecrã</i>, ou traz o certo dos Calculadores.");
  }
  if (comVariosTamanhos) {
    // Vários tamanhos, posicionados uns em relação aos outros: é exactamente
    // o que a aba Ecrã Complexo já faz, com tiles, pitch e um editor de
    // posições a sério. Este esboço só serve para se ver mais ou menos como
    // fica -- para configurar isto para valer, o sítio é lá, e não aqui.
    partes.push("Isto tem <b>vários tamanhos</b> — a posição aqui é só um arranjo genérico " +
                "(conteúdo denso como slides ao centro, o resto a ladear). Para configurar a " +
                "sério, com tiles e pitch, usa o <b>Ecrã Complexo</b> nos Calculadores e traz o " +
                "resultado com \"Ver em 3D\".");
  }

  if (mantidas && mantidas.length) {
    partes.push("<b>Mantive o que já lá estava:</b> a sala que escreveste " +
                "ganha à que a IA estimou. Ela recebeu-a com o pedido, por isso " +
                "as contas dela já contam com ela.");
  }
  if (veio.perguntas && veio.perguntas.length) {
    partes.push("<b>Falta saber:</b><ul>" +
      veio.perguntas.map(q => `<li>${q}</li>`).join("") + "</ul>");
  }

  caixa.innerHTML = '<button class="fechar" title="Fechar">×</button>' + partes.join("<br>");
  caixa.querySelector(".fechar").onclick = () => { caixa.hidden = true; };
  caixa.hidden = false;
}

/**
 * O conteúdo denso (slides, texto, gráficos) ganha sempre a posição central —
 * é o que a conta de distância de visualização diz: uma letra lê-se a uma
 * distância que uma fotografia não precisa. Não se refaz aqui essa conta —
 * mora nos Calculadores, na aba Distância de Visualização, e refazê-la seria
 * duplicar exactamente o que já existe — mas o DESTINO que o texto deu a cada
 * grupo ("para powerpoint", "para slides") já diz o suficiente para saber qual
 * precisa da melhor posição.
 */
const CONTEUDO_DENSO = /\b(powerpoint|slide|slides|texto|grafic\w*|apresenta\w*|dado\w*|conteudo)\b/;

/**
 * Os prioritários ao centro, os outros nas pontas.
 *
 * O esboço tinha as peças pela ordem em que o texto as descrevia — "2 maiores
 * para powerpoint" todos de um lado, "2 menores para imagens" todos do outro —
 * e isso não é uma montagem, é uma lista. Adivinhar palavras como "interior" ou
 * "exterior" no texto seria tentar fazer, por regex, o que a aba Ecrã Complexo
 * já faz a sério com um editor de posições; aqui o objectivo é só ver mais ou
 * menos como fica.
 *
 * A ordem de prioridade é: primeiro o CONTEÚDO (slides/texto ganham à imagem,
 * porque é isso que a distância de visualização pede), e só a seguir o
 * tamanho — um "menor" que seja de slides ainda vai à frente de um "maior"
 * que seja só de imagem.
 */
function ordenarPeloCentro(pecas) {
  const ordenadas = pecas.slice().sort((a, b) => {
    const prioridadeA = CONTEUDO_DENSO.test(a.para || "") ? 1 : 0;
    const prioridadeB = CONTEUDO_DENSO.test(b.para || "") ? 1 : 0;
    return prioridadeB - prioridadeA || b.escala - a.escala;
  });
  const esquerda = [], direita = [];
  ordenadas.forEach((peca, i) => (i % 2 === 0 ? direita : esquerda).push(peca));
  return [...esquerda.reverse(), ...direita];
}

/**
 * O texto do pedido, lido pela IA.
 *
 * A primeira versão mandava o texto para os Calculadores e deixava-os analisar.
 * Não funcionou na máquina do mike, e a razão vale a pena ficar escrita: a app
 * dele está INSTALADA, e uma janela de aplicação não se alcança com um
 * `window.open` com nome. O texto chegava ao localStorage e ficava lá à espera
 * de uma janela que nunca era a certa.
 *
 * Agora a chamada faz-se daqui, ao MESMO Worker — o endereço vem do
 * localStorage que os Calculadores já escrevem, por isso configura-se uma vez e
 * serve os dois. Não é duplicar a conta deles: as tabelas de LED, de projetores
 * e de lentes continuam todas do lado de lá. O que atravessa é um texto e umas
 * medidas.
 */
$("btAnalisar").onclick = async () => {
  const texto = $("colagem").value.trim();
  if (!texto) {
    $("aviso").textContent = "Escreve ou cola primeiro o texto do pedido.";
    $("aviso").classList.add("mostra");
    return;
  }

  const botao = $("btAnalisar");
  const dizia = botao.textContent;
  botao.disabled = true;
  botao.textContent = "A ler o pedido…";
  $("aviso").textContent = "A IA está a ler o pedido — pode demorar uns segundos.";
  $("aviso").classList.add("mostra");

  try {
    const salaAgora = {
      largura: num("salaL"), profundidade: num("salaP"), altura: num("salaA")
    };
    const veio = doQueVeioParaCa(await analisar(texto, salaAgora));
    const feitas = [];
    const mantidas = [];
    let comVariosTamanhos = false;

    if (veio.sala) {
      // Um campo que já foi mexido à mão não se escreve por cima. O
      // `defaultValue` é o que está no HTML: se o campo já não é isso, foi
      // alguém que lá mexeu, e o que essa pessoa escreveu vale mais do que uma
      // estimativa feita a partir de um parágrafo.
      const porOMike = (id) => $(id).value !== $(id).defaultValue;
      const aplicar = (id, valor, comoSeDiz) => {
        if (!valor) return;
        if (porOMike(id)) { mantidas.push(comoSeDiz); return; }
        $(id).value = valor;
        feitas.push(comoSeDiz.replace("{}", valor));
      };
      aplicar("salaL", veio.sala.largura, "sala com {} m de largura");
      aplicar("salaP", veio.sala.profundidade, "{} m de fundo");
      aplicar("salaA", veio.sala.altura, "{} m de pé-direito");
    }

    const quantos = Math.max(1, veio.quantos || quantosEcras(texto) || 1);

    // Um sim/não que a IA já extrai — não se inventa um grau de curvatura,
    // porque o texto raramente o diz; uma curva moderada chega para se ver a
    // diferença, sem fingir uma precisão que ninguém pediu.
    const curvaDoPedido = veio.curvo ? { modo: "angulo", valor: 15, dir: "concavo" } : null;

    if (veio.ecra) {
      // Um ecrã só, ao meio: o que a IA dá é um tamanho, não uma montagem.
      carregar({
        v: 1, origem: "assistente", nome: "Ecrã do pedido",
        zonas: [{ nome: "Ecrã", x: 0, y: 0,
                  w: veio.ecra.largura, h: veio.ecra.altura, cor: "#2E7BFF",
                  curva: curvaDoPedido }]
      }, true);
      feitas.unshift(`ecrã de ${veio.ecra.largura.toFixed(2)} × ${veio.ecra.altura.toFixed(2)} m` +
                     (curvaDoPedido ? " (curvo)" : ""));
    } else if (veio.quantos || quantosEcras(texto) || gruposDeEcras(texto).length) {
      // Sem medidas no pedido, desenha-se na mesma: um pedido que fala de
      // quatro ecrãs merece ver quatro ecrãs. O tamanho é um PONTO DE PARTIDA
      // tirado da profundidade da sala -- e diz-se que é, para ninguém o levar
      // para uma reunião como se fosse uma proposta.
      //
      // E se o texto disser que uns são maiores do que outros, isso respeita-se:
      // desenhar tudo igual é ignorar metade do que foi pedido.
      //
      // Mas nenhum grupo pode furar o tecto. O ecrã não assenta no chão da
      // sala -- assenta em cima do palco, e às vezes ainda sobe mais um bocado
      // ("Ecrã acima do palco"). É esse ponto de partida, e não o chão, que
      // tem de caber no pé-direito: um "maiores" de 1,5× que ficasse bem no
      // papel e furasse o tecto na sala real não seria um esboço, era um erro.
      const fundo = num("salaP") || 18;
      const palco = lerPalco();
      const pDireito = num("salaA") || 8;
      // 0,4 m de folga até ao tecto -- estrutura, grelhas, o que for lá em cima.
      const sobraAteAoTecto = Math.max(1, pDireito - palco.altura - palco.acimaDoPalco - 0.4);
      const alturaBase = Math.min(4, sobraAteAoTecto, Math.max(1.5, Math.round((fundo / 8) * 10) / 10));
      // Primeiro os grupos que a própria IA já separou -- ela percebe a
      // língua, e não precisa de adivinhar âncoras num texto. A regex sobre o
      // texto escrito fica como rede de segurança, para um Worker ainda sem
      // este campo ou uma resposta em que a IA o deixou vazio.
      const grupos = veio.grupos.length ? veio.grupos : gruposDeEcras(texto);
      const lista = grupos.length ? grupos : [{ quantos, escala: 1, para: "" }];

      // Primeiro calculam-se os tamanhos, um por peça -- e só depois se decide
      // a ORDEM em que ficam da esquerda para a direita. As duas coisas vêm de
      // sítios diferentes: o tamanho vem do que o texto disse; a ordem é um
      // arranjo de propósito, e não a ordem em que as frases foram escritas.
      // A curvatura só se aplica ao ecrã ÚNICO (acima) — aqui há vários grupos
      // de peças distintas lado a lado, e curvar cada uma por si dava várias
      // arcas pequenas em vez de UMA parede curva. Representar bem "N ecrãs
      // curvos" pediria uni-los numa zona só com gomos, o que muda a forma
      // como o resto do esboço se monta; fica por fazer, e é melhor não
      // desenhar do que desenhar errado.
      const pecas = [];
      let cortadoPeloTecto = false;
      const descricao = [];
      for (const grupo of lista) {
        let altura = Math.round(alturaBase * grupo.escala * 10) / 10;
        if (altura > sobraAteAoTecto + 0.001) { altura = Math.round(sobraAteAoTecto * 10) / 10; cortadoPeloTecto = true; }
        const larg = Math.round(altura * (16 / 9) * 10) / 10;
        for (let i = 0; i < grupo.quantos; i++) {
          pecas.push({
            nome: grupo.para ? `${grupo.para} ${i + 1}` : "",
            w: larg, h: altura, escala: grupo.escala,
            cor: grupo.escala > 1 ? "#2E7BFF" : grupo.escala < 1 ? "#7C8CA0" : "#22D3EE"
          });
        }
        descricao.push(`${grupo.quantos}× ${larg.toFixed(2)} × ${altura.toFixed(2)} m` +
                       (grupo.para ? ` (${grupo.para})` : ""));
      }

      const zonas = [];
      let x = 0, n = 0;
      for (const peca of ordenarPeloCentro(pecas)) {
        n++;
        zonas.push({ nome: peca.nome || `Ecrã ${n}`, x, y: 0, w: peca.w, h: peca.h, cor: peca.cor });
        x += peca.w + 1;
      }

      carregar({ v: 1, origem: "assistente (tamanho de partida)",
                 nome: `${n} ecrãs do pedido`, zonas }, true);
      feitas.unshift(descricao.join(", ") + " — tamanho de partida" +
                     (cortadoPeloTecto ? ", já ajustado ao pé-direito" : ""));
      comVariosTamanhos = lista.length > 1;
    } else {
      montar(true);
    }

    escreverRespostaIA(veio, feitas, mantidas, comVariosTamanhos);
    if (feitas.length) {
      $("aviso").innerHTML = "Da IA: " + feitas.join(", ") + ".";
      setTimeout(() => $("aviso").classList.remove("mostra"), 7000);
    } else {
      $("aviso").classList.remove("mostra");
    }
  } catch (e) {
    $("aviso").innerHTML = e.message +
      "<br>O assistente e o seu endereço configuram-se nos <b>Calculadores</b>, " +
      "em <i>Configuração do assistente</i>.";
  } finally {
    botao.disabled = false;
    botao.textContent = dizia;
  }
};

$("btCarregar").onclick = () => carregar($("colagem").value);
$("btExemplo").onclick = () => {
  $("colagem").value = JSON.stringify(EXEMPLO, null, 2);
  carregar(EXEMPLO);
};

/**
 * Trazer o projeto dos Calculadores, à mão.
 *
 * As outras três pontes (sala, projetor, ecrã ajustado) têm todas um botão
 * "Trazer X" no lado que recebe. Esta nunca teve: o projeto só chegava
 * sozinho — ao abrir o Preview, ou ao vivo com as duas abas abertas ao mesmo
 * tempo. Sem um botão, não havia como o pedir outra vez à mão quando isso não
 * bastava — e "não encontro onde importar" era a app a dizer a verdade: não
 * havia onde.
 */
$("btTrazerProjeto").onclick = () => {
  const guardado = projetoGuardado();
  if (!guardado) {
    $("aviso").innerHTML = "Ainda não há nada guardado. Nos Calculadores, monta as zonas " +
      "(aba <b>Ecrã Complexo</b>, ou qualquer outra com \"Adicionar ao projeto\") — ficam " +
      "gravadas sozinhas, e depois carregas aqui neste botão.";
    $("aviso").classList.add("mostra");
    return;
  }
  carregar(guardado, true);
};

// ------------------------------------------------- ajustar e devolver o ecrã
//
// Olha-se para a sugestão montada na sala, acha-se curta, e muda-se ali mesmo.
// O conjunto todo é escalado -- as zonas mantêm as proporções e as posições
// relativas entre si -- e o tamanho volta para os Calculadores, que são quem
// sabe traduzir metros em tiles.

function escreverTamanhoDoEcra() {
  if (!projeto) { $("ecraL").value = ""; $("ecraA").value = ""; return; }
  const t = totais(projeto);
  $("ecraL").value = t.largura.toFixed(2);
  $("ecraA").value = t.altura.toFixed(2);
}

function redimensionarEcra(qual) {
  if (!projeto) return;
  const t = totais(projeto);
  const novaL = num("ecraL"), novaA = num("ecraA");
  let fator;
  if (qual === "largura") {
    if (!(novaL > 0) || !t.largura) return;
    fator = novaL / t.largura;
  } else {
    if (!(novaA > 0) || !t.altura) return;
    fator = novaA / t.altura;
  }
  if (!isFinite(fator) || fator <= 0 || Math.abs(fator - 1) < 0.0005) return;

  // Escala-se a partir do canto superior esquerdo do conjunto, para as zonas
  // não se afastarem umas das outras nem trocarem de sítio.
  for (const z of projeto.zonas) {
    z.x = t.esquerda + (z.x - t.esquerda) * fator;
    z.y = t.topo + (z.y - t.topo) * fator;
    z.w *= fator;
    z.h *= fator;
    // Os tiles e a resolução deixam de bater certo com o novo tamanho: quem
    // os volta a calcular são os Calculadores, e dizer um número errado é
    // pior do que não dizer nenhum.
    z.tiles = null; z.res = null; z.peso = null; z.amp = null;
  }
  projeto.origem = "ajustado no preview";
  montar(false);
  escreverTamanhoDoEcra();
  $("notaEcra").textContent =
    "Tamanho alterado aqui. Devolve-o aos Calculadores para eles escolherem os tiles " +
    "— o peso e a amperagem só voltam a fazer sentido depois disso.";
}

$("ecraL").addEventListener("change", () => redimensionarEcra("largura"));
$("ecraA").addEventListener("change", () => redimensionarEcra("altura"));

$("btDevolver").onclick = () => {
  if (!projeto) { $("notaEcra").textContent = "Não há projeto para devolver."; return; }
  const t = totais(projeto);
  try {
    localStorage.setItem("mikeapps-ecra-v1", JSON.stringify({
      v: 1, largura: +t.largura.toFixed(2), altura: +t.altura.toFixed(2),
      zonas: projeto.zonas.length, quando: new Date().toISOString()
    }));
    $("notaEcra").textContent =
      `Enviado: ${t.largura.toFixed(2)} × ${t.altura.toFixed(2)} m. Nos Calculadores, ` +
      `na aba Ecrã LED, carrega em "Trazer do Preview".`;
  } catch (e) {
    $("notaEcra").textContent = "Não consegui guardar — o browser não deixa.";
  }
};

// --------------------------------------------------------- guardar a imagem
//
// Um printscreen perde as etiquetas e os numeros, que sao metade do que ali
// interessa -- e uma imagem que so mostra caixas azuis nao serve para mandar a
// ninguem. Por isso o desenho e recomposto: a cena, as etiquetas por cima, e
// uma tira em baixo com as contas.

function guardarImagem() {
  renderizador.render(cena, camara);            // garantir que o que se copia e o que se ve

  const folha = document.createElement("canvas");
  const tira = 54;
  folha.width = tela.width;
  folha.height = tela.height + tira * (tela.width / tela.clientWidth);
  const p = folha.getContext("2d");
  const escala = tela.width / tela.clientWidth;

  p.fillStyle = "#0E1418";
  p.fillRect(0, 0, folha.width, folha.height);
  p.drawImage(tela, 0, 0);

  // as etiquetas, onde elas estao agora
  p.font = `${Math.round(12 * escala)}px "Segoe UI", system-ui, sans-serif`;
  p.textBaseline = "middle";
  for (const etiqueta of etiquetas) {
    const v = etiqueta.ponto.clone().project(camara);
    if (v.z > 1) continue;
    const x = (v.x * 0.5 + 0.5) * folha.width;
    const y = (-v.y * 0.5 + 0.5) * tela.height;
    const largura = p.measureText(etiqueta.texto).width + 16 * escala;
    const altura = 22 * escala;
    p.fillStyle = "rgba(14,20,24,0.86)";
    p.fillRect(x - largura / 2, y - altura / 2, largura, altura);
    p.strokeStyle = "#232D36";
    p.strokeRect(x - largura / 2, y - altura / 2, largura, altura);
    p.fillStyle = "#E7ECF2";
    p.textAlign = "center";
    p.fillText(etiqueta.texto, x, y);
  }

  // a tira com as contas
  const linha = [
    $("resumo").textContent.replace(/\s+/g, " ").trim(),
    $("rodape").textContent.trim(),
    $("resumoProj").textContent.trim()
  ].filter(t => t && t !== "—").join("   ·   ");
  p.fillStyle = "#141B21";
  p.fillRect(0, tela.height, folha.width, folha.height - tela.height);
  p.fillStyle = "#8A97A6";
  p.textAlign = "left";
  p.font = `${Math.round(13 * escala)}px "Segoe UI", system-ui, sans-serif`;
  p.fillText(linha, 16 * escala, tela.height + (folha.height - tela.height) / 2);

  const agora = new Date();
  const nome = "preview-" +
    agora.toISOString().slice(0, 16).replace("T", "-").replace(":", "h") + ".png";
  folha.toBlob((blob) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = nome;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }, "image/png");
}

/**
 * A vista, tal e qual está no ecrã.
 *
 * A outra imagem leva etiquetas e uma tira com as contas, que é o que faz falta
 * para mandar a alguém que tem de decidir. Esta não leva nada: serve para
 * entrar num slide, num email ou ao lado de uma planta, onde os números já
 * estão escritos noutro sítio e o que se quer é só o desenho.
 *
 * Ao contrário de um printscreen, sai na resolução do canvas e sem o painel.
 */
function guardarVista() {
  // Sem isto o browser pode ter limpo o buffer antes de o copiarmos e a
  // imagem sai preta -- o preserveDrawingBuffer sozinho não chega.
  renderizador.render(cena, camara);
  tela.toBlob((blob) => {
    if (!blob) { $("notaExportar").textContent = "Não consegui copiar a vista."; return; }
    descarregar(blob, nomeDoFicheiro("png"));
    $("notaExportar").innerHTML =
      `Guardada a vista: <b>${tela.width} × ${tela.height}</b> px.`;
  }, "image/png");
}



// ------------------------------------------------------- arrastar o orador
//
// A figura serve para dar escala, mas serve para mais do que isso: arrastada
// pelo palco, mostra de onde e que ela tapa o ecra -- e a que distancia deixa
// de tapar. Por isso anda, e anda so no chao do palco.

const apontador = new THREE.Raycaster();
const rato = new THREE.Vector2();
const planoDoPalco = new THREE.Plane();
const ondeCaiu = new THREE.Vector3();
let aArrastar = false;

function figuraNaCena() {
  return desenhado ? desenhado.getObjectByName("figura") : null;
}

function porRato(e) {
  const caixa = tela.getBoundingClientRect();
  rato.set(
    ((e.clientX - caixa.left) / caixa.width) * 2 - 1,
    -((e.clientY - caixa.top) / caixa.height) * 2 + 1);
}

tela.addEventListener("pointerdown", (e) => {
  const figura = figuraNaCena();
  if (!figura) return;
  porRato(e);
  apontador.setFromCamera(rato, camara);
  if (!apontador.intersectObject(figura, true).length) return;

  aArrastar = true;
  controlos.enabled = false;                       // senao a camara vem atras
  tela.setPointerCapture(e.pointerId);
  planoDoPalco.set(new THREE.Vector3(0, 1, 0), -figura.position.y);
  tela.style.cursor = "grabbing";
});

tela.addEventListener("pointermove", (e) => {
  const figura = figuraNaCena();
  if (!figura) return;

  if (!aArrastar) {
    // Um cursor de mao a dizer que aquilo se pega — senao ninguem descobre.
    porRato(e);
    apontador.setFromCamera(rato, camara);
    tela.style.cursor = apontador.intersectObject(figura, true).length ? "grab" : "";
    return;
  }

  porRato(e);
  apontador.setFromCamera(rato, camara);
  if (!apontador.ray.intersectPlane(planoDoPalco, ondeCaiu)) return;

  const sala = lerSala();
  const palco = lerPalco();
  const noPalco = palco.altura > 0 && palco.profundidade > 0;
  const larguraPalco = Math.min(palco.largura || sala.largura, sala.largura);
  const limiteX = (noPalco ? larguraPalco : sala.largura) / 2 - 0.4;
  const fundoZ = -sala.profundidade / 2 + 0.5;
  const frenteZ = noPalco
    ? -sala.profundidade / 2 + palco.profundidade - 0.3
    : sala.profundidade / 2 - 0.5;

  figura.position.x = Math.max(-limiteX, Math.min(limiteX, ondeCaiu.x));
  figura.position.z = Math.max(fundoZ, Math.min(frenteZ, ondeCaiu.z));
  figura.updateMatrixWorld(true);
  ondeEsta = { x: figura.position.x, z: figura.position.z };
  medirSombra();
});

function largarFigura(e) {
  if (!aArrastar) return;
  aArrastar = false;
  controlos.enabled = true;
  tela.style.cursor = "";
  try { tela.releasePointerCapture(e.pointerId); } catch (_) {}
}
tela.addEventListener("pointerup", largarFigura);
tela.addEventListener("pointercancel", largarFigura);

// ----------------------------------------------------------------- exportar
//
// Isto desenha volumes e cores; quem faz a imagem bonita trabalha noutro sitio.
// A ponte e um ficheiro com as pecas todas no sitio e com o nome certo -- e o
// nome e a parte que interessa, porque e por ele que, no Cinema 4D, se escolhe
// a zona a que se vai por a textura de verdade.

function nomeDoFicheiro(extensao) {
  const quando = new Date().toISOString().slice(0, 16).replace("T", "-").replace(":", "h");
  const nome = (projeto && projeto.nome ? projeto.nome : "preview")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
  return `${nome || "preview"}-${quando}.${extensao}`;
}

async function exportar(formato) {
  const nota = $("notaExportar");
  if (!desenhado) return;

  const grupo = prepararParaExportar(desenhado, {
    comPublico: $("expPublico").checked,
    comLinhas: $("expLinhas").checked
  });
  const { vertices, pecas } = pesar(grupo);
  if (!pecas) { nota.textContent = "Não há nada para exportar."; return; }

  // Quatrocentas pessoas assadas em geometria a serio sao muitos megabytes, e
  // o browser fica calado enquanto os escreve. Mais vale dizer que esta a
  // trabalhar do que parecer que o botao nao fez nada.
  nota.textContent = `A escrever ${pecas} peças…`;
  try {
    const blob = formato === "glb" ? await comoGLB(grupo) : comoOBJ(grupo);
    descarregar(blob, nomeDoFicheiro(formato));
    nota.innerHTML =
      `Guardado: <b>${pecas}</b> peças, ${(vertices / 1000).toFixed(0)} mil vértices, ` +
      `<b>${(blob.size / 1048576).toFixed(1)} MB</b>.` +
      (formato === "obj" ? " O .obj vai sem materiais — as cores põem-se do outro lado." : "");
  } catch (e) {
    nota.textContent = e.message;
  }
}

// Escolhe-se o que sai e só depois se guarda -- em vez de haver um botão por
// formato, cada um a disparar de imediato. Com quatro saídas e duas opções que
// só valem para duas delas, um botão por formato passa a ser um campo minado:
// carrega-se no errado e vai-se buscar o ficheiro à pasta das descargas para
// perceber que não era aquele.
let saidaEscolhida = "png";

const NOTAS_DA_SAIDA = {
  "png": "A vista como está no ecrã, tal e qual — para entrar num slide ou num email.",
  "png-medidas": "A vista com as etiquetas e uma tira com as contas em baixo — " +
                 "para mandar a quem tem de decidir.",
  "glb": "O <b>.glb</b> leva as cores e o nome de cada zona — é por esse nome que se lhe " +
         "põe a textura no Cinema 4D ou no Blender.",
  "obj": "O <b>.obj</b> abre em tudo, mas vai <b>sem materiais</b>: as peças chegam lá " +
         "cinzentas e pintam-se à mão."
};

function escolherSaida(qual) {
  saidaEscolhida = qual;
  document.querySelectorAll("[data-saida]").forEach(b => {
    b.classList.toggle("destaque", b.dataset.saida === qual);
  });
  // As opções são de quem as pode usar: um PNG não leva público nem planta CAD
  // "incluídos", leva o que estiver no ecrã.
  const eTresD = qual === "glb" || qual === "obj";
  $("opcaoPublico").hidden = !eTresD;
  $("opcaoLinhas").hidden = !eTresD;
  $("notaExportar").innerHTML = NOTAS_DA_SAIDA[qual] || "";
}

document.querySelectorAll("[data-saida]").forEach(b => {
  b.onclick = () => escolherSaida(b.dataset.saida);
});
escolherSaida("png");

$("btGuardar").onclick = () => {
  if (saidaEscolhida === "png") guardarVista();
  else if (saidaEscolhida === "png-medidas") guardarImagem();
  else exportar(saidaEscolhida);
};

// ------------------------------------------------- o projetor dos Calculadores
//
// A mesma regra das zonas de LED: o catalogo de projetores e de lentes fica do
// lado de la, e o que atravessa e o resultado -- racio, distancia e formato.
// Aqui nao ha nem uma tabela de modelos nem uma conta de lentes.

function aplicarProjetor(p) {
  if (!p) return false;
  limitesDoShift = p.shift || null;
  $("projLigada").checked = true;
  $("projRacio").value = p.racio.toFixed(2);
  $("projDist").value = p.distancia.toFixed(2);
  if (p.formato > 0.2) {
    formatoImagem = p.formato;
    document.querySelectorAll("[data-formato]").forEach(b => {
      b.classList.toggle("destaque", Math.abs(parseFloat(b.dataset.formato) - p.formato) < 0.02);
    });
  }
  montar(false);
  const quem = [p.modelo, p.lente].filter(Boolean).join(" · ");
  $("notaProj").innerHTML =
    (quem ? `<b>${quem}</b><br>` : "") +
    `Veio dos Calculadores: rácio ${p.racio.toFixed(2)}:1 a ${p.distancia.toFixed(2)} m` +
    (p.largura ? `, para uma imagem de ${p.largura.toFixed(2)} m.` : ".") +
    (limitesDoShift
      ? ` Esta lente faz <b>${intervalo(limitesDoShift.vMin, limitesDoShift.vMax)} V</b> e ` +
        `<b>${intervalo(limitesDoShift.hMin, limitesDoShift.hMax)} H</b>` +
        (limitesDoShift.nota ? ` (${limitesDoShift.nota})` : "") + "."
      : " O fabricante não publica o shift desta lente, por isso ninguém verifica o que aqui se escrever.") +
    " A altura da lente é daqui — os Calculadores não a sabem.";
  return true;
}

/** "±58 %" quando é simétrico, "+45 % a +68 %" quando não é. */
function intervalo(min, max) {
  if (min === -max) return "±" + max + " %";
  return (min > 0 ? "+" : "") + min + " % a " + (max > 0 ? "+" : "") + max + " %";
}

/**
 * O shift que se pediu cabe na lente que veio de lá?
 *
 * Escrever +80% num sítio onde a lente vai a +58% desenha uma imagem que
 * ninguém consegue pôr ali — e o desenho passa a ser uma promessa que a sala
 * não cumpre. Quando não há limites publicados não se inventa nenhum: cala-se,
 * que é a única coisa honesta a fazer com um número que não se tem.
 */
function shiftForaDaLente() {
  if (!limitesDoShift) return null;
  const v = num("projShiftV"), h = num("projShiftH");
  const fora = [];
  if (v < limitesDoShift.vMin || v > limitesDoShift.vMax) {
    fora.push(`vertical ${v > 0 ? "+" : ""}${v} %, e a lente faz ` +
              `${intervalo(limitesDoShift.vMin, limitesDoShift.vMax)}`);
  }
  if (h < limitesDoShift.hMin || h > limitesDoShift.hMax) {
    fora.push(`horizontal ${h > 0 ? "+" : ""}${h} %, e a lente faz ` +
              `${intervalo(limitesDoShift.hMin, limitesDoShift.hMax)}`);
  }
  return fora.length ? fora.join("; ") : null;
}

$("btTrazerProjetor").onclick = () => {
  if (!aplicarProjetor(projetorGuardado())) {
    $("notaProj").innerHTML = "Ainda não veio nenhum projetor. Nos Calculadores, na aba " +
      "<b>Distância de Projeção</b>, carrega em <b>Ver no Preview 3D</b>.";
  }
};

/**
 * O botão do cabeçalho: força as duas pontes que vêm dos Calculadores
 * (projeto e projetor) de uma só vez.
 *
 * O evento "storage" já as traz sozinhas quando as duas apps estão abertas ao
 * mesmo tempo — mas é silencioso, e se por alguma razão não disparar (as
 * janelas não estavam as duas abertas no momento certo, por exemplo), fica
 * tudo na mesma sem ninguém saber que ficou por trazer. Isto dá sempre uma
 * resposta, mesmo que seja "não havia nada".
 */
$("btSincronizar").onclick = () => {
  const projetoTrazido = projetoGuardado();
  if (projetoTrazido) carregar(projetoTrazido, false);
  const projetorTrazido = aplicarProjetor(projetorGuardado());

  const aviso = $("aviso");
  if (projetoTrazido || projetorTrazido) {
    aviso.innerHTML = "Trazido dos Calculadores: " +
      [projetoTrazido ? "o projeto" : "", projetorTrazido ? "o projetor" : ""]
        .filter(Boolean).join(" e ") + ".";
  } else {
    aviso.textContent = "Não há nada guardado do lado dos Calculadores ainda.";
  }
  aviso.classList.add("mostra");
  setTimeout(() => aviso.classList.remove("mostra"), 3000);
};

// ------------------------------------------------------------ dobrar o painel
//
// O painel cresceu -- sala, palco, publico, projecao, conteudo, planta,
// exportacao -- e tudo aberto e um metro de scroll ate aos botoes das vistas.
// Cada seccao fecha no titulo, e o que ficou fechado fica fechado: quem fecha
// a projecao uma vez nao a quer aberta na sessao seguinte.

(function dobras() {
  let guardadas = null;
  try { guardadas = JSON.parse(localStorage.getItem("preview-dobras") || "null"); } catch (_) {}
  // A primeira vez abrem TODAS fechadas: o painel passa a ser um indice de uma
  // vista de olhos, e abre-se o que se vai mexer. Depois disso manda o que
  // ficou aberto da ultima vez.
  const todas = [...document.querySelectorAll("#painel section > h2")]
    .map(t => t.parentElement.id).filter(Boolean);
  const fechadas = new Set(Array.isArray(guardadas) ? guardadas : todas);

  const guardar = () => {
    const agora = [...document.querySelectorAll("#painel section.fechada")].map(x => x.id);
    try { localStorage.setItem("preview-dobras", JSON.stringify(agora)); } catch (_) {}
  };

  document.querySelectorAll("#painel section > h2").forEach(titulo => {
    const seccao = titulo.parentElement;
    if (seccao.id && fechadas.has(seccao.id)) seccao.classList.add("fechada");
    titulo.addEventListener("click", () => {
      seccao.classList.toggle("fechada");
      guardar();
    });
  });
})();

// ---------------------------------------------------- o painel é elástico
//
// Com trinta camadas de um DWG na lista, 320 px deixaram de chegar. A largura
// fica guardada porque é uma preferência de quem trabalha, e não do desenho:
// quem alargou uma vez para ver nomes de camadas quer o painel assim da
// próxima. Dois cliques no puxador põem-no como estava.

const LARGURA_MINIMA = 240, LARGURA_MAXIMA = 900, LARGURA_NORMAL = 320;

function largurraDoPainel(px) {
  const largura = Math.round(Math.max(LARGURA_MINIMA, Math.min(LARGURA_MAXIMA, px)));
  document.documentElement.style.setProperty("--larguraPainel", largura + "px");
  try { localStorage.setItem("preview-largura-painel", String(largura)); } catch (_) {}
}

(function puxador() {
  const puxa = $("puxador");
  try {
    const guardada = parseInt(localStorage.getItem("preview-largura-painel") || "", 10);
    if (guardada) largurraDoPainel(guardada);
  } catch (_) {}

  puxa.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    puxa.setPointerCapture(e.pointerId);
    document.body.classList.add("a-puxar");
  });
  puxa.addEventListener("pointermove", (e) => {
    if (!document.body.classList.contains("a-puxar")) return;
    largurraDoPainel(e.clientX);
  });
  const largar = (e) => {
    if (!document.body.classList.contains("a-puxar")) return;
    document.body.classList.remove("a-puxar");
    try { puxa.releasePointerCapture(e.pointerId); } catch (_) {}
  };
  puxa.addEventListener("pointerup", largar);
  puxa.addEventListener("pointercancel", largar);
  puxa.addEventListener("dblclick", () => largurraDoPainel(LARGURA_NORMAL));
})();

// ------------------------------------------- esconder o painel, e instalar

// A cena é o que interessa ver; o painel é para mexer e depois sair da frente.
// Fica guardado, porque quem o fecha uma vez costuma querê-lo fechado.
function painel(fechado) {
  document.body.classList.toggle("fechado", fechado);
  try { localStorage.setItem("preview-painel", fechado ? "fechado" : "aberto"); } catch (_) {}
}
$("btFechar").onclick = () => painel(true);
$("btAbrir").onclick = () => painel(false);
addEventListener("keydown", (e) => {
  if (e.key === "Tab" && !/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName)) {
    e.preventDefault();
    painel(!document.body.classList.contains("fechado"));
  }
});
try {
  if (localStorage.getItem("preview-painel") === "fechado") painel(true);
} catch (_) {}

// O convite a instalar. O evento do Chrome não chega a toda a gente — no
// iPhone não existe de todo — por isso, quando ele não vem, explica-se o
// caminho à mão em vez de deixar a app sem forma de ser instalada.
(function convite() {
  const naApp = matchMedia("(display-mode: standalone)").matches || navigator.standalone;
  if (naApp) return;
  const agente = navigator.userAgent;
  const iPhone = /iPad|iPhone|iPod/.test(agente) && !window.MSStream;
  // Quem instala aplicações é o Chromium: Chrome, Edge, Brave, Opera, e o
  // Chrome no Android. O Firefox e o Safari de computador não o fazem de todo
  // — mandar essa gente ao "menu do browser" é mandá-la procurar o que lá não
  // está, e sair convencida de que a app não se instala.
  const chromium = /Chrome\/|Chromium\/|Edg\/|OPR\//.test(agente);
  let guardado = null;

  addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    guardado = e;
    $("btInstalar").hidden = false;
    $("comoInstalar").hidden = true;
    $("btCopiarLink").hidden = true;
  });

  $("btInstalar").onclick = async () => {
    if (!guardado) return;
    guardado.prompt();
    await guardado.userChoice;
    guardado = null;
    $("btInstalar").hidden = true;
  };

  // O link e para levar daqui para um browser que instale -- e escrever um
  // endereco destes a mao e o caminho mais curto para desistir.
  $("btCopiarLink").onclick = async () => {
    const endereco = location.href.split("#")[0];
    try {
      await navigator.clipboard.writeText(endereco);
      $("btCopiarLink").textContent = "Link copiado";
      setTimeout(() => { $("btCopiarLink").textContent = "Copiar o link"; }, 2200);
    } catch (_) {
      $("btCopiarLink").textContent = endereco;   // sem permissao, fica a ler
    }
  };

  if (iPhone) {
    $("comoInstalar").textContent =
      "Para instalar: Partilhar ⬆︎ e depois \"Adicionar ao Ecrã Principal\".";
    $("comoInstalar").hidden = false;
  } else if (!chromium) {
    $("comoInstalar").innerHTML =
      "Este browser não instala aplicações — o Firefox e o Safari de computador " +
      "não o fazem. Abre esta página no <b>Chrome</b> ou no <b>Edge</b> e o botão de " +
      "instalar aparece aqui.";
    $("comoInstalar").hidden = false;
    $("btCopiarLink").hidden = false;
  } else {
    // Damos um momento ao browser: se o evento chegar, o botão aparece e esta
    // explicação nunca se mostra.
    setTimeout(() => {
      if ($("btInstalar").hidden) {
        $("comoInstalar").textContent =
          "Para instalar: no menu do browser, \"Instalar aplicação\" ou \"Adicionar ao ecrã principal\".";
        $("comoInstalar").hidden = false;
      }
    }, 2500);
  }
  addEventListener("appinstalled", () => {
    $("btInstalar").hidden = true;
    $("comoInstalar").hidden = true;
    $("btCopiarLink").hidden = true;
  });
})();

// ------------------------------------------------------------------ arranque

try {
  // Primeiro o que vem no endereço (foi alguém que carregou no "Ver em 3D"),
  // depois o último que os Calculadores deixaram guardado — assim abrir o
  // preview sozinho já mostra o projeto em que se andava a trabalhar.
  projeto = projetoDoEndereco() || projetoGuardado();
  // E a sala que vier com ele manda: quem carrega no botão do assistente já lá
  // escreveu as medidas do sítio, e chegar cá a uma sala de 20 × 14 por
  // omissão é receber de volta uma resposta a uma pergunta que não fez.
  if (projeto && projeto.sala) {
    if (projeto.sala.largura) $("salaL").value = projeto.sala.largura;
    if (projeto.sala.profundidade) $("salaP").value = projeto.sala.profundidade;
    if (projeto.sala.altura) $("salaA").value = projeto.sala.altura;
  }
} catch (e) {
  $("aviso").textContent = e.message;
  $("aviso").classList.add("mostra");
}

// Reaproveitar a janela do Preview tem um preço: uma navegação que muda só o
// "#" não recarrega a página, e o módulo não volta a correr. Sem isto, o
// segundo "Ver no Preview 3D" mudava o endereço e mais nada — parecia que o
// botão tinha deixado de funcionar.
addEventListener("hashchange", () => {
  let algo = false;
  try {
    const doEndereco = projetoDoEndereco();
    if (doEndereco) { carregar(doEndereco, true); algo = true; }
  } catch (e) {
    $("aviso").textContent = e.message;
    $("aviso").classList.add("mostra");
  }
  const projetor = projetorDoEndereco();
  if (projetor && aplicarProjetor(projetor)) {
    document.getElementById("sProjecao").classList.remove("fechada");
    algo = true;
  }
  if (algo) {
    const aviso = $("aviso");
    if (!aviso.classList.contains("mostra")) {
      aviso.textContent = "Chegou dos Calculadores.";
      aviso.classList.add("mostra");
      setTimeout(() => aviso.classList.remove("mostra"), 2400);
    }
    focus();
  }
});

// E se os Calculadores mexerem nas zonas noutra aba, isto acompanha. O evento
// só chega às OUTRAS abas do mesmo domínio, que é exactamente o caso: as duas
// apps lado a lado.
addEventListener("storage", (e) => {
  // O projetor tambem atravessa por aqui, e esse aplica-se logo: do outro lado
  // foi preciso carregar num botao para ele vir, o que ja e a decisao tomada.
  if (e.key === CHAVE_PROJETOR && e.newValue) {
    if (aplicarProjetor(projetorGuardado())) {
      const aviso = $("aviso");
      aviso.textContent = "Chegou um projetor dos Calculadores.";
      aviso.classList.add("mostra");
      setTimeout(() => aviso.classList.remove("mostra"), 2600);
    }
    return;
  }
  if (e.key !== CHAVE_PROJETO || !e.newValue) return;
  try {
    projeto = lerProjeto(e.newValue);
    montar(false);
    const aviso = $("aviso");
    aviso.textContent = "Os Calculadores mudaram o projeto — atualizei.";
    aviso.classList.add("mostra");
    setTimeout(() => aviso.classList.remove("mostra"), 2600);
  } catch (_) { /* o que veio não servia; fica o que estava */ }
});

// Porta de serviço: dá para espreitar a cena da consola do browser, e é por
// aqui que se percebe o que não está a ser desenhado sem ter de adivinhar.
window.preview = { THREE, cena, camara, controlos, medirSombra, aplicarProjetor,
                  get projeto() { return projeto; },
                  get desenhado() { return desenhado; },
                  get plantaCad() { return plantaCad; } };

// Um projetor que venha no ENDERECO aplica-se sozinho -- alguem carregou no
// "Ver no Preview 3D" para isto acontecer. Um projetor apenas GUARDADO nao:
// ligar a projecao a quem so queria ver a sala e mexer no desenho sem lho
// pedirem. Nesse caso diz-se que ele esta ali, a espera de um botao.
(function projetorAEspera() {
  const doEndereco = projetorDoEndereco();
  if (doEndereco) {
    aplicarProjetor(doEndereco);
    document.getElementById("sProjecao").classList.remove("fechada");
    return;
  }
  const p = projetorGuardado();
  if (!p) return;
  $("btTrazerProjetor").textContent = "Trazer: " + (p.modelo || "projetor dos Calculadores");
  $("notaProj").innerHTML = `Está guardado um projetor` +
    (p.modelo ? ` (<b>${p.modelo}</b>)` : "") +
    `: rácio ${p.racio.toFixed(2)}:1 a ${p.distancia.toFixed(2)} m. Carrega no botão para o trazer.`;
})();

montar(true);
volta();
